import "server-only"

import type { Prisma } from "@prisma/client"
import {
  AgentMemoryCandidateError,
  AgentNotFoundError,
  type AgentMessageMetadata,
  type AgentMessageRole,
  type MemoryCandidate,
  parseAgentMessageMetadata,
} from "@/lib/agent/contracts"
import { saveAgentExercisePlanInTransaction } from "@/lib/exercise/plan-repository"
import type { ExercisePlanPayload } from "@/lib/exercise/plan-contracts"
import { prisma } from "@/lib/prisma"

const publicMessageSelect = {
  messageId: true,
  threadId: true,
  role: true,
  content: true,
  metadataJson: true,
  createdAt: true,
} satisfies Prisma.AgentMessageSelect

const publicThreadSummarySelect = {
  threadId: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { messages: true } },
} satisfies Prisma.AgentThreadSelect

export interface AgentMemoryCandidateView extends MemoryCandidate {
  memoryId: number | null
}

export interface AgentMessageView {
  messageId: number
  threadId: number
  role: AgentMessageRole
  content: string
  createdAt: string
  memoryCandidates: AgentMemoryCandidateView[]
  exercisePlanId: number | null
}

export interface AgentThreadSummary {
  threadId: number
  title: string
  status: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface AgentThreadView extends AgentThreadSummary {
  messages: AgentMessageView[]
}

function toMessageView(message: Prisma.AgentMessageGetPayload<{ select: typeof publicMessageSelect }>): AgentMessageView {
  const metadata = parseAgentMessageMetadata(message.metadataJson)
  return {
    messageId: message.messageId,
    threadId: message.threadId,
    role: message.role as AgentMessageRole,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    memoryCandidates: (metadata.memoryCandidates ?? []).map((candidate, index) => ({
      ...candidate,
      memoryId: metadata.memoryIds?.[String(index)] ?? null,
    })),
    exercisePlanId: metadata.exercisePlanId ?? null,
  }
}

function toThreadSummary(thread: Prisma.AgentThreadGetPayload<{ select: typeof publicThreadSummarySelect }>): AgentThreadSummary {
  return {
    threadId: thread.threadId,
    title: thread.title,
    status: thread.status,
    messageCount: thread._count.messages,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  }
}

export async function listAgentThreads(userId: number): Promise<AgentThreadSummary[]> {
  const threads = await prisma.agentThread.findMany({
    where: { userId },
    select: publicThreadSummarySelect,
    orderBy: { updatedAt: "desc" },
    take: 50,
  })
  return threads.map(toThreadSummary)
}

export async function createAgentThread(userId: number, title: string): Promise<AgentThreadSummary> {
  const thread = await prisma.agentThread.create({
    data: { userId, title },
    select: publicThreadSummarySelect,
  })
  return toThreadSummary(thread)
}

export async function getAgentThread(userId: number, threadId: number): Promise<AgentThreadView> {
  const thread = await prisma.agentThread.findFirst({
    where: { userId, threadId },
    select: {
      ...publicThreadSummarySelect,
      messages: {
        select: publicMessageSelect,
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  })
  if (!thread) throw new AgentNotFoundError()
  return {
    ...toThreadSummary(thread),
    messages: thread.messages.map(toMessageView),
  }
}

export async function ensureAgentThread(userId: number, threadId: number | null, title: string) {
  if (threadId !== null) {
    const thread = await prisma.agentThread.findFirst({ where: { userId, threadId }, select: { threadId: true } })
    if (!thread) throw new AgentNotFoundError()
    return thread.threadId
  }
  const created = await prisma.agentThread.create({ data: { userId, title }, select: { threadId: true } })
  return created.threadId
}

export async function appendAgentMessage(
  userId: number,
  threadId: number,
  role: AgentMessageRole,
  content: string,
  metadata: AgentMessageMetadata = {},
  artifacts: { exercisePlan?: ExercisePlanPayload } = {},
): Promise<AgentMessageView> {
  const message = await prisma.$transaction(async (tx) => {
    const owned = await tx.agentThread.findFirst({ where: { threadId, userId }, select: { threadId: true } })
    if (!owned) throw new AgentNotFoundError()

    const created = await tx.agentMessage.create({
      data: {
        threadId,
        role,
        content,
        metadataJson: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      },
      select: publicMessageSelect,
    })

    let persistedMetadata = metadata
    if (role === "assistant" && metadata.memoryCandidates?.length) {
      const memoryIds = await materializeMemoryCandidates(tx, userId, metadata.memoryCandidates, {
        sourceKind: "agent_inference",
        sourceMessageId: created.messageId,
        sourceRef: `thread:${threadId}/message:${created.messageId}`,
      })
      persistedMetadata = { ...persistedMetadata, memoryIds }
    }
    if (role === "assistant" && artifacts.exercisePlan) {
      const plan = await saveAgentExercisePlanInTransaction(tx, {
        userId,
        threadId,
        sourceMessageId: created.messageId,
        payload: artifacts.exercisePlan,
      })
      persistedMetadata = { ...persistedMetadata, exercisePlanId: plan.planId }
    }
    if (Object.keys(persistedMetadata).length > 0) {
      await tx.agentMessage.update({
        where: { messageId: created.messageId },
        data: { metadataJson: JSON.stringify(persistedMetadata) },
      })
    }

    await tx.agentThread.update({ where: { threadId }, data: { updatedAt: new Date() } })
    return {
      ...created,
      metadataJson: Object.keys(persistedMetadata).length > 0 ? JSON.stringify(persistedMetadata) : null,
    }
  })
  return toMessageView(message)
}

type DigestMemorySource = {
  sourceKind: "agent_inference" | "session_digest"
  sourceMessageId?: number | null
  sourceRef: string
}

async function materializeMemoryCandidates(
  tx: Prisma.TransactionClient,
  userId: number,
  candidates: MemoryCandidate[],
  source: DigestMemorySource,
) {
  const memoryIds: Record<string, number> = {}

  for (const [index, candidate] of candidates.entries()) {
    const matches = await tx.memoryItem.findMany({
      where: {
        userId,
        category: candidate.category,
        content: candidate.content,
      },
      select: { memoryId: true, status: true },
      orderBy: { memoryId: "asc" },
    })

    // A disabled exact match is a user veto. It must win over an active
    // duplicate so background consolidation cannot resurrect it.
    if (matches.some((memory) => memory.status === "disabled")) continue

    const active = matches.find((memory) => memory.status === "active")
    if (active) {
      memoryIds[String(index)] = active.memoryId
      continue
    }

    const memory = await tx.memoryItem.create({
      data: {
        userId,
        sourceMessageId: source.sourceMessageId ?? null,
        category: candidate.category,
        content: candidate.content,
        sourceKind: source.sourceKind,
        sourceRef: source.sourceRef,
        confidence: candidate.confidence,
        importance: candidate.importance,
        status: "active",
        isUserConfirmed: false,
      },
      select: { memoryId: true },
    })
    memoryIds[String(index)] = memory.memoryId
  }

  return memoryIds
}

export async function getAgentMessageHistory(userId: number, threadId: number, limit = 24, afterMessageId?: number) {
  const owned = await prisma.agentThread.findFirst({ where: { userId, threadId }, select: { threadId: true } })
  if (!owned) throw new AgentNotFoundError()
  const messages = await prisma.agentMessage.findMany({
    where: { threadId, ...(afterMessageId !== undefined ? { messageId: { gt: afterMessageId } } : {}) },
    select: { role: true, content: true },
    orderBy: [{ createdAt: "desc" }, { messageId: "desc" }],
    take: Math.max(1, Math.min(limit, 40)),
  })
  return messages.reverse().map((message) => ({ role: message.role as AgentMessageRole, content: message.content }))
}

export interface AgentConsolidationMessage {
  messageId: number
  role: AgentMessageRole
  content: string
  createdAt: string
}

export async function getAgentMessagesForConsolidation(
  userId: number,
  threadId: number,
  afterMessageId?: number,
  limit = 48,
): Promise<AgentConsolidationMessage[]> {
  const owned = await prisma.agentThread.findFirst({ where: { userId, threadId }, select: { threadId: true } })
  if (!owned) throw new AgentNotFoundError()
  const messages = await prisma.agentMessage.findMany({
    where: { threadId, ...(afterMessageId !== undefined ? { messageId: { gt: afterMessageId } } : {}) },
    select: { messageId: true, role: true, content: true, createdAt: true },
    orderBy: { messageId: "asc" },
    take: Math.max(1, Math.min(limit, 48)),
  })
  return messages.map((message) => ({
    messageId: message.messageId,
    role: message.role as AgentMessageRole,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }))
}

export interface SessionDigestRecord {
  summary: string
  coveredMessageId: number
}

export async function getSessionDigest(userId: number, threadId: number): Promise<SessionDigestRecord | null> {
  const owned = await prisma.agentThread.findFirst({ where: { userId, threadId }, select: { threadId: true } })
  if (!owned) throw new AgentNotFoundError()
  const digest = await prisma.agentSessionDigest.findUnique({
    where: { threadId },
    select: { summary: true, coveredMessageId: true },
  })
  return digest ?? null
}

export async function upsertSessionDigest(
  userId: number,
  threadId: number,
  coveredMessageId: number,
  summary: string,
  memoryCandidates: MemoryCandidate[] = [],
) {
  const owned = await prisma.agentThread.findFirst({ where: { userId, threadId }, select: { threadId: true } })
  if (!owned) throw new AgentNotFoundError()
  const trimmed = summary.trim().slice(0, 4_000)
  if (!trimmed) throw new Error("会话摘要不能为空")
  if (!Number.isInteger(coveredMessageId) || coveredMessageId <= 0) throw new Error("会话摘要水位线无效")

  return prisma.$transaction(async (tx) => {
    const existing = await tx.agentSessionDigest.findUnique({
      where: { threadId },
      select: { digestId: true, coveredMessageId: true },
    })
    // 水位线单调递增：并发或乱序整理不得回退覆盖范围
    if (existing && coveredMessageId <= existing.coveredMessageId) return false
    if (existing) {
      await tx.agentSessionDigest.update({ where: { digestId: existing.digestId }, data: { coveredMessageId, summary: trimmed } })
    } else {
      await tx.agentSessionDigest.create({ data: { threadId, coveredMessageId, summary: trimmed } })
    }
    if (memoryCandidates.length > 0) {
      await materializeMemoryCandidates(tx, userId, memoryCandidates, {
        sourceKind: "session_digest",
        sourceRef: `thread:${threadId}/digest:${coveredMessageId}`,
      })
    }
    return true
  })
}

export async function deleteAgentThread(userId: number, threadId: number) {
  const result = await prisma.agentThread.deleteMany({ where: { userId, threadId } })
  if (result.count === 0) throw new AgentNotFoundError()
}

export async function confirmAgentMemory(userId: number, messageId: number, candidateIndex: number) {
  const message = await prisma.agentMessage.findFirst({
    where: { messageId, role: "assistant", thread: { userId } },
    select: { messageId: true, threadId: true, metadataJson: true },
  })
  if (!message) throw new AgentMemoryCandidateError()

  const metadata = parseAgentMessageMetadata(message.metadataJson)
  const candidate = metadata.memoryCandidates?.[candidateIndex]
  if (!candidate) throw new AgentMemoryCandidateError()
  const existingId = metadata.memoryIds?.[String(candidateIndex)]
  if (existingId) {
    const existing = await prisma.memoryItem.findFirst({ where: { memoryId: existingId, userId } })
    if (existing) {
      if (existing.isUserConfirmed) return existing
      return prisma.memoryItem.update({
        where: { memoryId: existing.memoryId },
        data: { isUserConfirmed: true, userEditedAt: new Date() },
      })
    }
  }

  return prisma.$transaction(async (tx) => {
    const matches = await tx.memoryItem.findMany({
      where: { userId, category: candidate.category, content: candidate.content },
      orderBy: { memoryId: "asc" },
    })
    const disabled = matches.find((memory) => memory.status === "disabled")
    const active = matches.find((memory) => memory.status === "active")
    const memory = disabled ?? (active
      ? await tx.memoryItem.update({
          where: { memoryId: active.memoryId },
          data: { isUserConfirmed: true, userEditedAt: new Date() },
        })
      : await tx.memoryItem.create({
          data: {
            userId,
            sourceMessageId: message.messageId,
            category: candidate.category,
            content: candidate.content,
            sourceKind: "agent_inference",
            sourceRef: `thread:${message.threadId}/message:${message.messageId}`,
            confidence: candidate.confidence,
            importance: candidate.importance,
            status: "active",
            isUserConfirmed: true,
            userEditedAt: new Date(),
          },
        }))

    const memoryIds = {
      ...(metadata.memoryIds ?? {}),
      [String(candidateIndex)]: memory.memoryId,
    }
    await tx.agentMessage.update({
      where: { messageId: message.messageId },
      data: { metadataJson: JSON.stringify({ ...metadata, memoryIds }) },
    })
    return memory
  })
}
