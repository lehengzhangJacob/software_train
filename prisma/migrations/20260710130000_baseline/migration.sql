-- CreateTable
CREATE TABLE "user_profile" (
    "user_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "height_cm" REAL NOT NULL,
    "weight_kg" REAL NOT NULL,
    "daily_calorie_target" INTEGER NOT NULL DEFAULT 2000,
    "daily_protein_target" REAL NOT NULL DEFAULT 60.0,
    "daily_fat_target" REAL NOT NULL DEFAULT 60.0,
    "daily_carbs_target" REAL NOT NULL DEFAULT 250.0,
    "bmr" REAL,
    "activity_level" TEXT NOT NULL DEFAULT 'sedentary',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "meal_records" (
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
    CONSTRAINT "meal_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exercise_suggestions" (
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
    CONSTRAINT "exercise_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exercise_calorie_reference" (
    "exercise_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "exercise_name" TEXT NOT NULL,
    "calories_per_30min" REAL NOT NULL,
    "category" TEXT,
    "met_value" REAL,
    "description" TEXT
);

-- CreateIndex
CREATE INDEX "idx_meal_user_date" ON "meal_records"("user_id", "record_date");
CREATE INDEX "idx_meal_date" ON "meal_records"("record_date");
CREATE INDEX "idx_meal_type" ON "meal_records"("meal_type");
CREATE INDEX "idx_meal_user_date_type" ON "meal_records"("user_id", "record_date", "meal_type");
CREATE INDEX "idx_exercise_user_date" ON "exercise_suggestions"("user_id", "suggestion_date");
CREATE UNIQUE INDEX "exercise_calorie_reference_exercise_name_key" ON "exercise_calorie_reference"("exercise_name");
