import { NextResponse } from "next/server"

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
    const body = await request.json()
    const { image } = body as { image?: string }

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    const apiKey = process.env.STEP_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        data: {
          foods: [
            { name: "示例识别结果（需配置 STEP_API_KEY）", calories: 250, protein: 15, fat: 8, carbs: 30, portion: "1份", confidence: 0.85 },
          ],
          totalCalories: 250,
        } satisfies RecognitionResult,
        warning: "STEP_API_KEY not configured",
      })
    }

    const response = await fetch("https://api.stepfun.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "step-3.7-flash",
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
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Step API error:", response.status, errText)
      return NextResponse.json({ error: `AI API error: ${response.status}` }, { status: 502 })
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 })
    }

    try {
      const parsed: RecognitionResult = JSON.parse(content)
      return NextResponse.json({ data: parsed })
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
