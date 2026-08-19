-- CreateTable
CREATE TABLE "daily_activity" (
    "activity_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "activity_date" TEXT NOT NULL,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "active_calories" REAL NOT NULL DEFAULT 0,
    "exercise_minutes" INTEGER NOT NULL DEFAULT 0,
    "source_kind" TEXT NOT NULL DEFAULT 'manual',
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "idx_activity_user_date" ON "daily_activity"("user_id", "activity_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_activity_user_id_activity_date_key" ON "daily_activity"("user_id", "activity_date");
