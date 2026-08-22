import "server-only"

import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { getAiProviderConfig } from "@/lib/ai/settings"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const POLL_INTERVAL_MS = 2_500
const MAX_POLL_ATTEMPTS = 24

const mimeExtensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export class DashScopeImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DashScopeImageError"
  }
}

function imageRoot() {
  return path.join(process.cwd(), "data", "article-images")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function safeProviderError(status: number) {
  if (status === 401 || status === 403) return "DashScope 图像权限不可用"
  if (status === 429) return "DashScope 图像额度或频率受限"
  if (status >= 500) return "DashScope 图像服务暂时不可用"
  return "DashScope 图像请求未完成"
}

function imageBaseUrl() {
  const explicit = process.env.DASHSCOPE_IMAGE_BASE_URL?.trim()
  if (explicit) {
    let url: URL
    try {
      url = new URL(explicit)
    } catch {
      throw new DashScopeImageError("DashScope 图像地址无效")
    }
    if (url.protocol !== "https:") throw new DashScopeImageError("DashScope 图像地址必须使用 HTTPS")
    return url.toString().replace(/\/$/, "")
  }

  const workspace = process.env.DASHSCOPE_WORKSPACE_ID?.trim()
  const region = process.env.DASHSCOPE_IMAGE_REGION?.trim() || "cn-beijing"
  if (workspace) return `https://${workspace}.${region}.maas.aliyuncs.com/api/v1`
  return "https://dashscope.aliyuncs.com/api/v1"
}

async function requestJson(url: string, init: RequestInit, timeoutMs = 20_000): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new DashScopeImageError("DashScope 图像网络请求失败")
  }
  if (!response.ok) throw new DashScopeImageError(safeProviderError(response.status))
  try {
    return await response.json()
  } catch {
    throw new DashScopeImageError("DashScope 图像响应无效")
  }
}

function taskIdFromResponse(value: unknown) {
  if (!isRecord(value) || !isRecord(value.output) || typeof value.output.task_id !== "string") {
    throw new DashScopeImageError("DashScope 没有返回图像任务")
  }
  return value.output.task_id
}

function imageUrlFromResponse(value: unknown) {
  if (!isRecord(value) || !isRecord(value.output)) return null
  const output = value.output
  if (typeof output.output_image_url === "string") return output.output_image_url
  if (Array.isArray(output.results)) {
    const result = output.results.find((item) => isRecord(item) && typeof item.url === "string")
    if (isRecord(result) && typeof result.url === "string") return result.url
  }
  if (Array.isArray(output.choices)) {
    for (const choice of output.choices) {
      if (!isRecord(choice) || !isRecord(choice.message) || !Array.isArray(choice.message.content)) continue
      for (const item of choice.message.content) {
        if (isRecord(item) && typeof item.image === "string") return item.image
      }
    }
  }
  return null
}

function taskStatus(value: unknown) {
  if (!isRecord(value) || !isRecord(value.output) || typeof value.output.task_status !== "string") return null
  return value.output.task_status
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function resolveImageConfig(accountId?: number) {
  try {
    const config = await getAiProviderConfig("qwen", accountId)
    if (!config.apiKey) return null
    return {
      apiKey: config.apiKey,
      model: process.env.DASHSCOPE_IMAGE_MODEL?.trim() || "qwen-image-3.0-pro",
      baseUrl: imageBaseUrl(),
    }
  } catch {
    return null
  }
}

export async function dashscopeImageAvailable(accountId?: number) {
  return Boolean(await resolveImageConfig(accountId))
}

export async function generateDashScopeImage(
  accountId: number | undefined,
  prompt: string,
  taskHint: string,
) {
  const config = await resolveImageConfig(accountId)
  if (!config) throw new DashScopeImageError("DashScope 图像未配置")

  const taskResponse = await requestJson(`${config.baseUrl}/services/aigc/image-generation/generation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: config.model,
      input: {
        messages: [{ role: "user", content: [{ text: prompt.slice(0, 700) }] }],
      },
      parameters: {
        size: "1024*1024",
        n: 1,
        prompt_extend: true,
        watermark: false,
      },
    }),
  })
  const taskId = taskIdFromResponse(taskResponse)

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const statusResponse = await requestJson(`${config.baseUrl}/tasks/${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })
    const status = taskStatus(statusResponse)
    if (status === "SUCCEEDED") {
      const imageUrl = imageUrlFromResponse(statusResponse)
      if (!imageUrl) throw new DashScopeImageError("DashScope 任务完成但没有图片")
      const stored = await downloadImage(imageUrl, taskHint)
      return { taskId, ...stored }
    }
    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      throw new DashScopeImageError("DashScope 图像任务失败")
    }
    await sleep(POLL_INTERVAL_MS)
  }

  throw new DashScopeImageError("DashScope 图像任务超时")
}

async function downloadImage(imageUrl: string, taskHint: string) {
  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    throw new DashScopeImageError("DashScope 图片地址无效")
  }
  const isAllowedUrl = (value: URL) =>
    value.protocol === "https:" && (value.hostname.endsWith(".aliyuncs.com") || value.hostname.endsWith(".aliyun.com"))
  if (!isAllowedUrl(parsed)) throw new DashScopeImageError("DashScope 图片地址不在允许范围")

  let response: Response | null = null
  for (let redirect = 0; redirect <= 2; redirect += 1) {
    try {
      response = await fetch(parsed, { signal: AbortSignal.timeout(30_000), redirect: "manual" })
    } catch {
      throw new DashScopeImageError("下载 DashScope 图片失败")
    }
    if (response.status < 300 || response.status >= 400) break
    const location = response.headers.get("location")
    if (!location || redirect === 2) throw new DashScopeImageError("DashScope 图片重定向无效")
    try {
      parsed = new URL(location, parsed)
    } catch {
      throw new DashScopeImageError("DashScope 图片重定向无效")
    }
    if (!isAllowedUrl(parsed)) throw new DashScopeImageError("DashScope 图片地址不在允许范围")
  }
  if (!response || !response.ok) throw new DashScopeImageError("下载 DashScope 图片失败")
  if (!response.ok) throw new DashScopeImageError("下载 DashScope 图片失败")
  const mime = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase()
  const extension = mimeExtensions[mime]
  if (!extension) throw new DashScopeImageError("DashScope 返回了不支持的图片格式")
  const declaredSize = Number(response.headers.get("content-length") || 0)
  if (declaredSize > MAX_IMAGE_BYTES) throw new DashScopeImageError("DashScope 图片过大")
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new DashScopeImageError("DashScope 图片大小无效")

  const safeHint = taskHint.replace(/[^0-9-]/g, "-").slice(0, 160)
  const assetKey = `${safeHint}.${extension}`
  const filePath = getArticleImagePath(assetKey)
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporaryPath, bytes, { mode: 0o600 })
  await rename(temporaryPath, filePath)
  return { assetKey, mimeType: mime }
}

export function getArticleImagePath(assetKey: string) {
  if (!/^\d{1,10}\/\d{4}-\d{2}-\d{2}\/\d{1,10}\.(?:png|jpg|webp)$/.test(assetKey)) {
    throw new DashScopeImageError("图片资源标识无效")
  }
  const root = imageRoot()
  const resolved = path.resolve(root, assetKey)
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new DashScopeImageError("图片资源路径无效")
  return resolved
}
