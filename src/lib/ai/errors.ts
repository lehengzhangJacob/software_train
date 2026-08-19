export class MissingAiCredentialError extends Error {
  constructor() {
    super("AI 服务尚未配置可用凭据")
    this.name = "MissingAiCredentialError"
  }
}

export class AiSettingsStoreError extends Error {
  constructor() {
    super("无法读取本机 AI 设置")
    this.name = "AiSettingsStoreError"
  }
}

export class AiProviderError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = "AiProviderError"
    this.status = status
  }
}

export function providerFailureForStatus(status: number): AiProviderError {
  if (status === 400) return new AiProviderError("AI 提供商不接受当前模型或请求参数")
  if (status === 401 || status === 403) return new AiProviderError("AI 提供商拒绝了凭据，请检查 API Key")
  if (status === 404) return new AiProviderError("模型或接口地址不可用，请检查模型和 Base URL")
  if (status === 408 || status === 504) return new AiProviderError("AI 提供商请求超时", 504)
  if (status === 429) return new AiProviderError("AI 提供商请求过于频繁或余额不足")
  return new AiProviderError("AI 提供商暂时不可用")
}

export function getPublicAiError(error: unknown): { message: string; status: number } {
  if (error instanceof MissingAiCredentialError) return { message: error.message, status: 503 }
  if (error instanceof AiSettingsStoreError) return { message: error.message, status: 500 }
  if (error instanceof AiProviderError) return { message: error.message, status: error.status }
  return { message: "AI 请求失败", status: 500 }
}
