import { apiError, apiSuccess } from "@/lib/api-response"
import {
  AgentNotFoundError,
  AgentValidationError,
  extractAssistantResponse,
  parseAgentChatInput,
  sanitizeAssistantText,
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
import { getTodayStr } from "@/lib/utils"
import { after } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function titleFromMessage(message: string) {
  const compact = message.replace(/\s+/g, " ").trim()
  return compact.length > 28 ? `${compact.slice(0, 28)}…` : compact
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
      openSession: (run) => withMcDonaldMcp(run, mcpConfig),
      selectItems: selectItemsWithModel(config),
      reportActivity,
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
  orderResult?: {
    orderId: string | null
    paymentLink: string | null
    itemsTotalCents: number | null
  } | null
  activity: AgentActivity[]
}

async function runAgentChat(value: unknown, onActivity?: AgentActivityReporter): Promise<AgentChatResult> {
  const input = parseAgentChatInput(value)
  const recorder = createAgentActivityRecorder(onActivity)
  const user = await getCurrentUser()
  if (!user) throw new AgentNotFoundError("请先创建个人档案")
  const accountId = await getCurrentAccountId()

  // Resolve credentials before creating a thread so an unconfigured local
  // provider cannot leave behind a ghost conversation.
  const config = await getActiveAiProviderConfig(accountId ?? undefined)
  const threadId = await ensureAgentThread(user.userId, input.threadId, titleFromMessage(input.message))
  const userMessage = await appendAgentMessage(user.userId, threadId, "user", input.message)
  const [context, sessionDigest, history] = await runAgentActivity(
    recorder.emit,
    {
      activityId: "agent-context",
      kind: "context",
      label: "整理饮食档案与对话上下文",
    },
    async () => {
      const [context, sessionDigest] = await Promise.all([
        getAgentContext(user.userId),
        getSessionDigest(user.userId, threadId),
      ])
      const history = await getAgentMessageHistory(user.userId, threadId, 24, sessionDigest?.coveredMessageId)
      return [context, sessionDigest, history] as const
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
      async () => issueOrderingGrant(true),
    )
    const mcpConfig = await getMcDonaldMcpConfig(accountId ?? undefined)
    const outcome = await runOrderingPlan(config, input.message, context, mcpConfig, recorder.emit)
    if (outcome.status === "planned") {
      const execution = await executeMcDonaldOrder((run) => withMcDonaldMcp(run, mcpConfig), grant, outcome.plan, recorder.emit)
      const assistantMessage = await appendAgentMessage(
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
      )
      scheduleSessionConsolidation(user.userId, threadId)
      return {
        thread: await getAgentThread(user.userId, threadId),
        userMessage,
        assistantMessage,
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
    const assistantMessage = await appendAgentMessage(
      user.userId,
      threadId,
      "assistant",
      composeOrderingReply(outcome),
    )
    scheduleSessionConsolidation(user.userId, threadId)
    return {
      thread: await getAgentThread(user.userId, threadId),
      userMessage,
      assistantMessage,
      orderResult: null,
      activity: recorder.snapshot(),
    }
  }

  const result = await runAgentActivity(
    recorder.emit,
    {
      activityId: "health-agent-response",
      kind: "model",
      label: "健康 Agent 生成建议",
    },
    () =>
      requestAiChatCompletion(config, {
        messages: [
          { role: "system", content: buildAgentSystemPrompt(context, sessionDigest?.summary) },
          ...history.map((message) => ({
            role: message.role,
            content: redactSuppressedMemoryContent(message.content, context.suppressedMemoryContents),
          })),
        ],
        temperature: 0.4,
        max_tokens: 1_500,
      }),
  )
  const rawText = getAssistantText(result)
  if (!rawText) throw new AgentResponseError("AI 没有返回可读内容", 502)

  const parsed = extractAssistantResponse(sanitizeAssistantText(rawText))
  const assistantMessage = await appendAgentMessage(user.userId, threadId, "assistant", parsed.visibleText, {
    memoryCandidates: parsed.candidates,
    usedMemoryIds: context.memories.map((memory) => memory.memoryId),
  })
  await markMemoriesUsed(user.userId, context.memories.map((memory) => memory.memoryId))
  scheduleSessionConsolidation(user.userId, threadId)

  return {
    thread: await getAgentThread(user.userId, threadId),
    userMessage,
    assistantMessage,
    activity: recorder.snapshot(),
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
        const data = await runAgentChat(value, (activity) => send("activity", { activity }))
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
