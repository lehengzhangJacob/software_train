import {
  Agent,
  assistant,
  Runner,
  user,
  type AgentInputItem,
  type RunStreamEvent,
} from "@openai/agents"
import { getAssistantText, requestAiChatCompletion } from "@/lib/ai/client"
import { createAgentModelProvider } from "@/lib/agent/kernel/model-provider"
import type {
  AgentKernelCapabilities,
  AgentKernelMessage,
  AgentKernelMode,
  AgentKernelOptions,
  AgentKernelResult,
} from "@/lib/agent/kernel/contracts"
import { defaultAgentKernelCapabilities } from "@/lib/agent/kernel/contracts"

function toAgentInput(messages: AgentKernelMessage[], message: string): AgentInputItem[] {
  return [
    ...messages.map((item) => item.role === "assistant" ? assistant(item.content) : user(item.content)),
    user(message),
  ]
}

function toFallbackMessages(instructions: string, messages: AgentKernelMessage[], message: string) {
  return [
    { role: "system" as const, content: instructions },
    ...messages,
    { role: "user" as const, content: message },
  ]
}

function streamTextDelta(event: RunStreamEvent): string | undefined {
  if (event.type !== "raw_model_stream_event") return undefined
  const data = event.data as unknown as { type?: string; delta?: unknown }
  if (data.type !== "output_text_delta" && data.type !== "response.output_text.delta") return undefined
  return typeof data.delta === "string" && data.delta ? data.delta : undefined
}

function modeFor(capabilities: AgentKernelCapabilities, streamed: boolean): AgentKernelMode {
  if (!streamed) return "fallback"
  return capabilities.toolCalls ? "autonomous" : "single-turn"
}

async function fallbackCompletion(options: AgentKernelOptions): Promise<AgentKernelResult> {
  const capabilities = options.capabilities ?? defaultAgentKernelCapabilities()
  const response = await requestAiChatCompletion(options.config, {
    messages: toFallbackMessages(options.instructions, options.messages, options.message),
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 1_500,
    ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
  })
  const text = getAssistantText(response) ?? ""
  if (text) await options.onTextDelta?.(text)
  return {
    text,
    streamed: false,
    mode: "fallback",
    turns: 1,
    capabilities,
  }
}

/**
 * Run one FoodMoment turn through the Agents SDK while keeping provider
 * selection, fallback semantics and output streaming inside this adapter.
 */
export async function runAgentKernel(options: AgentKernelOptions): Promise<AgentKernelResult> {
  const capabilities = options.capabilities ?? defaultAgentKernelCapabilities()
  if (!capabilities.stream) return fallbackCompletion(options)

  const provider = options.modelProvider ?? createAgentModelProvider(options.config)
  const model = await provider.getModel(options.config.model)
  const agent = new Agent({
    name: "FoodMoment Nutrition Agent",
    instructions: options.instructions,
    model,
    tools: options.tools ?? [],
    modelSettings: {
      temperature: options.temperature ?? 0.4,
      maxTokens: options.maxTokens ?? 1_500,
      ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
    },
  })
  const runner = new Runner({
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
    workflowName: "FoodMoment Agent",
  })

  let streamedText = ""
  try {
    const result = await runner.run(agent, toAgentInput(options.messages, options.message), {
      stream: true,
      maxTurns: options.maxTurns ?? 1,
      signal: options.signal,
    })
    for await (const event of result) {
      const delta = streamTextDelta(event)
      if (!delta) continue
      streamedText += delta
      await options.onTextDelta?.(delta)
    }
    await result.completed
    const finalOutput = typeof result.finalOutput === "string" ? result.finalOutput : ""
    if (!streamedText && finalOutput) {
      await options.onTextDelta?.(finalOutput)
      return {
        text: finalOutput,
        streamed: false,
        mode: "fallback",
        turns: result.currentTurn || 1,
        capabilities,
      }
    }
    return {
      text: streamedText || finalOutput,
      streamed: Boolean(streamedText),
      mode: modeFor(capabilities, Boolean(streamedText)),
      turns: result.currentTurn || 1,
      capabilities,
    }
  } catch (error) {
    // A provider that rejects stream mode is an explicit fallback, but a
    // partially emitted stream must remain an honest failed turn.
    if (streamedText) throw error
    return fallbackCompletion(options)
  }
}
