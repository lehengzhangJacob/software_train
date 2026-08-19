-- BMR is derived from the persisted profile fields. The application maintains it for future writes.
UPDATE "user_profile"
SET "bmr" = ROUND(
  10 * "weight_kg" + 6.25 * "height_cm" - 5 * "age" +
  CASE
    WHEN "gender" = 'male' THEN 5
    WHEN "gender" = 'female' THEN -161
    ELSE -78
  END,
  1
);
