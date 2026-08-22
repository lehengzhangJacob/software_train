-- C-24 / ADR-0014: Agent-owned structured exercise plans.
-- The legacy mirror is additive and idempotent; the original exercise_suggestions
-- rows remain the complete historical source.
CREATE TABLE "agent_exercise_plans" (
    "plan_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "thread_id" INTEGER,
    "source_message_id" INTEGER,
    "legacy_suggestion_id" INTEGER,
    "plan_date" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "source_kind" TEXT NOT NULL DEFAULT 'agent',
    "status" TEXT NOT NULL DEFAULT 'active',
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "intensity" TEXT NOT NULL,
    "plan_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_exercise_plans_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_exercise_plans_thread_id_fkey"
      FOREIGN KEY ("thread_id") REFERENCES "agent_threads" ("thread_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agent_exercise_plans_source_message_id_fkey"
      FOREIGN KEY ("source_message_id") REFERENCES "agent_messages" ("message_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agent_exercise_plans_legacy_suggestion_id_fkey"
      FOREIGN KEY ("legacy_suggestion_id") REFERENCES "exercise_suggestions" ("suggestion_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_exercise_plans_legacy_suggestion_id_key"
  ON "agent_exercise_plans"("legacy_suggestion_id");
CREATE INDEX "idx_agent_plan_user_date_status_revision"
  ON "agent_exercise_plans"("user_id", "plan_date", "status", "revision");
CREATE INDEX "idx_agent_plan_thread"
  ON "agent_exercise_plans"("thread_id");
CREATE INDEX "idx_agent_plan_source_message"
  ON "agent_exercise_plans"("source_message_id");

-- Mirror every old suggestion once. The original row remains untouched. The
-- bounded fields keep a malformed historical duration renderable while the
-- legacy payload retains the exact source values for audit/history.
INSERT INTO "agent_exercise_plans" (
    "user_id",
    "plan_date",
    "revision",
    "source_kind",
    "status",
    "title",
    "goal",
    "total_minutes",
    "intensity",
    "plan_json",
    "legacy_suggestion_id",
    "created_at",
    "updated_at"
)
SELECT
    s."user_id",
    s."suggestion_date",
    1,
    'legacy_suggestion',
    'legacy',
    substr(s."exercise_type", 1, 160),
    '历史运动建议',
    CASE
      WHEN s."duration_minutes" < 5 THEN 5
      WHEN s."duration_minutes" > 180 THEN 180
      ELSE s."duration_minutes"
    END,
    COALESCE(NULLIF(s."intensity", ''), 'moderate'),
    json_object(
      'planDate', s."suggestion_date",
      'title', substr(s."exercise_type", 1, 160),
      'goal', '历史运动建议',
      'totalMinutes', CASE
        WHEN s."duration_minutes" < 5 THEN 5
        WHEN s."duration_minutes" > 180 THEN 180
        ELSE s."duration_minutes"
      END,
      'intensity', COALESCE(NULLIF(s."intensity", ''), 'moderate'),
      'steps', json_array(json_object(
        'order', 1,
        'kind', 'cardio',
        'name', substr(s."exercise_type", 1, 160),
        'minutes', CASE
          WHEN s."duration_minutes" < 5 THEN 5
          WHEN s."duration_minutes" > 180 THEN 180
          ELSE s."duration_minutes"
        END,
        'instructions', substr(COALESCE(NULLIF(s."suggestion_detail", ''), '按历史建议完成'), 1, 500)
      )),
      'safetyNote', '历史建议，仅作记录参考',
      'legacy', json_object(
        'durationMinutes', s."duration_minutes",
        'calorieSurplus', s."calorie_surplus",
        'calorieBurnEstimate', s."calorie_burn_estimate",
        'isAdopted', s."is_adopted"
      )
    ),
    s."suggestion_id",
    s."created_at",
    s."created_at"
FROM "exercise_suggestions" AS s
WHERE NOT EXISTS (
  SELECT 1
  FROM "agent_exercise_plans" AS p
  WHERE p."legacy_suggestion_id" = s."suggestion_id"
);
