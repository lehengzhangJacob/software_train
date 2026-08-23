import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync("scripts/seed-cloud-demo.mjs", "utf8")

test("demo seed defaults to a fourteen-day append-only window", () => {
  assert.match(source, /dataWindowDays = Number\(process\.env\.DEMO_DATA_WINDOW_DAYS \|\| 14\)/)
  assert.match(source, /activityDays = Number\(process\.env\.DEMO_ACTIVITY_DAYS \|\| dataWindowDays\)/)
  assert.match(source, /for \(const daysAgo of dayOffsets\(dataWindowDays\)\)/)
  assert.match(source, /for \(const daysAgo of dayOffsets\(activityDays\)\)/)
  assert.match(source, /existingDates\.has\(activityDate\)/)
})

test("demo seed stays idempotent and scopes evidence to the selected contract", () => {
  assert.match(source, /record\.notes === item\.notes/)
  assert.match(source, /content === item\.content/)
  assert.match(source, /DEMO_EVIDENCE_DIR/)
  assert.match(source, /userScope: "authenticated account selected by DEMO_LOGIN; other accounts untouched"/)
  assert.match(source, /directDatabaseWrite: false/)
})

test("verification proves the activity window and keeps exercise cadence configurable", () => {
  assert.match(source, /expectedActivityDays: activityDays/)
  assert.match(source, /expectedExerciseDays: exerciseDays/)
  assert.match(source, /activity\.activities\.length >= activityDays/)
  assert.match(source, /exerciseDays = Number\(process\.env\.DEMO_EXERCISE_DAYS \|\| Math\.min\(dataWindowDays, 7\)\)/)
})
