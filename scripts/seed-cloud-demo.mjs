import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = new Set(process.argv.slice(2))
const apply = args.has("--apply")
const baseUrl = (process.env.DEMO_BASE_URL || "http://8.148.206.131:8000").replace(/\/+$/, "")
const marker = process.env.DEMO_MARKER || "C-12-E2E-20260818"
const anchorDate = process.env.DEMO_ANCHOR_DATE || "2026-08-18"
const evidenceDirectory = path.join(root, "dev_repo", "evidence", "C-12")

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  assert(match, `Invalid DEMO_ANCHOR_DATE: ${value}`)
  const parsed = new Date(`${value}T12:00:00Z`)
  assert(!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value, `Invalid DEMO_ANCHOR_DATE: ${value}`)
  return parsed
}

function dateOffset(daysAgo) {
  const date = parseDate(anchorDate)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function mealTemplates(variant) {
  const templates = [
    [
      ["燕麦酸奶蓝莓碗", "breakfast", 390, 20, 12, 52, "燕麦 50g + 无糖酸奶 200g + 蓝莓 80g", "07:40:00"],
      ["香煎鸡胸肉糙米沙拉", "lunch", 640, 46, 18, 64, "鸡胸肉 150g + 糙米 120g + 时蔬", "12:20:00"],
      ["清蒸鳕鱼配西兰花", "dinner", 520, 43, 14, 48, "鳕鱼 160g + 西兰花 200g + 小土豆", "18:40:00"],
      ["苹果与无盐杏仁", "snack", 210, 5, 12, 24, "苹果 1 个 + 杏仁 15g", "15:40:00"],
    ],
    [
      ["全麦吐司鸡蛋牛油果", "breakfast", 430, 22, 22, 38, "全麦吐司 2 片 + 鸡蛋 1 个 + 牛油果半个", "08:05:00"],
      ["番茄牛肉全麦意面", "lunch", 710, 39, 21, 83, "瘦牛肉 120g + 全麦意面 100g", "12:35:00"],
      ["虾仁豆腐菌菇汤", "dinner", 480, 38, 16, 42, "虾仁 120g + 嫩豆腐 150g + 菌菇", "19:00:00"],
      ["低糖希腊酸奶", "snack", 160, 15, 4, 18, "希腊酸奶 150g", "16:10:00"],
    ],
    [
      ["香蕉花生酱奶昔", "breakfast", 360, 18, 13, 48, "香蕉 1 根 + 牛奶 250ml + 花生酱 10g", "07:50:00"],
      ["三文鱼藜麦能量碗", "lunch", 680, 42, 25, 64, "三文鱼 140g + 藜麦 100g + 蔬菜", "12:10:00"],
      ["番茄鸡肉蔬菜炖锅", "dinner", 560, 45, 15, 55, "鸡腿肉 150g + 番茄 + 彩椒", "18:25:00"],
      ["橙子与低脂奶酪", "snack", 190, 10, 6, 24, "橙子 1 个 + 低脂奶酪 40g", "15:30:00"],
    ],
    [
      ["玉米鸡蛋小米粥", "breakfast", 350, 17, 10, 52, "玉米半根 + 鸡蛋 1 个 + 小米粥", "07:30:00"],
      ["照烧鸡腿紫米饭", "lunch", 735, 40, 24, 86, "去皮鸡腿 160g + 紫米饭 130g", "12:45:00"],
      ["牛肉蔬菜荞麦面", "dinner", 610, 36, 18, 70, "瘦牛肉 120g + 荞麦面 100g + 时蔬", "19:15:00"],
      ["温豆浆与毛豆", "snack", 180, 14, 7, 16, "无糖豆浆 250ml + 毛豆 60g", "16:00:00"],
    ],
  ]

  return templates[variant % templates.length]
}

const jsonHeaders = { "content-type": "application/json" }

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function verifyAccessCode() {
  const accessCode = process.env.APP_ACCESS_TOKEN?.trim()
  assert(accessCode, "APP_ACCESS_TOKEN is required for --apply and is never written to evidence")
  const response = await fetch(`${baseUrl}/api/auth/verify`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ code: accessCode }),
  })
  const body = await readJson(response)
  assert(response.ok && body?.error === null, `Cloud access verification failed (${response.status})`)
  const setCookie = response.headers.get("set-cookie") || ""
  const cookie = setCookie.split(";")[0]
  assert(cookie.startsWith("ft_access="), "Cloud access verification did not return the access cookie")
  return cookie
}

