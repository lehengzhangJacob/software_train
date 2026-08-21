import "server-only"

import type { Prisma } from "@prisma/client"
import type { MemoryCreateInput, MemoryQueryStatus, MemoryUpdateInput } from "@/lib/memory/contracts"
import { isMemoryEligible } from "@/lib/memory/contracts"
import { prisma } from "@/lib/prisma"

export class MemoryNotFoundError extends Error {
  constructor() {
    super("记忆不存在")
    this.name = "MemoryNotFoundError"
  }
}

const publicMemorySelect = {
  memoryId: true,
  sourceMessageId: true,
  category: true,
  content: true,
  sourceKind: true,
  sourceRef: true,
  confidence: true,
  importance: true,
  status: true,
  isUserConfirmed: true,
  userEditedAt: true,
  lastUsedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MemoryItemSelect

export async function listMemoryItems(userId: number, status: MemoryQueryStatus) {
  return prisma.memoryItem.findMany({
    where: {
      userId,
      ...(status === "all" ? {} : { status }),
    },
    select: publicMemorySelect,
    orderBy: [
      { status: "asc" },
      { isUserConfirmed: "desc" },
      { importance: "desc" },
      { updatedAt: "desc" },
    ],
  })
}

export async function createUserMemory(userId: number, input: MemoryCreateInput) {
  const now = new Date()
  return prisma.memoryItem.create({
    data: {
      userId,
      category: input.category,
      content: input.content,
      sourceKind: "user",
      confidence: 1,
      importance: input.importance,
      status: "active",
      isUserConfirmed: true,
      userEditedAt: now,
      expiresAt: input.expiresAt,
    },
    select: publicMemorySelect,
  })
}

export async function updateUserMemory(userId: number, input: MemoryUpdateInput) {
  const owned = await prisma.memoryItem.findFirst({
    where: { memoryId: input.memoryId, userId },
    select: { memoryId: true },
  })
  if (!owned) throw new MemoryNotFoundError()

  const userCorrected = input.content !== undefined || input.category !== undefined
  return prisma.memoryItem.update({
    where: { memoryId: owned.memoryId },
    data: {
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.content === undefined ? {} : { content: input.content }),
      ...(input.importance === undefined ? {} : { importance: input.importance }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
      ...(userCorrected ? { isUserConfirmed: true, userEditedAt: new Date(), confidence: 1 } : {}),
    },
    select: publicMemorySelect,
  })
}

export async function deleteUserMemory(userId: number, memoryId: number) {
  const result = await prisma.memoryItem.deleteMany({ where: { memoryId, userId } })
  if (result.count === 0) throw new MemoryNotFoundError()
}

export async function getRelevantMemories(userId: number, limit = 20, now = new Date()) {
  const memories = await prisma.memoryItem.findMany({
    where: {
      userId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: publicMemorySelect,
    orderBy: [
      { isUserConfirmed: "desc" },
      { importance: "desc" },
      { updatedAt: "desc" },
    ],
    take: Math.max(1, Math.min(limit, 50)),
  })
  return memories.filter((memory) => isMemoryEligible(memory, now))
}

export async function getDisabledMemoryContents(userId: number, limit = 100) {
  const memories = await prisma.memoryItem.findMany({
    where: { userId, status: "disabled" },
    select: { content: true },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 200)),
  })
  return memories.map((memory) => memory.content)
}

export async function markMemoriesUsed(userId: number, memoryIds: number[], usedAt = new Date()) {
  if (memoryIds.length === 0) return
  await prisma.memoryItem.updateMany({
    where: { userId, memoryId: { in: memoryIds } },
    data: { lastUsedAt: usedAt },
  })
}
