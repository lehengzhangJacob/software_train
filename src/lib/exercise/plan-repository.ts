import "server-only"

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  parseStoredExercisePlan,
  serializeExercisePlan,
  type ExercisePlanPayload,
} from "@/lib/exercise/plan-contracts"
import {
  summarizeExercisePlanProgress,
  type ExercisePlanProgress,
} from "@/lib/exercise/progress"

const planSelect = {
  planId: true,
  userId: true,
  threadId: true,
  sourceMessageId: true,
  legacySuggestionId: true,
  planDate: true,
  revision: true,
  sourceKind: true,
  status: true,
  title: true,
  goal: true,
  totalMinutes: true,
  intensity: true,
  planJson: true,
  createdAt: true,
  updatedAt: true,
  stepProgress: {
    select: {
      stepOrder: true,
    },
  },
} satisfies Prisma.AgentExercisePlanSelect

type PlanRow = Prisma.AgentExercisePlanGetPayload<{ select: typeof planSelect }>

export type ExercisePlanView = {
  planId: number
  userId: number
  threadId: number | null
  sourceMessageId: number | null
  legacySuggestionId: number | null
  planDate: string
  revision: number
  sourceKind: string
  status: string
  title: string
  goal: string
  totalMinutes: number
  intensity: string
  plan: ExercisePlanPayload
  progress: ExercisePlanProgress
  createdAt: string
  updatedAt: string
}

export type ExercisePlanProjection = {
  date: string
  current: ExercisePlanView | null
  history: ExercisePlanView[]
  legacy: ExercisePlanView[]
}

function toPlanView(row: PlanRow): ExercisePlanView {
  const plan = parseStoredExercisePlan(row.planJson)
  return {
    planId: row.planId,
    userId: row.userId,
    threadId: row.threadId,
    sourceMessageId: row.sourceMessageId,
    legacySuggestionId: row.legacySuggestionId,
    planDate: row.planDate,
    revision: row.revision,
    sourceKind: row.sourceKind,
    status: row.status,
    title: row.title,
    goal: row.goal,
    totalMinutes: row.totalMinutes,
    intensity: row.intensity,
    plan,
    progress: summarizeExercisePlanProgress(plan.steps, row.stepProgress.map((item) => item.stepOrder)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function setExercisePlanStepProgress(
  userId: number,
  planId: number,
  stepOrder: number,
  completed: boolean,
) {
  const row = await prisma.agentExercisePlan.findFirst({
    where: { userId, planId },
    select: { planId: true, planJson: true },
  })
  if (!row) return null

  const plan = parseStoredExercisePlan(row.planJson)
  if (!plan.steps.some((step) => step.order === stepOrder)) {
    throw new Error("步骤不存在")
  }

  if (completed) {
    await prisma.agentExercisePlanStepProgress.upsert({
      where: { uq_agent_plan_step_progress: { planId, stepOrder } },
      create: { planId, stepOrder },
      update: { completedAt: new Date() },
    })
  } else {
    await prisma.agentExercisePlanStepProgress.deleteMany({ where: { planId, stepOrder } })
  }

  return getOwnedExercisePlan(userId, planId)
}

export async function getExercisePlanProjection(userId: number, date: string): Promise<ExercisePlanProjection> {
  const rows = await prisma.agentExercisePlan.findMany({
    where: { userId, planDate: date },
    select: planSelect,
    orderBy: [{ revision: "desc" }, { createdAt: "desc" }],
  })
  const views = rows.map(toPlanView)
  return {
    date,
    current: views.find((plan) => plan.sourceKind === "agent" && plan.status === "active") ?? null,
    history: views.filter((plan) => plan.sourceKind === "agent" && plan.status !== "active"),
    legacy: views.filter((plan) => plan.sourceKind === "legacy_suggestion"),
  }
}

export async function getOwnedExercisePlan(userId: number, planId: number) {
  const row = await prisma.agentExercisePlan.findFirst({
    where: { userId, planId },
    select: planSelect,
  })
  return row ? toPlanView(row) : null
}

export type SaveAgentExercisePlanInput = {
  userId: number
  threadId: number | null
  sourceMessageId: number | null
  payload: ExercisePlanPayload
}

export async function saveAgentExercisePlanInTransaction(
  tx: Prisma.TransactionClient,
  input: SaveAgentExercisePlanInput,
) {
  const latest = await tx.agentExercisePlan.findFirst({
    where: {
      userId: input.userId,
      planDate: input.payload.planDate,
      sourceKind: "agent",
    },
    select: { revision: true },
    orderBy: { revision: "desc" },
  })
  const revision = (latest?.revision ?? 0) + 1

  await tx.agentExercisePlan.updateMany({
    where: {
      userId: input.userId,
      planDate: input.payload.planDate,
      sourceKind: "agent",
      status: "active",
    },
    data: { status: "superseded" },
  })

  const row = await tx.agentExercisePlan.create({
    data: {
      userId: input.userId,
      threadId: input.threadId,
      sourceMessageId: input.sourceMessageId,
      planDate: input.payload.planDate,
      revision,
      sourceKind: "agent",
      status: "active",
      title: input.payload.title,
      goal: input.payload.goal,
      totalMinutes: input.payload.totalMinutes,
      intensity: input.payload.intensity,
      planJson: serializeExercisePlan(input.payload),
    },
    select: planSelect,
  })
  return toPlanView(row)
}

export async function saveAgentExercisePlan(input: SaveAgentExercisePlanInput) {
  return prisma.$transaction((tx) => saveAgentExercisePlanInTransaction(tx, input))
}
