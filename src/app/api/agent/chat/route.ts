import { apiError, apiSuccess } from "@/lib/api-response"
import {
  AgentNotFoundError,
  AgentValidationError,
  extractAssistantResponse,
  parseAgentChatInput,
  projectAssistantVisibleText,
  sanitizeAssistantText,
  type AgentChatInput,
  type AgentActivity,
  type AgentActivityReporter,
} from "@/lib/agent/contracts"
import {
  appendAgentMessage,
  ensureAgentThread,
  getAgentMessageHistory,
  getSessionDigest,
  getAgentThread,
} from "@/lib/agent/repository"
import { getOwnedExercisePlan } from "@/lib/exercise/plan-repository"
import { consolidateAgentSession } from "@/lib/agent/consolidation"
import { getAgentContext, buildAgentSystemPrompt } from "@/lib/agent/context"
import {
  composeOrderedReply,
  composeOrderingReply,
  executeMcDonaldOrder,
  extractOrderSelection,
  OrderPlanError,
  planMcDonaldOrder,
  type MenuOption,
  type OrderingOutcome,
} from "@/lib/agent/ordering"
import { hasExplicitOrderingIntent } from "@/lib/agent/ordering-intent"
import { issueOrderingGrant } from "@/lib/actions/policy"
import { getCurrentAccountId, getCurrentUser } from "@/lib/current-user"
import { getAssistantText, requestAiChatCompletion } from "@/lib/ai/client"
import { redactSuppressedMemoryContent } from "@/lib/agent/context-safety"
import { getPublicAiError } from "@/lib/ai/errors"
import { getActiveAiProviderConfig, type ResolvedAiProviderConfig } from "@/lib/ai/settings"
import { markMemoriesUsed } from "@/lib/memory/repository"
import { withMcDonaldMcp } from "@/lib/mcp/mcdonalds-client"
import { getMcDonaldMcpConfig, type McDonaldMcpConfig } from "@/lib/mcp/settings"
import { createAgentActivityRecorder, runAgentActivity } from "@/lib/agent/activity"
import { createAgentTraceRecorder, runAgentTraceStep, type AgentTraceRecorder } from "@/lib/agent/trace"
import type { AgentTraceEvent } from "@/lib/agent/trace-contract"
import { sanitizeTraceText } from "@/lib/agent/trace-contract"
import { runAgentKernel } from "@/lib/agent/kernel/runner"
import { getTodayStr } from "@/lib/utils"
import { after } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function titleFromMessage(message: string) {
  const compact = message.replace(/\s+/g, " ").trim()
  return compact.length > 28 ? `${compact.slice(0, 28)}…` : compact
}

function createVisibleAnswerProjector(onDelta?: (delta: string) => void | Promise<void>) {
  let raw = ""
  let visible = ""

  const push = async (delta: string) => {
    if (!delta) return
    raw += delta
    const candidate = projectAssistantVisibleText(raw)
    const next = sanitizeTraceText(sanitizeAssistantText(candidate), 12_000) ?? ""
    if (!next || !next.startsWith(visible) || next.length <= visible.length) return
    const visibleDelta = next.slice(visible.length)
    visible = next
    await onDelta?.(visibleDelta)
  }

  return {
    push,
    value: () => raw,
  }
}

function selectItemsWithModel(config: ResolvedAiProviderConfig) {
  return async (input: { message: string; menu: MenuOption[]; remainingCalories: number | null }) => {
    const budget =
      input.remainingCalories !== null
        ? `今天剩余热量预算约 ${input.remainingCalories} 千卡，优先蛋白质充足的一餐。`
        : "今天热量数据缺失，按常规正餐挑选。"
    const result = await requestAiChatCompletion(config, {
      messages: [
        {
          role: "system",
          content: [
            "你是营养点餐助手，从给定菜单中为用户挑选 1 到 5 项商品。",
            budget,
            '只输出一个 <order-selection>{"items":[{"code":"菜单编码","quantity":1}],"note":"一句话理由"}</order-selection> 标签；code 必须来自菜单，不得编造。',
            `菜单：${JSON.stringify(input.menu.map((option) => ({ code: option.code, name: option.name })))}`,
          ].join("\n"),
        },
        { role: "user", content: input.message },
      ],
      temperature: 0.2,
      max_tokens: 600,
    })
    const raw = getAssistantText(result)
    if (!raw) throw new OrderPlanError("模型没有返回选餐结果")
    return extractOrderSelection(raw)
  }
}

