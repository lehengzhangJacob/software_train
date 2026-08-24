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
import type { AgentTraceEventInput } from "@/lib/agent/trace-contract"

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

function safeToolName(value: unknown, allowedToolNames: Set<string>) {
  if (typeof value !== "string" || !allowedToolNames.has(value)) return undefined
  return value
}

function safeToolResultSummary(toolName: string | undefined, item: Record<string, unknown>, rawItem: Record<string, unknown> | undefined) {
  if (toolName !== "web_search") return "只读工具返回已隔离的安全摘要"
  const output = item.output ?? rawItem?.output
  let parsed: unknown = output
  if (typeof output === "string") {
    try { parsed = JSON.parse(output) } catch { parsed = undefined }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const sourceCount = (parsed as Record<string, unknown>).sourceCount
    const status = (parsed as Record<string, unknown>).status
    if (status === "unavailable") return "公开资料检索暂不可用"
    if (typeof sourceCount === "number" && Number.isInteger(sourceCount) && sourceCount >= 0 && sourceCount <= 20) {
      return `公开资料检索完成，共 ${sourceCount} 条来源`
    }
  }
  return "公开资料检索完成"
}

function traceInputForToolEvent(
  event: RunStreamEvent,
  allowedToolNames: Set<string>,
  activeTools: Map<string, { eventId: string; startedAt: number; toolName?: string }>,
): AgentTraceEventInput | null {
  if (event.type !== "run_item_stream_event") return null
  const item = event.item as unknown as Record<string, unknown>
  const rawItem = item.rawItem as Record<string, unknown> | undefined
  const callId = typeof item.callId === "string"
    ? item.callId
    : typeof rawItem?.callId === "string"
      ? rawItem.callId
      : undefined
  const toolName = safeToolName(
    typeof item.toolName === "string" ? item.toolName : rawItem?.name,
    allowedToolNames,
  )
  if (event.name === "tool_called" && item.type === "tool_call_item" && callId) {
    return {
      eventType: "tool.started",
      status: "running",
      label: toolName ? `调用 ${toolName}` : "调用受限工具",
      ...(toolName ? { toolName } : {}),
      safeSummary: "模型选择了一个已注册的只读工具",
    }
  }
  if (event.name === "tool_output" && item.type === "tool_call_output_item" && callId) {
    const active = activeTools.get(callId)
    return {
      eventType: "tool.result",
      status: rawItem?.status === "incomplete" || item.executionStatus !== "executed" ? "failed" : "completed",
      label: active?.toolName || toolName ? `调用 ${active?.toolName ?? toolName}` : "调用受限工具",
      ...((active?.toolName ?? toolName) ? { toolName: active?.toolName ?? toolName } : {}),
      ...(active ? { parentId: active.eventId, durationMs: Date.now() - active.startedAt } : {}),
      safeSummary: safeToolResultSummary(toolName, item, rawItem),
    }
  }
  return null
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
  let toolWasInvoked = false
  const activeTools = new Map<string, { eventId: string; startedAt: number; toolName?: string }>()
  try {
    const result = await runner.run(agent, toAgentInput(options.messages, options.message), {
      stream: true,
      maxTurns: options.maxTurns ?? 1,
      signal: options.signal,
      context: options.context,
    })
    const allowedToolNames = new Set((options.tools ?? []).map((tool) => tool.name))
    for await (const event of result) {
      if (event.type === "run_item_stream_event" && event.name === "tool_called") {
        toolWasInvoked = true
      }
      const toolTrace = traceInputForToolEvent(event, allowedToolNames, activeTools)
      if (toolTrace && options.trace) {
        const itemEventName = event.type === "run_item_stream_event" ? event.name : undefined
        const callId = event.type === "run_item_stream_event"
          ? String(
              ((event.item as unknown as Record<string, unknown>).callId
                ?? ((event.item as unknown as Record<string, unknown>).rawItem as Record<string, unknown> | undefined)?.callId
                ?? ""),
            )
          : ""
        if (itemEventName === "tool_called") {
          const started = await options.trace.emit(toolTrace)
          if (callId) {
            activeTools.set(callId, {
              eventId: started.eventId,
              startedAt: Date.now(),
              ...(started.toolName ? { toolName: started.toolName } : {}),
            })
          }
        } else {
          await options.trace.emit(toolTrace)
          if (callId) activeTools.delete(callId)
        }
      }
      const delta = streamTextDelta(event)
      if (!delta) continue
      streamedText += delta
      await options.trace?.emit({
        eventType: "model.delta",
        status: "running",
        label: "模型返回增量",
        safeSummary: "模型返回了一段可见内容",
      })
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
    if (toolWasInvoked) {
      if (options.trace) {
        for (const active of activeTools.values()) {
          await options.trace.emit({
            eventType: "tool.result",
            status: "failed",
            label: active.toolName ? `调用 ${active.toolName}` : "调用受限工具",
            ...(active.toolName ? { toolName: active.toolName } : {}),
            parentId: active.eventId,
            durationMs: Date.now() - active.startedAt,
            safeSummary: "只读工具执行失败",
          })
        }
      }
      throw error
    }
    if (streamedText) throw error
    return fallbackCompletion(options)
  }
}
