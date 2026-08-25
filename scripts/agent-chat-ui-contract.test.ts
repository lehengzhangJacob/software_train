import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync("src/components/agent/agent-workspace.tsx", "utf8")

test("chat composer stays outside the message scroll region", () => {
  assert.match(source, /h-\[min\(42\.5rem,calc\(100dvh-9rem-var\(--keyboard-inset,0px\)\)\)\]/)
  assert.match(source, /lg:grid-cols-\[minmax\(15rem,\.58fr\)_minmax\(0,1\.72fr\)\]/)
  assert.match(source, /className="order-1 flex h-full min-h-0 min-w-0 flex-col overflow-hidden/)
  assert.match(source, /className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain/)
  assert.match(source, /data-testid="agent-composer"/)
  assert.match(source, /className="shrink-0 border-t border-border\/70/)
  assert.match(source, /data-testid="agent-streaming-answer"/)
})

test("the message viewport owns scrolling while the composer remains a sibling", () => {
  const messageViewport = source.indexOf('className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain')
  const composer = source.indexOf('data-testid="agent-composer"')

  assert.ok(messageViewport >= 0)
  assert.ok(composer > messageViewport)
  assert.ok(source.slice(messageViewport, composer).includes("AgentTracePanel"))
  assert.ok(source.slice(composer).includes("shrink-0"))
})

test("meal receipts are projected from verified message metadata", () => {
  assert.match(source, /mealRecordId: number \| null/)
  assert.match(source, /mealRecord: MealRecordResult \| null/)
  assert.match(source, /Agent 已核验餐食记录/)
  assert.match(source, /查看饮食记录/)
})

test("the larger chat surface keeps readable message sizing", () => {
  assert.match(source, /max-w-\[min\(50rem,92%\)\]/)
  assert.match(source, /rounded-lg px-5 py-4 text-base leading-7/)
  assert.match(source, /min-h-14 min-w-0 flex-1 resize-none/)
})
