-- ============================================================
-- 食物热量识别与饮食管理系统的SQLite数据库建表脚本
-- 版本: 1.0
-- 说明: 开发人员2 — 数据库设计
-- ============================================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. 用户个人信息表 (user_profile)
-- 存储用户身体参数、每日营养目标和基础代谢率
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profile (
    user_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT    NOT NULL,
    gender              TEXT    NOT NULL CHECK(gender IN ('male', 'female', 'other')),
    age                 INTEGER NOT NULL CHECK(age > 0 AND age < 150),
    height_cm           REAL    NOT NULL CHECK(height_cm > 0),       -- 身高（厘米）
    weight_kg           REAL    NOT NULL CHECK(weight_kg > 0),       -- 体重（公斤）
    daily_calorie_target INTEGER NOT NULL DEFAULT 2000,              -- 每日热量目标（千卡）
    daily_protein_target REAL   NOT NULL DEFAULT 60.0,               -- 每日蛋白质目标（克）
    daily_fat_target     REAL   NOT NULL DEFAULT 60.0,               -- 每日脂肪目标（克）
    daily_carbs_target   REAL   NOT NULL DEFAULT 250.0,              -- 每日碳水目标（克）
    bmr                 REAL,                                        -- 基础代谢率（千卡/天，由系统计算）
    activity_level      TEXT    NOT NULL DEFAULT 'sedentary'
                        CHECK(activity_level IN (
                            'sedentary',        -- 久坐不动（几乎不运动）
                            'lightly_active',   -- 轻度活动（每周1-3天运动）
                            'moderately_active',-- 中度活动（每周3-5天运动）
                            'very_active',      -- 高度活跃（每周6-7天运动）
                            'extra_active'      -- 极高活跃（高强度体力劳动/每天两次训练）
                        )),
    created_at          DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- 2. 饮食记录表 (meal_records)
-- 存储每餐饮食记录，包含食物名称、营养素、餐别、照片等信息
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_records (
    record_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    food_name        TEXT    NOT NULL,                                -- 食物名称
    meal_type        TEXT    NOT NULL
                     CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    calories         REAL    NOT NULL CHECK(calories >= 0),          -- 热量（千卡）
    protein_g        REAL    NOT NULL DEFAULT 0 CHECK(protein_g >= 0),   -- 蛋白质（克）
    fat_g            REAL    NOT NULL DEFAULT 0 CHECK(fat_g >= 0),       -- 脂肪（克）
    carbs_g          REAL    NOT NULL DEFAULT 0 CHECK(carbs_g >= 0),     -- 碳水化合物（克）
    portion_desc     TEXT,                                            -- 份量描述（如"1碗约200g"）
    photo_path       TEXT,                                            -- 食物照片存储路径
    recognition_raw  TEXT,                                            -- GLM API原始识别结果（JSON）
    record_date      DATE    NOT NULL,                                -- 记录日期（YYYY-MM-DD）
    record_time      TIME    NOT NULL,                                -- 记录时间（HH:MM:SS）
    notes            TEXT,                                            -- 备注
    created_at       DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),

    FOREIGN KEY (user_id) REFERENCES user_profile(user_id) ON DELETE CASCADE
);

-- ============================================================
-- 3. 运动建议表 (exercise_suggestions)
-- 存储基于热量摄入生成的个性化运动建议
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_suggestions (
    suggestion_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL,
    suggestion_date     DATE    NOT NULL,                             -- 建议生成日期
    calorie_surplus     REAL,                                         -- 当日热量盈余（千卡，摄入-消耗）
    exercise_type       TEXT    NOT NULL,                             -- 运动类型（步行/跑步/游泳/骑行等）
    duration_minutes    INTEGER NOT NULL CHECK(duration_minutes > 0), -- 建议运动时长（分钟）
    calorie_burn_estimate REAL  NOT NULL,                             -- 预估消耗热量（千卡）
    intensity           TEXT    CHECK(intensity IN ('low', 'moderate', 'high')),
    suggestion_detail   TEXT,                                         -- 详细建议内容（由大模型生成）
    is_adopted          INTEGER NOT NULL DEFAULT 0 CHECK(is_adopted IN (0, 1)), -- 是否采纳
    created_at          DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),

    FOREIGN KEY (user_id) REFERENCES user_profile(user_id) ON DELETE CASCADE
);