async function requestJson(cookie, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {}),
      cookie,
    },
  })
  const body = await readJson(response)
  if (!response.ok || body?.error) {
    throw new Error(`${options.method || "GET"} ${pathname} failed (${response.status}): ${body?.error || "invalid response"}`)
  }
  return body?.data
}

function mealPayload(date, daysAgo) {
  return mealTemplates(13 - daysAgo).map(([foodName, mealType, calories, proteinG, fatG, carbsG, portionDesc, recordTime]) => ({
    foodName,
    mealType,
    calories,
    proteinG,
    fatG,
    carbsG,
    portionDesc,
    recordDate: date,
    recordTime,
    notes: `${marker} ${date} ${mealType}`,
  }))
}

async function seedMeals(cookie) {
  const created = []
  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    const date = dateOffset(daysAgo)
    const existing = await requestJson(cookie, `/api/meals?date=${date}`)
    const desired = mealPayload(date, daysAgo)
    const missing = desired.filter((item) => !existing.some((record) => record.notes === item.notes))
    if (missing.length === 0) continue
    const records = await requestJson(cookie, "/api/meals", {
      method: "POST",
      body: JSON.stringify({ recordDate: date, items: missing }),
    })
    created.push(...records.map((record) => ({ recordId: record.recordId, date: record.recordDate, mealType: record.mealType })))
  }
  return created
}

async function seedActivity(cookie) {
  const recent = await requestJson(cookie, "/api/health/recent?days=31")
  const existingDates = new Set(recent.activities.map((activity) => activity.activityDate))
  const created = []
  for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const activityDate = dateOffset(daysAgo)
    if (existingDates.has(activityDate)) continue
    const activity = await requestJson(cookie, "/api/health/sync", {
      method: "POST",
      body: JSON.stringify({
        activityDate,
        steps: 5_400 + ((6 - daysAgo) % 5) * 1_350,
        activeCalories: 210 + ((6 - daysAgo) % 4) * 65,
        exerciseMinutes: 22 + ((6 - daysAgo) % 4) * 9,
        sourceKind: "manual",
      }),
    })
    created.push({ activityId: activity.activity.activityId, activityDate })
  }
  return created
}

async function seedExercise(cookie) {
  const created = []
  for (const daysAgo of [6, 3, 0]) {
    const date = dateOffset(daysAgo)
    const suggestion = await requestJson(cookie, `/api/exercise/suggest?date=${date}`)
    if (suggestion.adopted.length > 0 || suggestion.candidates.length === 0) continue
    const candidate = suggestion.candidates[0]
    const adopted = await requestJson(cookie, "/api/exercise/suggest", {
      method: "POST",
      body: JSON.stringify({
        exerciseId: candidate.exerciseId,
        durationMinutes: Math.max(20, Math.min(candidate.suggestedMinutes, 45)),
        date,
      }),
    })
    created.push({ suggestionId: adopted.suggestionId, date, exerciseType: adopted.exerciseType })
  }
  return created
}

async function seedMemories(cookie) {
  const desired = [
    { category: "preference", content: `${marker} 工作日午餐更喜欢清淡、少油的选择`, importance: 0.8 },
    { category: "goal", content: `${marker} 本周希望把晚餐蛋白质稳定在一掌心份量`, importance: 0.7 },
    { category: "habit", content: `${marker} 通常在晚饭后安排 20 到 30 分钟轻松步行`, importance: 0.6 },
  ]
  const existing = await requestJson(cookie, "/api/memories?status=all")
  const created = []
  for (const item of desired) {
    if (existing.some((memory) => memory.content === item.content)) continue
    const memory = await requestJson(cookie, "/api/memories", {
      method: "POST",
      body: JSON.stringify(item),
    })
    created.push({ memoryId: memory.memoryId, category: memory.category })
  }
  return created
}

