-- C-27-A1: user-owned completion projection for immutable exercise-plan steps.
-- Rows exist only for completed steps; missing rows render as unchecked.
CREATE TABLE "agent_exercise_plan_step_progress" (
    "progress_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plan_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL,
    "completed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_exercise_plan_step_progress_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "agent_exercise_plans" ("plan_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_agent_plan_step_progress"
  ON "agent_exercise_plan_step_progress"("plan_id", "step_order");
CREATE INDEX "idx_agent_plan_step_progress"
  ON "agent_exercise_plan_step_progress"("plan_id", "completed_at");
