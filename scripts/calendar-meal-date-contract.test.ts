import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { parseDate } from "../src/lib/validation"

const calendarSource = fs.readFileSync("src/components/calendar/calendar-content.tsx", "utf8")
const mealsPageSource = fs.readFileSync("src/app/meals/page.tsx", "utf8")
const mealsSource = fs.readFileSync("src/components/food/meals-content.tsx", "utf8")

test("calendar handoff carries the selected date", () => {
  assert.match(calendarSource, /href=\{`\/meals\?date=\$\{encodeURIComponent\(currentDate\)\}`\}/)
})

test("meals page accepts only valid date query values and falls back safely", () => {
  assert.match(mealsPageSource, /searchParams\?: Promise<Record<string, string \| string\[\] \| undefined>>/)
  assert.match(mealsPageSource, /resolveRecordDate\(firstParam\(params\.date\), today\)/)
  assert.equal(parseDate("2026-08-23", "记录日期"), "2026-08-23")
  assert.throws(() => parseDate("2026-02-30", "记录日期"))
})

test("manual and AI meal saves use the selected record date", () => {
  assert.match(mealsPageSource, /recordDate=\{recordDate\}/)
  assert.match(mealsSource, /recordDate: string/)
  assert.match(mealsSource, /recordDate \}/)
  assert.match(mealsSource, /当天记录/)
  assert.doesNotMatch(mealsSource, /今日记录/)
  assert.doesNotMatch(mealsSource, /recordDate: today/)
})
