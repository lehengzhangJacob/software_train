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

export interface AiCredentialGuide {
  url?: string
  linkLabel?: string
  description: string
  steps: readonly string[]
  note?: string
}

export interface AiProviderPreset {
  id: AiProviderId
  label: string
  description: string
  defaultBaseUrl: string
  defaultModel: string
  requiresApiKey: boolean
  visionCapability: AiVisionCapability
  credentialGuide: AiCredentialGuide
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
    credentialGuide: {
      url: "https://platform.stepfun.com/",
      description: "StepFun 的 API Key 在开放平台控制台创建。先确认账号具备可用的调用套餐或权限。",
      steps: [
        "打开 StepFun 开放平台并登录账号。",
        "在控制台进入 API Key 管理，创建一个新的 API Key。",
        "复制新密钥并回到下方 API Key 输入框；首次创建时请立即保存。",
      ],
      note: "聊天模型和识图模型还需要与 StepFun 控制台中的可用模型保持一致。",
    },
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI 官方 API",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    requiresApiKey: true,
    visionCapability: "supported",
    credentialGuide: {
      url: "https://platform.openai.com/api-keys",
      description: "OpenAI API Key 在 API 平台的 API keys 页面创建，不是 ChatGPT 网页会员密码。",
      steps: [
        "打开 OpenAI API Keys 页面并登录 API Platform 账号。",
        "点击创建新的 secret key，按需设置名称或项目范围。",
        "复制创建时显示的完整密钥并回到下方粘贴；离开页面后通常不能再次查看完整值。",
      ],
      note: "API 调用需要使用 API Platform 的计费和额度设置；ChatGPT Plus 不等同于 API 额度。",
    },
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "OpenAI-compatible 文本模型",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    requiresApiKey: true,
    visionCapability: "unsupported",
    credentialGuide: {
      url: "https://platform.deepseek.com/",
      description: "DeepSeek API Key 在 DeepSeek 开放平台控制台创建。",
      steps: [
        "打开 DeepSeek 开放平台并登录或注册开发者账号。",
        "进入 API Keys 或密钥管理页面，创建一个新的 API Key。",
        "复制密钥并回到下方粘贴，然后点击保存并测试。",
      ],
      note: "当前 DeepSeek 预设只支持文本对话，不能用于食物图片识别。",
    },
  },
  {
    id: "qwen",
    label: "通义千问 Qwen",
    description: "阿里云百炼 OpenAI 兼容接口",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-vl-plus",
    requiresApiKey: true,
    visionCapability: "supported",
    credentialGuide: {
      url: "https://bailian.console.aliyun.com/",
      description: "通义千问使用阿里云百炼的 API Key；登录百炼控制台后在 API-KEY 管理中创建。",
      steps: [
        "打开阿里云百炼控制台并登录阿里云账号。",
        "进入 API-KEY 管理页面，创建一个新的 API Key。",
        "复制密钥并回到下方粘贴；聊天和识图模型分别填入你已开通的模型名称。",
      ],
      note: "当前项目的 Qwen Base URL 是 DashScope OpenAI 兼容接口；如你修改 Base URL，请保持与账号所在服务区域一致。",
    },
  },
  {
    id: "moonshot",
    label: "Kimi / Moonshot",
    description: "Moonshot OpenAI 兼容接口",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.6",
    requiresApiKey: true,
    visionCapability: "supported",
    credentialGuide: {
      url: "https://platform.kimi.ai/",
      description: "Kimi API Key 在 Kimi 开放平台控制台创建，Kimi 会员订阅与开发者 API 额度是两套体系。",
      steps: [
        "打开 Kimi 开放平台并注册或登录开发者账号。",
        "进入控制台的 API Keys 管理页，创建一个新的 API Key。",
        "复制密钥并回到下方粘贴，然后保存并测试连接。",
      ],
      note: "请以控制台显示的当前 API Base URL 和模型 ID 为准；本地预设仍允许你手动调整。",
    },
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    description: "智谱开放平台 OpenAI 兼容接口",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4.6v-flash",
    requiresApiKey: true,
    visionCapability: "supported",
    credentialGuide: {
      url: "https://open.bigmodel.cn/usercenter/apikeys",
      description: "智谱 GLM 的 API Key 在智谱开放平台个人中心创建。",
      steps: [
        "打开智谱开放平台 API Keys 页面并登录或注册。",
        "在个人中心创建一个新的 API Key。",
        "复制密钥并回到下方粘贴；需要识图时选择支持视觉输入的 GLM 模型。",
      ],
      note: "API Key 是开发者凭证，不要与智谱网页端账号密码混用。",
    },
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    description: "硅基流动 OpenAI 兼容接口",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    requiresApiKey: true,
    visionCapability: "model-dependent",
    credentialGuide: {
      url: "https://cloud.siliconflow.cn/account/ak",
      description: "SiliconFlow API Key 在硅基流动控制台的 API 密钥页面创建。",
      steps: [
        "打开硅基流动 API 密钥页面并登录账号。",
        "点击新建密钥，为密钥命名并按需设置额度或权限。",
        "复制生成的 API Key，回到下方粘贴并选择控制台中实际可用的模型 ID。",
      ],
      note: "SiliconFlow 的识图能力取决于你选择的模型是否支持视觉输入。",
    },
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "多模型 OpenAI-compatible 网关",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4.1-mini",
    requiresApiKey: true,
    visionCapability: "model-dependent",
    credentialGuide: {
      url: "https://openrouter.ai/settings/keys",
      description: "OpenRouter API Key 在账户设置的 Keys 页面创建，可统一接入多个模型提供商。",
      steps: [
        "打开 OpenRouter Keys 页面并登录账号。",
        "创建一个新的 API Key；如有额度控制选项，建议设置名称和使用上限。",
        "复制密钥并回到下方粘贴，再把模型名称填成 OpenRouter 的模型 slug。",
      ],
      note: "OpenRouter 的模型可用性、价格和视觉能力以模型目录及你的账户额度为准。",
    },
  },
  {
    id: "ollama",
    label: "Ollama（本机）",
    description: "本机 OpenAI-compatible 服务，需要已拉取模型",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2-vision:11b",
    requiresApiKey: false,
    visionCapability: "model-dependent",
    credentialGuide: {
      url: "https://ollama.com/download",
      description: "Ollama 在本机运行，不需要 API Key；需要安装服务并提前拉取模型。",
      steps: [
        "安装 Ollama 并启动本机服务。",
        "在终端执行 ollama pull <模型名>，例如拉取一个支持视觉的模型。",
        "确认 Base URL 指向本机 Ollama 服务，并把聊天/识图模型填成已拉取的模型名。",
      ],
      note: "该 Provider 的 API Key 区域可以留空；如果本机服务未启动，保存并测试仍会失败。",
    },
  },
  {
    id: "custom",
    label: "自定义 OpenAI-compatible",
    description: "适用于私有网关或其他兼容服务",
    defaultBaseUrl: "https://api.example.com/v1",
    defaultModel: "your-model",
    requiresApiKey: true,
    visionCapability: "model-dependent",
    credentialGuide: {
      description: "自定义 OpenAI-compatible 服务没有统一的官方申请入口，请向该服务的管理员或控制台申请凭证。",
      steps: [
        "从你的兼容服务控制台创建 API Key，或向服务管理员申请。",
        "将该服务要求的 Base URL 填入下方，并确认它提供 Chat Completions 兼容接口。",
        "填入模型 ID 和 API Key 后点击保存并测试；识图还需要模型支持多模态输入。",
      ],
      note: "自定义服务的认证方式、模型命名和计费规则以服务方文档为准。",
    },
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
