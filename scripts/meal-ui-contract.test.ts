import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { formatCalories, formatGrams } from "../src/lib/utils"
import { parseMealNutritionInput } from "../src/lib/nutrition"

const mealsSource = fs.readFileSync("src/components/food/meals-content.tsx", "utf8")

test("display format stays bounded for historical invalid values", () => {
  assert.equal(formatCalories(100001), "100,000+")
  assert.equal(formatGrams(Number.POSITIVE_INFINITY), "—")
  assert.equal(formatCalories(Number.NaN), "—")
  assert.equal(formatGrams(100000), "100000.0")
})

test("raw UI values are parsed only at the save boundary", () => {
  assert.equal(parseMealNutritionInput("9".repeat(300)), null)
  assert.equal(parseMealNutritionInput("100000"), 100000)
  assert.equal(parseMealNutritionInput("100000.1"), null)
  assert.match(mealsSource, /parseNutritionValues\(form\)/)
  assert.match(mealsSource, /\.\.\.nutrition\.values/)
})

test("manual and recognition inputs expose the shared bounds", () => {
  assert.equal((mealsSource.match(/max=\{MEAL_NUTRITION_MAX\}/g) || []).length, 8)
  assert.match(mealsSource, /min=\{MEAL_NUTRITION_MIN\}/)
  assert.match(mealsSource, /toast\.error\(nutrition\.error\)/)
})