async function verifyDataset(cookie) {
  const mealRows = []
  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    const date = dateOffset(daysAgo)
    mealRows.push(...(await requestJson(cookie, `/api/meals?date=${date}`)))
  }
  const activity = await requestJson(cookie, "/api/health/recent?days=7")
  const report = await requestJson(cookie, "/api/reports?period=monthly")
  const memories = await requestJson(cookie, "/api/memories?status=all")
  const exerciseRows = []
  for (const daysAgo of [6, 3, 0]) {
    const suggestion = await requestJson(cookie, `/api/exercise/suggest?date=${dateOffset(daysAgo)}`)
    exerciseRows.push(...suggestion.adopted)
  }
  const demoMeals = mealRows.filter((record) => record.notes?.startsWith(marker))
  const demoMemories = memories.filter((memory) => memory.content.startsWith(marker))
  assert(demoMeals.some((record) => record.recordDate === anchorDate), "Seeded meals were not visible on the anchor date")
  assert(report.daysRecorded >= 7, "Monthly report did not include the seeded meal window")
  assert(activity.activities.length >= 6, "Health activity window did not include seeded activity")
  assert(demoMemories.length >= 3, "Seeded memories were not readable")
  return {
    anchorMeals: demoMeals.filter((record) => record.recordDate === anchorDate).length,
    recordedDays: report.daysRecorded,
    activityDays: activity.activities.length,
    demoMemories: demoMemories.length,
    present: {
      mealIds: demoMeals.map((record) => record.recordId),
      mealDays: [...new Set(demoMeals.map((record) => record.recordDate))].sort(),
      activityIds: activity.activities.map((record) => record.activityId),
      exerciseIds: exerciseRows.map((record) => record.suggestionId),
      memoryIds: demoMemories.map((memory) => memory.memoryId),
    },
  }
}

async function main() {
  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      baseUrl,
      marker,
      anchorDate,
      plan: {
        mealDays: 14,
        mealsPerDay: 4,
        activityDays: 7,
        adoptedExerciseDays: 3,
        memories: 3,
        writePath: "cloud HTTP API only",
      },
      next: "Set APP_ACCESS_TOKEN in the process environment and rerun with --apply.",
    }, null, 2))
    return
  }

  const cookie = await verifyAccessCode()
  const createdMeals = await seedMeals(cookie)
  const createdActivity = await seedActivity(cookie)
  const createdExercise = await seedExercise(cookie)
  const createdMemories = await seedMemories(cookie)
  const verification = await verifyDataset(cookie)
  const manifest = {
    contractId: "C-12",
    sliceId: "C-12-S1",
    generatedAt: new Date().toISOString(),
    baseUrl,
    marker,
    anchorDate,
    userScope: "server-selected primary profile; user 2 untouched",
    writePath: "real authenticated HTTP API",
    created: {
      meals: createdMeals,
      activity: createdActivity,
      exercise: createdExercise,
      memories: createdMemories,
    },
    verification,
    safety: {
      orderSubmitCalled: false,
      paymentCalled: false,
      credentialsWrittenToEvidence: false,
      directDatabaseWrite: false,
    },
  }
  await mkdir(evidenceDirectory, { recursive: true })
  await writeFile(path.join(evidenceDirectory, "data-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  console.log(JSON.stringify({
    mode: "apply",
    marker,
    created: {
      meals: createdMeals.length,
      activity: createdActivity.length,
      exercise: createdExercise.length,
      memories: createdMemories.length,
    },
    verification,
    evidence: "dev_repo/evidence/C-12/data-manifest.json",
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
