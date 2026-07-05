# 实体关系描述

## 实体一览

| 实体 | 表名 | 说明 |
|------|------|------|
| 用户 | user_profile | 身体参数、营养目标、BMR |
| 饮食记录 | meal_records | 每餐食物项，含营养素和 AI 识别结果 |
| 运动建议 | exercise_suggestions | 基于热量盈余的运动推荐 |
| 运动参考 | exercise_calorie_reference | 常见运动消耗参考值 |

## 核心关系

- 用户 1:N 饮食记录 (user_id FK)
- 用户 1:N 运动建议 (user_id FK)
- 运动参考独立引用 (无 FK)

## 视图

- v_daily_nutrition_summary: 用户 x 日汇总 + 目标对比
- v_weekly_nutrition_summary: 用户 x ISO 周平均
- v_monthly_nutrition_summary: 用户 x 月平均
- v_meal_type_summary: 用户 x 日 x 餐别汇总