async function runOrderingPlan(
  config: ResolvedAiProviderConfig,
  message: string,
  context: Awaited<ReturnType<typeof getAgentContext>>,
  mcpConfig: McDonaldMcpConfig,
  reportActivity?: AgentActivityReporter,
  trace?: AgentTraceRecorder,
): Promise<OrderingOutcome> {
  const today = getTodayStr()
  const todayIntake = context.meals
    .filter((meal) => meal.recordDate === today)
    .reduce((sum, meal) => sum + meal.calories, 0)
  const remainingCalories = context.profile
    ? Math.max(0, Math.round(context.profile.dailyCalorieTarget - todayIntake))
    : null
  return planMcDonaldOrder(
    {
      openSession: (run) => withMcDonaldMcp(run, mcpConfig, undefined, trace?.emit),
      selectItems: selectItemsWithModel(config),
      reportActivity,
      reportTrace: trace,
    },
    message,
    remainingCalories,
  )
}

class AgentResponseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "AgentResponseError"
  }
}

function scheduleSessionConsolidation(userId: number, threadId: number) {
  const task = async () => {
    await consolidateAgentSession(userId, threadId)
  }

  try {
    after(task)
  } catch {
    // SSE stream callbacks may not retain Next's request lifecycle context.
    // Keep the task best-effort in that environment too.
    setTimeout(() => {
      void task()
    }, 0)
  }
}

function failureDetails(error: unknown, fallback: string) {
  const aiFailure = getPublicAiError(error)
  if (aiFailure.status !== 500 || error?.constructor?.name === "MissingAiCredentialError" || error?.constructor?.name === "AiProviderError") {
    return aiFailure
  }
  if (error instanceof AgentValidationError) return { message: error.message, status: 422 }
  if (error instanceof AgentNotFoundError) return { message: error.message, status: 404 }
  if (error instanceof SyntaxError) return { message: "请求 JSON 格式无效", status: 400 }
  if (error instanceof AgentResponseError) return { message: error.message, status: error.status }
  return { message: fallback, status: 500 }
}

type AgentChatResult = {
  thread: Awaited<ReturnType<typeof getAgentThread>>
  userMessage: Awaited<ReturnType<typeof appendAgentMessage>>
  assistantMessage: Awaited<ReturnType<typeof appendAgentMessage>>
  exercisePlan: Awaited<ReturnType<typeof getOwnedExercisePlan>>
  orderResult?: {
    orderId: string | null
    paymentLink: string | null
    itemsTotalCents: number | null
  } | null
  activity: AgentActivity[]
  trace: AgentTraceEvent[]
}

type AgentChatInternalResult = Omit<AgentChatResult, "trace">

type AgentChatOptions = {
  onActivity?: AgentActivityReporter
  onTrace?: (event: AgentTraceEvent) => void | Promise<void>
  onAnswerDelta?: (delta: string) => void | Promise<void>
}

