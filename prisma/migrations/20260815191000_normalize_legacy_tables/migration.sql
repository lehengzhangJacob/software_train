-- Legacy tables used CHECK constraints, localtime defaults and unnamed SQLite indexes.
-- Rebuild only the affected tables so their persisted shape matches the Prisma baseline.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "_legacy_sequence_snapshot" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL
);
INSERT INTO "_legacy_sequence_snapshot" ("name", "seq")
SELECT "name", "seq"
FROM "sqlite_sequence"
WHERE "name" IN (
    'exercise_suggestions',
    'meal_records',
    'exercise_calorie_reference'
);

CREATE TABLE "new_exercise_suggestions" (
    "suggestion_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "suggestion_date" TEXT NOT NULL,
    "calorie_surplus" REAL,
    "exercise_type" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "calorie_burn_estimate" REAL NOT NULL,
    "intensity" TEXT,
    "suggestion_detail" TEXT,
    "is_adopted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exercise_suggestions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_exercise_suggestions" (
    "calorie_burn_estimate", "calorie_surplus", "created_at", "duration_minutes",
    "exercise_type", "intensity", "is_adopted", "suggestion_date",
    "suggestion_detail", "suggestion_id", "user_id"
)
SELECT
    "calorie_burn_estimate", "calorie_surplus", "created_at", "duration_minutes",
    "exercise_type", "intensity", "is_adopted", "suggestion_date",
    "suggestion_detail", "suggestion_id", "user_id"
FROM "exercise_suggestions";
DROP TABLE "exercise_suggestions";
ALTER TABLE "new_exercise_suggestions" RENAME TO "exercise_suggestions";
CREATE INDEX "idx_exercise_user_date" ON "exercise_suggestions"("user_id", "suggestion_date");

CREATE TABLE "new_meal_records" (
    "record_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "food_name" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "protein_g" REAL NOT NULL DEFAULT 0,
    "fat_g" REAL NOT NULL DEFAULT 0,
    "carbs_g" REAL NOT NULL DEFAULT 0,
    "portion_desc" TEXT,
    "photo_path" TEXT,
    "recognition_raw" TEXT,
    "record_date" TEXT NOT NULL,
    "record_time" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meal_records_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_meal_records" (
    "calories", "carbs_g", "created_at", "fat_g", "food_name", "meal_type",
    "notes", "photo_path", "portion_desc", "protein_g", "recognition_raw",
    "record_date", "record_id", "record_time", "user_id"
)
SELECT
    "calories", "carbs_g", "created_at", "fat_g", "food_name", "meal_type",
    "notes", "photo_path", "portion_desc", "protein_g", "recognition_raw",
    "record_date", "record_id", "record_time", "user_id"
FROM "meal_records";
DROP TABLE "meal_records";
ALTER TABLE "new_meal_records" RENAME TO "meal_records";
CREATE INDEX "idx_meal_user_date" ON "meal_records"("user_id", "record_date");
CREATE INDEX "idx_meal_date" ON "meal_records"("record_date");
CREATE INDEX "idx_meal_type" ON "meal_records"("meal_type");
CREATE INDEX "idx_meal_user_date_type" ON "meal_records"("user_id", "record_date", "meal_type");

CREATE TABLE "new_exercise_calorie_reference" (
    "exercise_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "exercise_name" TEXT NOT NULL,
    "calories_per_30min" REAL NOT NULL,
    "category" TEXT,
    "met_value" REAL,
    "description" TEXT
);
INSERT INTO "new_exercise_calorie_reference" (
    "calories_per_30min", "category", "description", "exercise_id", "exercise_name", "met_value"
)
SELECT
    "calories_per_30min", "category", "description", "exercise_id", "exercise_name", "met_value"
FROM "exercise_calorie_reference";
DROP TABLE "exercise_calorie_reference";
ALTER TABLE "new_exercise_calorie_reference" RENAME TO "exercise_calorie_reference";
CREATE UNIQUE INDEX "exercise_calorie_reference_exercise_name_key"
  ON "exercise_calorie_reference"("exercise_name");

UPDATE "sqlite_sequence"
SET "seq" = COALESCE(
    (SELECT "seq" FROM "_legacy_sequence_snapshot" WHERE "name" = 'exercise_suggestions'),
    "seq"
)
WHERE "name" = 'exercise_suggestions';
UPDATE "sqlite_sequence"
SET "seq" = COALESCE(
    (SELECT "seq" FROM "_legacy_sequence_snapshot" WHERE "name" = 'meal_records'),
    "seq"
)
WHERE "name" = 'meal_records';
UPDATE "sqlite_sequence"
SET "seq" = COALESCE(
    (SELECT "seq" FROM "_legacy_sequence_snapshot" WHERE "name" = 'exercise_calorie_reference'),
    "seq"
)
WHERE "name" = 'exercise_calorie_reference';
DROP TABLE "_legacy_sequence_snapshot";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
