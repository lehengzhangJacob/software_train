import { OpenAIProvider } from "@openai/agents"
import type { ModelProvider } from "@openai/agents"
import type { ResolvedAiProviderConfig } from "@/lib/ai/settings"

/**
 * Adapt the account-scoped OpenAI-compatible settings to the Agents SDK.
 *
 * The SDK provider is intentionally created per request. It receives only the
 * already-resolved server-side config and never owns account persistence.
 */
export function createAgentModelProvider(config: ResolvedAiProviderConfig): ModelProvider {
  return new OpenAIProvider({
    // OpenAI's client requires a key even for local OpenAI-compatible servers.
    // The placeholder is never persisted and is only used for keyless Ollama.
    apiKey: config.apiKey ?? "local-provider",
    baseURL: config.baseUrl,
    useResponses: false,
    strictFeatureValidation: false,
  })
}