async function runAgentChatInternal(
  input: AgentChatInput,
  trace: AgentTraceRecorder,
  options: AgentChatOptions,
): Promise<AgentChatInternalResult> {
  const recorder = createAgentActivityRecorder(options.onActivity)
  const user = await getCurrentUser()
  if (!user) throw new AgentNotFoundError("请先创建个人档案")
  const accountId = await getCurrentAccountId()

  // Resolve credentials before creating a thread so an unconfigured local
  // provider cannot leave behind a ghost conversation.
  const config = await getActiveAiProviderConfig(accountId ?? undefined)
  const threadId = await runAgentTraceStep(
    trace,
    { kind: "context", label: "定位当前对话线程", safeSummary: "已确认账户拥有该线程" },
    () => ensureAgentThread(user.userId, input.threadId, titleFromMessage(input.message)),
  )
  const exerciseMode = input.mode === "exercise-plan" || input.exercisePlanId !== null
  const exercisePlanId = input.exercisePlanId
  const currentExercisePlan = exercisePlanId === null
    ? null
    : await runAgentTraceStep(
        trace,
        { kind: "context", label: "读取当前运动计划", safeSummary: "已确认运动计划归属当前账户" },
        async () => {
          const plan = await getOwnedExercisePlan(user.userId, exercisePlanId)
          if (!plan) throw new AgentNotFoundError("运动计划不存在")
          return plan
        },
      )
  const userMessage = await runAgentTraceStep(
    trace,
    { kind: "step", label: "接收用户消息", safeSummary: "消息已写入当前线程" },
    () => appendAgentMessage(user.userId, threadId, "user", input.message),
  )
  const [context, sessionDigest, history] = await runAgentActivity(
    recorder.emit,
    {
      activityId: "agent-context",
      kind: "context",
      label: "整理饮食档案与对话上下文",
    },
    async () => {
      const parent = await trace.emit({
        eventType: "step.started",
        status: "running",
        label: "整理饮食档案与对话上下文",
        safeSummary: "并行读取当前回合所需的安全上下文",
      })
      const startedAt = Date.now()
      try {
        const [context, sessionDigest] = await Promise.all([
          runAgentTraceStep(
            trace,
            { kind: "context", parentId: parent.eventId, label: "读取饮食档案与近期记录" },
            () => getAgentContext(user.userId),
          ),
          runAgentTraceStep(
            trace,
            { kind: "context", parentId: parent.eventId, label: "读取会话摘要" },
            () => getSessionDigest(user.userId, threadId),
          ),
        ])
        const history = await runAgentTraceStep(
          trace,
          { kind: "context", parentId: parent.eventId, label: "读取当前线程尾部消息" },
          () => getAgentMessageHistory(user.userId, threadId, exerciseMode ? 10 : 24, sessionDigest?.coveredMessageId),
        )
        await trace.emit({
          eventType: "step.completed",
          status: "completed",
          label: "整理饮食档案与对话上下文",
          parentId: parent.eventId,
          durationMs: Date.now() - startedAt,
          safeSummary: "档案、摘要和尾部消息已就绪",
        })
        return [context, sessionDigest, history] as const
      } catch (error) {
        await trace.emit({
          eventType: "step.completed",
          status: "failed",
          label: "整理饮食档案与对话上下文",
          parentId: parent.eventId,
          durationMs: Date.now() - startedAt,
          safeSummary: "上下文读取失败",
        })
        throw error
      }
    },
  )

  if (hasExplicitOrderingIntent(input.message)) {
    // ADR-0004: the ordering turn gets a deterministic reply. The model only
    // sees menu data during item selection; the order result and payment
    // link never enter model context or persisted message content.
    const grant = await runAgentActivity(
      recorder.emit,
      {
        activityId: "ordering-policy",
        kind: "policy",
        label: "校验点餐意图与一次性建单权限",
      },
      () =>
        runAgentTraceStep(
          trace,
          { kind: "policy", label: "校验点餐意图与一次性建单权限", safeSummary: "当前消息命中明确点餐意图" },
          async () => issueOrderingGrant(true),
        ),
    )
    const mcpConfig = await runAgentTraceStep(
      trace,
      { kind: "context", label: "读取麦当劳工具配置", safeSummary: "服务端读取连接器，凭据不进入 Trace" },
      () => getMcDonaldMcpConfig(accountId ?? undefined),
    )
    const outcome = await runOrderingPlan(config, input.message, context, mcpConfig, recorder.emit, trace)
    if (outcome.status === "planned") {
      const execution = await executeMcDonaldOrder(
        (run) => withMcDonaldMcp(run, mcpConfig, undefined, trace.emit),
        grant,
        outcome.plan,
        recorder.emit,
      )
      const assistantMessage = await runAgentTraceStep(
        trace,
        { kind: "step", label: "保存 Agent 回复", safeSummary: "最终回复写入消息历史，支付入口不写入消息" },
        () =>
          appendAgentMessage(
            user.userId,
            threadId,
            "assistant",
            composeOrderedReply(outcome.plan, execution),
            execution.status === "created"
              ? {
                  order: {
                    orderId: execution.order.orderId,
                    itemsTotalCents: outcome.plan.itemsTotalCents,
                    itemCount: outcome.plan.items.length,
                    storeName: outcome.plan.storeName,
                  },
                }
              : {},
          ),
      )
      scheduleSessionConsolidation(user.userId, threadId)
      return {
        thread: await getAgentThread(user.userId, threadId),
        userMessage,
        assistantMessage,
        exercisePlan: null,
        orderResult:
          execution.status === "created"
            ? {
                orderId: execution.order.orderId,
                paymentLink: execution.order.paymentLink,
                itemsTotalCents: outcome.plan.itemsTotalCents,
              }
            : null,
        activity: recorder.snapshot(),
      }
    }
    const assistantMessage = await runAgentTraceStep(
      trace,
      { kind: "step", label: "保存 Agent 回复", safeSummary: "点餐阻塞原因已写入消息历史" },
      () => appendAgentMessage(user.userId, threadId, "assistant", composeOrderingReply(outcome)),
    )
    scheduleSessionConsolidation(user.userId, threadId)
    return {
      thread: await getAgentThread(user.userId, threadId),
      userMessage,
      assistantMessage,
      exercisePlan: null,
      orderResult: null,
      activity: recorder.snapshot(),
    }
  }

  const modelResult = await runAgentActivity(
    recorder.emit,
    {
      activityId: "health-agent-response",
      kind: "model",
      label: "健康 Agent 生成建议",
    },
    async () => {
      const modelStartedAt = Date.now()
      const modelStarted = await trace.emit({
        eventType: "model.started",
        status: "running",
        label: "健康 Agent 生成建议",
        safeSummary: "模型仅接收脱敏后的营养上下文与线程尾部",
      })
      const projector = createVisibleAnswerProjector(async (delta) => {
        await trace.emit({
          eventType: "answer.delta",
          status: "running",
          label: "答案增量",
          parentId: modelStarted.eventId,
          textDelta: delta,
        })
        await options.onAnswerDelta?.(delta)
      })
      try {
        const kernelResult = await runAgentKernel({
          config,
          instructions: buildAgentSystemPrompt(context, sessionDigest?.summary, {
            exerciseMode,
            exercisePlan: currentExercisePlan?.plan ?? null,
          }),
          messages: history.map((message) => ({
            role: message.role,
            content: redactSuppressedMemoryContent(message.content, context.suppressedMemoryContents),
          })),
          message: input.message,
          // S1 establishes the Kernel façade. Tool-call capability is enabled
          // only after S2 registers policy-gated tools and real Trace hooks.
          capabilities: { stream: true, toolCalls: false },
          reasoningEffort: exerciseMode && config.providerId === "stepfun" ? "low" : undefined,
          onTextDelta: projector.push,
        })
        await trace.emit({
          eventType: "step.completed",
          status: kernelResult.streamed ? "completed" : "fallback",
          label: "健康 Agent 生成建议",
          parentId: modelStarted.eventId,
          durationMs: Date.now() - modelStartedAt,
          safeSummary: kernelResult.streamed
            ? "AgentKernel 以 SSE 增量返回"
            : "提供商未提供可验证流式，已按完整响应回退",
        })
        return kernelResult.text
      } catch (error) {
        await trace.emit({
          eventType: "step.completed",
          status: "failed",
          label: "健康 Agent 生成建议",
          parentId: modelStarted.eventId,
          durationMs: Date.now() - modelStartedAt,
          safeSummary: "模型调用失败",
        })
        throw error
      }
    },
  )
  const rawText = modelResult
  if (!rawText) throw new AgentResponseError("AI 没有返回可读内容", 502)

  const parsed = extractAssistantResponse(sanitizeAssistantText(rawText))
  const generatedExercisePlan = exerciseMode ? parsed.exercisePlan : undefined
  const assistantMessage = await runAgentTraceStep(
    trace,
    {
      kind: "step",
      label: generatedExercisePlan ? "保存运动计划与 Agent 回复" : "保存 Agent 回复",
      safeSummary: generatedExercisePlan
        ? "最终回复和合法运动计划写入消息历史"
        : "最终回复和合法记忆候选写入消息历史",
    },
    () =>
      appendAgentMessage(user.userId, threadId, "assistant", parsed.visibleText, {
        memoryCandidates: parsed.candidates,
        usedMemoryIds: context.memories.map((memory) => memory.memoryId),
      }, {
        ...(generatedExercisePlan ? { exercisePlan: generatedExercisePlan } : {}),
      }),
  )
  await runAgentTraceStep(
    trace,
    { kind: "context", label: "更新记忆使用状态", safeSummary: "仅更新本回合实际命中的记忆" },
    () => markMemoriesUsed(user.userId, context.memories.map((memory) => memory.memoryId)),
  )
  scheduleSessionConsolidation(user.userId, threadId)
  const persistedExercisePlan = assistantMessage.exercisePlanId === null
    ? null
    : await getOwnedExercisePlan(user.userId, assistantMessage.exercisePlanId)

  return {
    thread: await getAgentThread(user.userId, threadId),
    userMessage,
    assistantMessage,
    exercisePlan: persistedExercisePlan,
    activity: recorder.snapshot(),
  }
}

