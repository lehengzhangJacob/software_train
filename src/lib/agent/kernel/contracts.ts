import type { ModelProvider, Tool } from "@openai/agents"
import type { ResolvedAiProviderConfig } from "@/lib/ai/settings"
import type { AgentTraceRecorder } from "@/lib/agent/trace"

export type AgentKernelMessage = {
  role: "user" | "assistant"
  content: string
}

export type AgentKernelCapabilities = {
  /** The provider can return verifiable incremental output events. */
  stream: boolean
  /** The provider can accept and return function/tool calls. */
  toolCalls: boolean
}

export type AgentKernelMode = "autonomous" | "single-turn" | "fallback"

export type AgentKernelOptions = {
  config: ResolvedAiProviderConfig
  instructions: string
  messages: AgentKernelMessage[]
  message: string
  capabilities?: AgentKernelCapabilities
  tools?: Tool[]
  modelProvider?: ModelProvider
  context?: unknown
  trace?: AgentTraceRecorder
  signal?: AbortSignal
  maxTurns?: number
  temperature?: number
  maxTokens?: number
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
  onTextDelta?: (delta: string) => void | Promise<void>
}

export type AgentKernelResult = {
  text: string
  streamed: boolean
  mode: AgentKernelMode
  turns: number
  capabilities: AgentKernelCapabilities
}

export function defaultAgentKernelCapabilities(): AgentKernelCapabilities {
  return { stream: true, toolCalls: false }
}
