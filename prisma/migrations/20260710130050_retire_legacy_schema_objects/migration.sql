-- Aggregates are computed by application queries and profile timestamps/BMR are maintained by the service layer.
-- Retire legacy schema objects before the BMR backfill so old triggers cannot mutate updated_at.
DROP VIEW IF EXISTS "v_monthly_nutrition_summary";
DROP VIEW IF EXISTS "v_weekly_nutrition_summary";
DROP VIEW IF EXISTS "v_meal_type_summary";
DROP VIEW IF EXISTS "v_daily_nutrition_summary";

DROP TRIGGER IF EXISTS "trg_meal_record_time";
DROP TRIGGER IF EXISTS "trg_calc_bmr_update";
DROP TRIGGER IF EXISTS "trg_calc_bmr_insert";
DROP TRIGGER IF EXISTS "trg_user_profile_updated_at";
