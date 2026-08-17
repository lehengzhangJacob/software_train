import { apiError, apiSuccess } from "@/lib/api-response"
import { getAssistantText, requestAiChatCompletion } from "@/lib/ai/client"
import { getPublicAiError } from "@/lib/ai/errors"
import { getActiveAiProviderConfig } from "@/lib/ai/settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface FoodItem {
  name: string
  calories: number
  protein: number
  fat: number
  carbs: number
  portion: string
  confidence: number
}

interface RecognitionResult {
  foods: FoodItem[]
  totalCalories: number
}

const MAX_REQUEST_BYTES = 14 * 1024 * 1024
const SUPPORTED_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,/i

function isRecognitionResult(value: unknown): value is RecognitionResult {
  if (!value || typeof value !== "object") return false

  const result = value as Partial<RecognitionResult>
  if (!Array.isArray(result.foods) || result.foods.length > 50 || typeof result.totalCalories !== "number" || !Number.isFinite(result.totalCalories) || result.totalCalories < 0 || result.totalCalories > 100_000) return false

  return result.foods.every((food) => {
    if (!food || typeof food !== "object") return false
    const item = food as Partial<FoodItem>
    return (
      typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 100 &&
      typeof item.portion === "string" && item.portion.trim().length > 0 && item.portion.length <= 200 &&
      [item.calories, item.protein, item.fat, item.carbs, item.confidence].every(
        (number) => typeof number === "number" && Number.isFinite(number)
      ) &&
      (item.calories ?? -1) >= 0 && (item.calories ?? 100_001) <= 100_000 &&
      (item.protein ?? -1) >= 0 && (item.protein ?? 100_001) <= 100_000 &&
      (item.fat ?? -1) >= 0 && (item.fat ?? 100_001) <= 100_000 &&
      (item.carbs ?? -1) >= 0 && (item.carbs ?? 100_001) <= 100_000 &&
      (item.confidence ?? -1) >= 0 &&
      (item.confidence ?? 2) <= 1
    )
  })
}

function parseRecognitionJson(content: string): unknown {
  const trimmed = content.trim()
  const json = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed
  return JSON.parse(json)
}

const SYSTEM_PROMPT = `你是一个专业的食物营养识别专家。分析图片中的食物，返回JSON格式的识别结果。
严格按照以下JSON Schema返回：
{
  "foods": [
    {
      "name": "食物名称（中文）",
      "calories": 热量值（千卡，整数）,
      "protein": 蛋白质（克，一位小数）,
      "fat": 脂肪（克，一位小数）,
      "carbs": 碳水化合物（克，一位小数）,
      "portion": "份量描述",
      "confidence": 置信度（0-1之间）
    }
  ],
  "totalCalories": 总热量
}

注意：
- 如果无法识别，返回 foods: [] 和 totalCalories: 0
- 只返回JSON，不要额外的文字
- 使用合理的营养估算值`

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > MAX_REQUEST_BYTES) {
      return apiError("图片请求过大", 413)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError("图片请求格式无效", 400)
    }
    const { image } = body as { image?: string }

    if (!image || typeof image !== "string") {
      return apiError("请提供食物图片", 400)
    }
    if (image.length > MAX_REQUEST_BYTES) {
      return apiError("图片请求过大", 413)
    }
    if (!SUPPORTED_IMAGE_PATTERN.test(image)) {
      return apiError("仅支持 JPEG、PNG 或 WebP 图片", 415)
    }

    const config = await getActiveAiProviderConfig()
    if (config.visionCapability === "unsupported") {
      return apiError("当前 AI 提供商预设为文本模型，请切换到支持图片的模型", 422)
    }
    const result = await requestAiChatCompletion(config, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "请识别图中的食物并估算营养成分" },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      max_tokens: 4096,
    }, 90_000, config.visionModel)
    const content = getAssistantText(result)

    if (!content) {
      return apiError("AI 识别结果为空", 502)
    }

    try {
      const parsed = parseRecognitionJson(content)
      if (!isRecognitionResult(parsed)) {
        return apiError("AI 识别结果格式无效", 502)
      }
      return apiSuccess(parsed)
    } catch {
      return apiError("AI 识别结果格式无效", 502)
    }
  } catch (error) {
    const failure = getPublicAiError(error)
    return apiError(failure.message, failure.status)
  }
}