async function runAgentChat(value: unknown, options: AgentChatOptions = {}): Promise<AgentChatResult> {
  const input = parseAgentChatInput(value)
  const trace = createAgentTraceRecorder(options.onTrace)
  await trace.emit({
    eventType: "run.started",
    status: "running",
    label: "开始 Agent 回合",
    safeSummary: "已建立当前回合 Trace",
  })
  try {
    const result = await runAgentChatInternal(input, trace, options)
    await trace.emit({
      eventType: "run.completed",
      status: "completed",
      label: "Agent 回合完成",
      safeSummary: "最终消息已保存，Trace 仅保留在当前回合",
    })
    return { ...result, trace: trace.snapshot() }
  } catch (error) {
    await trace.emit({
      eventType: "run.failed",
      status: "failed",
      label: "Agent 回合失败",
      safeSummary: "回合未完成，已保留已有消息状态",
    })
    throw error
  }
}

function activityStreamResponse(value: unknown) {
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
        } catch {
          closed = true
        }
      }

      try {
        const data = await runAgentChat(value, {
          onActivity: (activity) => send("activity", { activity }),
          onTrace: (event) => send("trace", event),
          onAnswerDelta: (textDelta) => send("delta", { textDelta }),
        })
        send("done", { data })
      } catch (error) {
        const failure = failureDetails(error, "Agent 对话失败")
        send("error", { error: failure.message })
      } finally {
        if (!closed) {
          closed = true
          controller.close()
        }
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > 64 * 1024) return apiError("消息请求过大", 413)

  let value: unknown
  try {
    value = await request.json()
  } catch {
    return apiError("请求 JSON 格式无效", 400)
  }

  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return activityStreamResponse(value)
  }

  try {
    return apiSuccess(await runAgentChat(value))
  } catch (error) {
    const failure = failureDetails(error, "Agent 对话失败")
    return apiError(failure.message, failure.status)
  }
}