-- ============================================================
-- 4. 热量消耗参考表 (exercise_calorie_reference)
-- 常见运动每30分钟消耗热量参考值（以60kg体重为基准）
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_calorie_reference (
    exercise_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_name   TEXT    NOT NULL UNIQUE,                          -- 运动名称
    calories_per_30min REAL NOT NULL,                                 -- 每30分钟消耗热量（千卡，60kg基准）
    category        TEXT    CHECK(category IN ('aerobic', 'strength', 'flexibility', 'other')),
    met_value       REAL,                                            -- MET代谢当量值
    description     TEXT                                             -- 运动描述
);

-- ============================================================
-- ======================== 索引设计 ============================
-- ============================================================

-- 饮食记录查询优化：按用户+日期查询（最常用场景）
CREATE INDEX IF NOT EXISTS idx_meal_user_date
    ON meal_records(user_id, record_date);

-- 饮食记录查询优化：按日期范围查询（周/月统计）
CREATE INDEX IF NOT EXISTS idx_meal_date
    ON meal_records(record_date);

-- 饮食记录查询优化：按餐别筛选
CREATE INDEX IF NOT EXISTS idx_meal_type
    ON meal_records(meal_type);

-- 饮食记录查询优化：按用户+日期+餐别组合查询
CREATE INDEX IF NOT EXISTS idx_meal_user_date_type
    ON meal_records(user_id, record_date, meal_type);

-- 运动建议查询优化
CREATE INDEX IF NOT EXISTS idx_exercise_user_date
    ON exercise_suggestions(user_id, suggestion_date);

-- ============================================================
-- ======================== 视图设计 ============================
-- ============================================================

-- 视图1: 每日营养摄入汇总
-- 按用户和日期汇总当日所有餐别的营养素摄入总量
CREATE VIEW IF NOT EXISTS v_daily_nutrition_summary AS
SELECT
    m.user_id,
    u.username,
    m.record_date,
    SUM(m.calories)  AS total_calories,
    SUM(m.protein_g) AS total_protein_g,
    SUM(m.fat_g)     AS total_fat_g,
    SUM(m.carbs_g)   AS total_carbs_g,
    COUNT(m.record_id) AS meal_count,
    u.daily_calorie_target,
    u.daily_protein_target,
    u.daily_fat_target,
    u.daily_carbs_target,
    -- 热量差值：正数表示超标，负数表示不足
    ROUND(SUM(m.calories) - u.daily_calorie_target, 1) AS calorie_diff
FROM meal_records m
JOIN user_profile u ON m.user_id = u.user_id
GROUP BY m.user_id, m.record_date;

-- 视图2: 每周营养摄入汇总
-- 按用户和ISO周汇总
CREATE VIEW IF NOT EXISTS v_weekly_nutrition_summary AS
SELECT
    m.user_id,
    u.username,
    strftime('%Y', m.record_date) AS year,
    strftime('%W', m.record_date) AS week_number,
    MIN(m.record_date) AS week_start_date,
    MAX(m.record_date) AS week_end_date,
    ROUND(AVG(daily_cal.total_calories), 1) AS avg_daily_calories,
    ROUND(AVG(daily_cal.total_protein_g), 1) AS avg_daily_protein_g,
    ROUND(AVG(daily_cal.total_fat_g), 1) AS avg_daily_fat_g,
    ROUND(AVG(daily_cal.total_carbs_g), 1) AS avg_daily_carbs_g,
    COUNT(DISTINCT m.record_date) AS days_recorded
FROM meal_records m
JOIN user_profile u ON m.user_id = u.user_id
JOIN v_daily_nutrition_summary daily_cal
    ON m.user_id = daily_cal.user_id AND m.record_date = daily_cal.record_date
GROUP BY m.user_id, year, week_number;

