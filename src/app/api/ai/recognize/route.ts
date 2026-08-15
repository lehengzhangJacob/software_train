import { NextResponse } from "next/server"

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

function jsonError(message: string, status: number) {
  return NextResponse.json({ data: null, error: message }, { status })
}

function isRecognitionResult(value: unknown): value is RecognitionResult {
  if (!value || typeof value !== "object") return false

  const result = value as Partial<RecognitionResult>
  if (!Array.isArray(result.foods) || typeof result.totalCalories !== "number") return false

  return result.foods.every((food) => {
    if (!food || typeof food !== "object") return false
    const item = food as Partial<FoodItem>
    return (
      typeof item.name === "string" &&
      typeof item.portion === "string" &&
      [item.calories, item.protein, item.fat, item.carbs, item.confidence].every(
        (number) => typeof number === "number" && Number.isFinite(number)
      ) &&
      (item.calories ?? -1) >= 0 &&
      (item.protein ?? -1) >= 0 &&
      (item.fat ?? -1) >= 0 &&
      (item.carbs ?? -1) >= 0 &&
      (item.confidence ?? -1) >= 0 &&
      (item.confidence ?? 2) <= 1
    )
  })
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
      return jsonError("图片请求过大", 413)
    }

    const body = await request.json()
    const { image } = body as { image?: string }

    if (!image || typeof image !== "string") {
      return jsonError("请提供食物图片", 400)
    }
    if (image.length > MAX_REQUEST_BYTES) {
      return jsonError("图片请求过大", 413)
    }
    if (!SUPPORTED_IMAGE_PATTERN.test(image)) {
      return jsonError("仅支持 JPEG、PNG 或 WebP 图片", 415)
    }

    const apiKey = process.env.STEP_API_KEY?.trim()
    if (!apiKey) {
      return jsonError("AI 识别服务尚未配置", 503)
    }

    const baseUrl = (process.env.STEP_API_BASE_URL ?? "https://api.stepfun.com/v1").replace(/\/$/, "")
    const model = process.env.STEP_API_MODEL ?? "step-3.7-flash"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "请识别图中的食物并估算营养成分" },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      console.error("Step API request failed", { status: response.status })
      return jsonError("AI 识别服务暂时不可用", 502)
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content

    if (!content) {
      return jsonError("AI 识别结果为空", 502)
    }

    try {
      const parsed: unknown = JSON.parse(content)
      if (!isRecognitionResult(parsed)) {
        return jsonError("AI 识别结果格式无效", 502)
      }
      return NextResponse.json({ data: parsed, error: null })
    } catch {
      return jsonError("AI 识别结果格式无效", 502)
    }
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return jsonError("AI 识别请求超时", 504)
    }
    return jsonError("AI 识别请求失败", 500)
  }
}
