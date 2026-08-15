export const AI_PROVIDER_IDS = [
  "stepfun",
  "openai",
  "deepseek",
  "qwen",
  "moonshot",
  "zhipu",
  "siliconflow",
  "openrouter",
  "ollama",
  "custom",
] as const

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number]

export type AiVisionCapability = "supported" | "model-dependent" | "unsupported"

export interface AiProviderPreset {
  id: AiProviderId
  label: string
  description: string
  defaultBaseUrl: string
  defaultModel: string
  requiresApiKey: boolean
  visionCapability: AiVisionCapability
}

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: "stepfun",
    label: "阶跃星辰 StepFun",
    description: "兼容 Chat Completions 的多模态模型",
    defaultBaseUrl: "https://api.stepfun.com/v1",
    defaultModel: "step-3.7-flash",
    requiresApiKey: true,
    visionCapability: "supported",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI 官方 API",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    requiresApiKey: true,
    visionCapability: "supported",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "OpenAI-compatible 文本模型",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    requiresApiKey: true,
    visionCapability: "unsupported",
  },
  {
    id: "qwen",
    label: "通义千问 Qwen",
    description: "阿里云百炼 OpenAI 兼容接口",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-vl-plus",
    requiresApiKey: true,
    visionCapability: "supported",
  },
  {
    id: "moonshot",
    label: "Kimi / Moonshot",
    description: "Moonshot OpenAI 兼容接口",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.6",
    requiresApiKey: true,
    visionCapability: "supported",
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    description: "智谱开放平台 OpenAI 兼容接口",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.6v-flash",
    requiresApiKey: true,
    visionCapability: "supported",
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    description: "硅基流动 OpenAI 兼容接口",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    requiresApiKey: true,
    visionCapability: "model-dependent",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "多模型 OpenAI-compatible 网关",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4.1-mini",
    requiresApiKey: true,
    visionCapability: "model-dependent",
  },
  {
    id: "ollama",
    label: "Ollama（本机）",
    description: "本机 OpenAI-compatible 服务，需要已拉取模型",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2-vision:11b",
    requiresApiKey: false,
    visionCapability: "model-dependent",
  },
  {
    id: "custom",
    label: "自定义 OpenAI-compatible",
    description: "适用于私有网关或其他兼容服务",
    defaultBaseUrl: "https://api.example.com/v1",
    defaultModel: "your-model",
    requiresApiKey: true,
    visionCapability: "model-dependent",
  },
]

const providerById = new Map(AI_PROVIDER_PRESETS.map((provider) => [provider.id, provider]))

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && AI_PROVIDER_IDS.includes(value as AiProviderId)
}

export function getAiProviderPreset(id: AiProviderId): AiProviderPreset {
  const provider = providerById.get(id)
  if (!provider) throw new Error(`Unsupported AI provider: ${id}`)
  return provider
}
