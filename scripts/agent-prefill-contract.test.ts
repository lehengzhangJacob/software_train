import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const page = readFileSync("src/app/agent/page.tsx", "utf8")
const workspace = readFileSync("src/components/agent/agent-workspace.tsx", "utf8")
const exercise = readFileSync("src/components/exercise/exercise-content.tsx", "utf8")
const insights = readFileSync("src/components/insights/insights-content.tsx", "utf8")
const reports = readFileSync("src/components/reports/reports-content.tsx", "utf8")
const mcdonald = readFileSync("src/components/mcdonald-settings-form.tsx", "utf8")

test("coach route accepts a bounded, editable prompt without changing chat APIs", () => {
  assert.match(page, /firstParam\(params\.prompt\)\?\.trim\(\)\.slice\(0, 4_000\)/)
  assert.match(page, /initialDraft=\{initialDraft\}/)
  assert.match(workspace, /initialDraft\?: string \| null/)
  assert.match(workspace, /useState\(initialDraft \?\? ""\)/)
  assert.match(workspace, /data-prefilled=\{initialDraft \? "true" : "false"\}/)
})

test("cross-page coach entries carry context as a URL prompt", () => {
  assert.match(exercise, /prompt=\$\{encodeURIComponent\(coachPrompt\)\}/)
  assert.match(insights, /prompt=\$\{encodeURIComponent\(/)
  assert.match(reports, /prompt=\$\{encodeURIComponent\(/)
  assert.match(mcdonald, /prompt=\$\{encodeURIComponent\(/)
})
