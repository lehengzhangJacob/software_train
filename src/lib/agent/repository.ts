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
  confirmedMemoryId: number | null
}

export interface AgentMessageView {
  messageId: number
  threadId: number
  role: AgentMessageRole
  content: string
  createdAt: string
  memoryCandidates: AgentMemoryCandidateView[]
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
      confirmedMemoryId: metadata.confirmedMemoryIds?.[String(index)] ?? null,
    })),
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
  metadata: AgentMessageMetadata = {}
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
    await tx.agentThread.update({ where: { threadId }, data: { updatedAt: new Date() } })
    return created
  })
  return toMessageView(message)
}

export async function getAgentMessageHistory(userId: number, threadId: number, limit = 24) {
  const owned = await prisma.agentThread.findFirst({ where: { userId, threadId }, select: { threadId: true } })
  if (!owned) throw new AgentNotFoundError()
  const messages = await prisma.agentMessage.findMany({
    where: { threadId },
    select: { role: true, content: true },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 40)),
  })
  return messages.reverse().map((message) => ({ role: message.role as AgentMessageRole, content: message.content }))
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
  const existingId = metadata.confirmedMemoryIds?.[String(candidateIndex)]
  if (existingId) {
    const existing = await prisma.memoryItem.findFirst({ where: { memoryId: existingId, userId } })
    if (existing) return existing
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.memoryItem.create({
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
    })

    const confirmedMemoryIds = {
      ...(metadata.confirmedMemoryIds ?? {}),
      [String(candidateIndex)]: created.memoryId,
    }
    await tx.agentMessage.update({
      where: { messageId: message.messageId },
      data: { metadataJson: JSON.stringify({ ...metadata, confirmedMemoryIds }) },
    })
    return created
  })
}
