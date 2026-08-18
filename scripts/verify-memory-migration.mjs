import { spawnSync } from "node:child_process"
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

const root = process.cwd()
const runtimeDatabase = path.join(root, "database", "food_tracker.db")
const oldTables = ["user_profile", "meal_records", "exercise_suggestions", "exercise_calorie_reference"]
const newTables = ["agent_threads", "agent_messages", "memory_items", "daily_activity", "agent_session_digests"]
const replayedMigrations = [
  "20260815205500_add_agent_memory",
  "20260817062220_add_daily_activity",
  "20260817095137_add_session_digest",
]

function databaseUrl(databasePath) {
  const relativePath = path.relative(path.join(root, "prisma"), databasePath).replaceAll("\\", "/")
  return `file:${relativePath}`
}

function migrate(databasePath) {
  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js")
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl(databasePath) },
    encoding: "utf8",
  })
  if (result.status !== 0) {
    throw new Error(`Prisma migrate deploy failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  }
}

function rows(database, sql, ...params) {
  return database.prepare(sql).all(...params)
}

function snapshotLegacy(database) {
  return {
    counts: Object.fromEntries(oldTables.map((table) => [table, rows(database, `SELECT COUNT(*) AS count FROM ${table}`)[0].count])),
    ids: {
      user_profile: rows(database, "SELECT user_id AS id FROM user_profile ORDER BY user_id").map((row) => row.id),
      meal_records: rows(database, "SELECT record_id AS id FROM meal_records ORDER BY record_id").map((row) => row.id),
      exercise_suggestions: rows(database, "SELECT suggestion_id AS id FROM exercise_suggestions ORDER BY suggestion_id").map((row) => row.id),
      exercise_calorie_reference: rows(database, "SELECT exercise_id AS id FROM exercise_calorie_reference ORDER BY exercise_id").map((row) => row.id),
    },
    sequence: rows(database, "SELECT name, seq FROM sqlite_sequence WHERE name IN ('user_profile','meal_records','exercise_suggestions','exercise_calorie_reference') ORDER BY name"),
  }
}

function prepareLegacyReplay(databasePath) {
  const database = new DatabaseSync(databasePath)
  try {
    // The checked-in runtime database may already contain legitimate Agent
    // rows from previous smoke tests. Rebuild only the verification copy back
    // to the legacy boundary so zero-backfill assertions test the migrations,
    // not the current local runtime state.
    database.exec("PRAGMA foreign_keys = OFF")
    for (const table of ["agent_session_digests", "memory_items", "agent_messages", "agent_threads", "daily_activity"]) {
      database.exec(`DROP TABLE IF EXISTS \"${table}\"`)
    }
    const placeholders = replayedMigrations.map(() => "?").join(", ")
    database.prepare(`DELETE FROM _prisma_migrations WHERE migration_name IN (${placeholders})`).run(...replayedMigrations)
  } finally {
    database.close()
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function verifyDatabase(databasePath, expectedLegacy) {
  const database = new DatabaseSync(databasePath)
  database.exec("PRAGMA foreign_keys = ON")
  try {
    assert(rows(database, "PRAGMA integrity_check")[0].integrity_check === "ok", "integrity_check failed")
    assert(rows(database, "PRAGMA foreign_key_check").length === 0, "foreign_key_check failed")
    assert(JSON.stringify(snapshotLegacy(database)) === JSON.stringify(expectedLegacy), "legacy snapshot changed")
    for (const table of newTables) {
      assert(rows(database, `SELECT COUNT(*) AS count FROM ${table}`)[0].count === 0, `${table} was backfilled`)
    }

    const userId = rows(database, "SELECT MIN(user_id) AS id FROM user_profile")[0].id
    assert(typeof userId === "number", "primary profile missing")
    const threadId = Number(database.prepare("INSERT INTO agent_threads (user_id, title) VALUES (?, ?)").run(userId, "migration test").lastInsertRowid)
    const messageId = Number(database.prepare("INSERT INTO agent_messages (thread_id, role, content) VALUES (?, ?, ?)").run(threadId, "user", "test message").lastInsertRowid)
    const memoryId = Number(database.prepare("INSERT INTO memory_items (user_id, source_message_id, category, content, source_kind, is_user_confirmed) VALUES (?, ?, ?, ?, ?, ?)").run(userId, messageId, "context", "test memory", "user", 1).lastInsertRowid)

    database.prepare("DELETE FROM agent_threads WHERE thread_id = ?").run(threadId)
    assert(rows(database, "SELECT COUNT(*) AS count FROM agent_messages WHERE thread_id = ?", threadId)[0].count === 0, "thread did not cascade messages")
    const memory = rows(database, "SELECT source_message_id FROM memory_items WHERE memory_id = ?", memoryId)[0]
    assert(memory && memory.source_message_id === null, "message deletion did not preserve memory with null source")
  } finally {
    database.close()
  }
}

const verificationRoot = path.join(root, "data")
await mkdir(verificationRoot, { recursive: true })
const temporaryRoot = await mkdtemp(path.join(verificationRoot, "memory-migration-"))
const safeTemporaryRoot = path.resolve(verificationRoot) + path.sep
assert(path.resolve(temporaryRoot).startsWith(safeTemporaryRoot), "temporary migration path escaped the repository data directory")

try {
  const legacyCopy = path.join(temporaryRoot, "legacy.db")
  const emptyDatabase = path.join(temporaryRoot, "empty.db")
  await copyFile(runtimeDatabase, legacyCopy)
  prepareLegacyReplay(legacyCopy)

  const beforeDatabase = new DatabaseSync(legacyCopy, { readOnly: true })
  const legacySnapshot = snapshotLegacy(beforeDatabase)
  beforeDatabase.close()

  migrate(legacyCopy)
  verifyDatabase(legacyCopy, legacySnapshot)

  await writeFile(emptyDatabase, "")
  migrate(emptyDatabase)
  const empty = new DatabaseSync(emptyDatabase, { readOnly: true })
  try {
    for (const table of [...oldTables, ...newTables]) {
      assert(rows(empty, "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?", table)[0].count === 1, `missing table ${table}`)
    }
    assert(rows(empty, "PRAGMA foreign_key_check").length === 0, "empty database foreign key check failed")
  } finally {
    empty.close()
  }

  console.log(JSON.stringify({
    legacyCounts: legacySnapshot.counts,
    newTables: "zero-backfill",
    deleteSemantics: "thread CASCADE messages; message SET NULL memories",
    emptyDatabase: "all migrations applied",
  }))
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
