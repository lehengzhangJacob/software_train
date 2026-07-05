# 数据模型不变项

1. user_profile 表中 gender 只能为 male/female/other，由 CHECK 约束保证
2. age 范围 1-149 岁
3. meal_records 表 meal_type 只能为 breakfast/lunch/dinner/snack
4. 所有热量数值 >= 0
5. BMR 由触发器自动计算，不允许手工写入
6. user_id 通过外键级联删除 (ON DELETE CASCADE)
7. calories_per_30min 以 60kg 体重为基准
8. exercise_calorie_reference.exercise_name 唯一
9. record_date 格式必须为 YYYY-MM-DD
10. record_time 格式必须为 HH:MM:SS
