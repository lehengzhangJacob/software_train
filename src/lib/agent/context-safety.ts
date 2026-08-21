import { isMemoryEligible } from "@/lib/memory/contracts"

export function filterEligibleMemories<T extends { status: string; expiresAt: Date | null }>(
  memories: readonly T[],
  now = new Date(),
) {
  return memories.filter((memory) => isMemoryEligible(memory, now))
}

export function redactSuppressedMemoryContent(value: string, suppressedContents: readonly string[]) {
  return [...new Set(suppressedContents.map((content) => content.trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .reduce((result, content) => result.split(content).join("[已停用记忆已移除]"), value)
}

export function buildAgentDateInstruction(today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error("Agent date context must use an ISO local date")
  }
  return `应用今天的本地日期：${today}。所有“今天/昨天/明天”等相对日期都以此为基准。`
}
