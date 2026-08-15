# 数据模型不变量

1. 新数据库允许 0 个 UserProfile；首次建档后课程应用呈现一个 primary profile。
2. 旧数据库存在多档案时稳定选择最小 user_id，不自动删除或合并历史数据。
3. gender 仅为 male/female/other；age 为 1–149；身高、体重和每日热量目标必须为正数。
4. activity_level 仅为 sedentary、lightly_active、moderately_active、very_active、extra_active。
5. meal_type 仅为 breakfast、lunch、dinner、snack；所有营养数值不得为负数。
6. MealRecord 与 ExerciseSuggestion 必须属于 primary profile；客户端 userId 不构成所有权证据。
7. record_date 和 suggestion_date 使用 YYYY-MM-DD；record_time 使用 HH:MM:SS。
8. bmr 由身体参数派生并持久化，旧空值在 S1 迁移副本中回填。
9. updated_at 由 ORM 更新语义维护，不依赖未部署的 SQLite trigger。
10. recognition_raw 不得包含图片 data URL、密钥或供应商错误正文。
11. is_adopted 是持久用户决策，只能为 0/1。
12. ExerciseCalorieReference 通过 exercise_name 幂等 seed；生产初始化不写 demo 用户或餐食。
13. 报告和趋势是运行时派生数据，不建立第二套持久汇总真相。
14. 任何 destructive migration 必须先备份并在副本验证。