-- 视图3: 每月营养摄入汇总
CREATE VIEW IF NOT EXISTS v_monthly_nutrition_summary AS
SELECT
    m.user_id,
    u.username,
    strftime('%Y', m.record_date) AS year,
    strftime('%m', m.record_date) AS month,
    MIN(m.record_date) AS month_start_date,
    MAX(m.record_date) AS month_end_date,
    ROUND(AVG(daily_cal.total_calories), 1) AS avg_daily_calories,
    ROUND(AVG(daily_cal.total_protein_g), 1) AS avg_daily_protein_g,
    ROUND(AVG(daily_cal.total_fat_g), 1) AS avg_daily_fat_g,
    ROUND(AVG(daily_cal.total_carbs_g), 1) AS avg_daily_carbs_g,
    COUNT(DISTINCT m.record_date) AS days_recorded
FROM meal_records m
JOIN user_profile u ON m.user_id = u.user_id
JOIN v_daily_nutrition_summary daily_cal
    ON m.user_id = daily_cal.user_id AND m.record_date = daily_cal.record_date
GROUP BY m.user_id, year, month;

-- 视图4: 按餐别汇总当日营养
CREATE VIEW IF NOT EXISTS v_meal_type_summary AS
SELECT
    user_id,
    record_date,
    meal_type,
    SUM(calories)  AS total_calories,
    SUM(protein_g) AS total_protein_g,
    SUM(fat_g)     AS total_fat_g,
    SUM(carbs_g)   AS total_carbs_g,
    COUNT(record_id) AS food_item_count
FROM meal_records
GROUP BY user_id, record_date, meal_type;

-- ============================================================
-- ======================== 触发器设计 ============================
-- ============================================================

-- 触发器1: 自动更新用户表的 updated_at 字段
CREATE TRIGGER IF NOT EXISTS trg_user_profile_updated_at
    AFTER UPDATE ON user_profile
BEGIN
    UPDATE user_profile SET updated_at = datetime('now', 'localtime')
    WHERE user_id = NEW.user_id;
END;

-- 触发器2: 当用户身体参数更新时，自动重新计算BMR
-- BMR计算公式（Mifflin-St Jeor Equation）:
--   男性: BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄 - 5 + 161
--   注意：上面是女性公式，男性最后 +5 而不是 -161
--   实际公式: 男: 10W + 6.25H - 5A + 5; 女: 10W + 6.25H - 5A - 161
CREATE TRIGGER IF NOT EXISTS trg_calc_bmr_insert
    AFTER INSERT ON user_profile
BEGIN
    UPDATE user_profile SET bmr = 
        CASE
            WHEN NEW.gender = 'male' THEN
                ROUND(10 * NEW.weight_kg + 6.25 * NEW.height_cm - 5 * NEW.age + 5, 1)
            WHEN NEW.gender = 'female' THEN
                ROUND(10 * NEW.weight_kg + 6.25 * NEW.height_cm - 5 * NEW.age - 161, 1)
            ELSE
                ROUND(10 * NEW.weight_kg + 6.25 * NEW.height_cm - 5 * NEW.age - 78, 1)
        END
    WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_calc_bmr_update
    AFTER UPDATE OF weight_kg, height_cm, age, gender ON user_profile
BEGIN
    UPDATE user_profile SET bmr = 
        CASE
            WHEN NEW.gender = 'male' THEN
                ROUND(10 * NEW.weight_kg + 6.25 * NEW.height_cm - 5 * NEW.age + 5, 1)
            WHEN NEW.gender = 'female' THEN
                ROUND(10 * NEW.weight_kg + 6.25 * NEW.height_cm - 5 * NEW.age - 161, 1)
            ELSE
                ROUND(10 * NEW.weight_kg + 6.25 * NEW.height_cm - 5 * NEW.age - 78, 1)
        END
    WHERE user_id = NEW.user_id;
END;

-- 触发器3: 插入饮食记录时自动设置record_time（如未提供）
CREATE TRIGGER IF NOT EXISTS trg_meal_record_time
    AFTER INSERT ON meal_records
    FOR EACH ROW
    WHEN NEW.record_time IS NULL
BEGIN
    UPDATE meal_records SET record_time = time('now', 'localtime')
    WHERE record_id = NEW.record_id;
END;
