import type { WebSearchSource } from "@/lib/agent/search/web-search"

export function appendWebSearchSources(text: string, sources: readonly WebSearchSource[]) {
  const unique = sources.filter((source, index, all) =>
    source.url && all.findIndex((candidate) => candidate.url === source.url) === index,
  ).slice(0, 5)
  if (unique.length === 0) return text
  const visible = unique.filter((source) => !text.includes(source.url))
  if (visible.length === 0) return text
  const lines = visible.map((source, index) => {
    const label = source.title.replace(/[\[\]()<>{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || `来源 ${index + 1}`
    return `${index + 1}. [${label}](${source.url})`
  })
  return `${text.trim()}\n\n参考来源：\n${lines.join("\n")}`
}
