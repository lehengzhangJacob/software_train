import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync("src/components/exercise/exercise-content.tsx", "utf8")

test("exercise plan renders an accessible checkbox for every step", () => {
  assert.match(source, /type="checkbox"/)
  assert.match(source, /aria-label=\{`完成 \$\{step\.name\}`\}/)
  assert.match(source, /completedStepOrders\.includes\(step\.order\)/)
})

test("exercise plan shows progress and completed state", () => {
  assert.match(source, /完成 \$\{progress\.completedCount\}\/\$\{progress\.totalSteps\}/)
  assert.match(source, /计划已完成/)
  assert.match(source, /所有步骤完成后计划会标记为已完成/)
})

test("checklist toggle persists through the plans API and rolls back on failure", () => {
  assert.match(source, /fetch\("\/api\/exercise\/plans"/)
  assert.match(source, /method: "PATCH"/)
  assert.match(source, /setProgress\(result\.data\.plan\.progress\)/)
  assert.match(source, /setProgress\(previous\)/)
})
