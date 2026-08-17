import { apiError, apiSuccess } from "@/lib/api-response"
import {
  AgentNotFoundError,
  AgentValidationError,
  extractAssistantResponse,
  parseAgentChatInput,
  sanitizeAssistantText,
} from "@/lib/agent/contracts"
import {
  appendAgentMessage,
  ensureAgentThread,
  getAgentMessageHistory,
  getAgentThread,
} from "@/lib/agent/repository"
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
import { getCurrentUser } from "@/lib/current-user"
import { getAssistantText, requestAiChatCompletion } from "@/lib/ai/client"
import { getPublicAiError } from "@/lib/ai/errors"
import { getActiveAiProviderConfig, type ResolvedAiProviderConfig } from "@/lib/ai/settings"
import { markMemoriesUsed } from "@/lib/memory/repository"
import { withMcDonaldMcp } from "@/lib/mcp/mcdonalds-client"
import { getTodayStr } from "@/lib/utils"

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
      openSession: (run) => withMcDonaldMcp(run),
      selectItems: selectItemsWithModel(config),
    },
    message,
    remainingCalories,
  )
}

function requestFailure(error: unknown, fallback: string) {
  if (error instanceof AgentValidationError) return apiError(error.message, 422)
  if (error instanceof AgentNotFoundError) return apiError(error.message, 404)
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  return apiError(fallback, 500)
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > 64 * 1024) return apiError("消息请求过大", 413)

    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const input = parseAgentChatInput(await request.json())
    // Resolve credentials before creating a thread so an unconfigured local
    // provider cannot leave behind a ghost conversation.
    const config = await getActiveAiProviderConfig()
    const threadId = await ensureAgentThread(user.userId, input.threadId, titleFromMessage(input.message))
    const userMessage = await appendAgentMessage(user.userId, threadId, "user", input.message)
    const [context, history] = await Promise.all([
      getAgentContext(user.userId),
      getAgentMessageHistory(user.userId, threadId),
    ])

    if (hasExplicitOrderingIntent(input.message)) {
      // ADR-0004: the ordering turn gets a deterministic reply. The model only
      // sees menu data during item selection; the order result and payment
      // link never enter model context or persisted message content.
      const grant = issueOrderingGrant(true)
      const outcome = await runOrderingPlan(config, input.message, context)
      if (outcome.status === "planned") {
        const execution = await executeMcDonaldOrder((run) => withMcDonaldMcp(run), grant, outcome.plan)
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
        return apiSuccess({
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
        })
      }
      const assistantMessage = await appendAgentMessage(
        user.userId,
        threadId,
        "assistant",
        composeOrderingReply(outcome),
      )
      return apiSuccess({
        thread: await getAgentThread(user.userId, threadId),
        userMessage,
        assistantMessage,
        orderResult: null,
      })
    }

    const result = await requestAiChatCompletion(config, {
      messages: [
        { role: "system", content: buildAgentSystemPrompt(context) },
        ...history.map((message) => ({ role: message.role, content: message.content })),
      ],
      temperature: 0.4,
      max_tokens: 1_500,
    })
    const rawText = getAssistantText(result)
    if (!rawText) return apiError("AI 没有返回可读内容", 502)

    const parsed = extractAssistantResponse(sanitizeAssistantText(rawText))
    const assistantMessage = await appendAgentMessage(user.userId, threadId, "assistant", parsed.visibleText, {
      memoryCandidates: parsed.candidates,
      usedMemoryIds: context.memories.map((memory) => memory.memoryId),
    })
    await markMemoriesUsed(user.userId, context.memories.map((memory) => memory.memoryId))

    return apiSuccess({
      thread: await getAgentThread(user.userId, threadId),
      userMessage,
      assistantMessage,
    })
  } catch (error) {
    const aiFailure = getPublicAiError(error)
    if (aiFailure.status !== 500 || error?.constructor?.name === "MissingAiCredentialError" || error?.constructor?.name === "AiProviderError") {
      return apiError(aiFailure.message, aiFailure.status)
    }
    return requestFailure(error, "Agent 对话失败")
  }
}
