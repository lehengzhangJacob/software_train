import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const route = readFileSync(path.join(process.cwd(), "src", "app", "api", "agent", "articles", "route.ts"), "utf8")
const generator = readFileSync(path.join(process.cwd(), "src", "lib", "agent", "content", "generator.ts"), "utf8")
const background = readFileSync(path.join(process.cwd(), "src", "lib", "agent", "content", "background.ts"), "utf8")
const repository = readFileSync(path.join(process.cwd(), "src", "lib", "agent", "content", "repository.ts"), "utf8")
const insights = readFileSync(path.join(process.cwd(), "src", "components", "insights", "insights-content.tsx"), "utf8")

test("article POST is a durable background enqueue boundary", () => {
  assert.match(route, /queueDailyArticleBatch/)
  assert.match(route, /scheduleDailyArticleJob\(date\)/)
  assert.match(route, /return apiSuccess\(feed, 202\)/)
  assert.doesNotMatch(route, /ensureDailyArticleBatch/)
  assert.doesNotMatch(route, /generateWithAgent|enrichDailyArticleImages/)
})

test("queue state reuses pending and generating batch lifecycle", () => {
  assert.match(generator, /status: "pending"/)
  assert.match(generator, /startedAt: null/)
  assert.match(generator, /isFreshlyGenerating\(existing\)/)
  assert.match(generator, /uq_daily_article_batch_user_date/)
})

test("background dispatch is deduplicated and failures are contained", () => {
  assert.match(background, /new Map<string, Promise<void>>\(\)/)
  assert.match(background, /activeJobs\.has\(contentDate\)/)
  assert.match(background, /runDailyArticleJob\(contentDate\)/)
  assert.match(background, /catch\(\(\) => undefined\)/)
})

test("non-ready batches do not expose stale article rows", () => {
  assert.match(repository, /const articles = batch\.status === "ready" \? batch\.articles : \[\]/)
})

test("insights observes background state instead of waiting for generation", () => {
  assert.match(insights, /已提交后台整理/)
  assert.match(insights, /后台整理中/)
  assert.match(insights, /window\.setInterval/)
  assert.match(insights, /5_000/)
  assert.match(insights, /交给后台生成/)
})
