# 实体关系与所有权

## 实体

| 实体 | 表 | 来源 | 身份 | 所有者 |
|---|---|---|---|---|
| UserProfile | user_profile | 用户输入 + 派生 BMR | user_id | 课程应用 |
| MealRecord | meal_records | 用户输入或审核后的 AI 结果 | record_id | UserProfile |
| ExerciseSuggestion | exercise_suggestions | 规则/AI 建议与采纳状态 | suggestion_id | UserProfile |
| ExerciseCalorieReference | exercise_calorie_reference | 版本化 reference seed | exercise_id | 应用参考目录 |

## 关系

- UserProfile 1:N MealRecord，通过 user_id，删除档案时级联删除。
- UserProfile 1:N ExerciseSuggestion，通过 user_id，删除档案时级联删除。
- ExerciseCalorieReference 不与建议建立持久外键；建议保存生成时的名称和估算，避免 reference 更新改变历史。

## Primary profile

表结构保留多个 UserProfile 以兼容已有 demo 数据，但课程应用只呈现一个 primary profile：

1. 空库时允许用户首次创建。
2. 有记录时服务端稳定选择最小 user_id。
3. 客户端 userId 不参与所有权决定。
4. 若未来需要多用户身份，必须增加正式身份实体与会话映射，并开 ER 修宪。

## 派生与持久

- bmr：由 gender、age、height_cm、weight_kg 计算后持久化，S1 回填旧空值。
- 报告、每日汇总、7/30 日趋势：运行时派生，不建立持久视图。
- recognition_raw：可选脱敏 JSON，不含图片 data URL、密钥或供应商错误正文。
- is_adopted：ExerciseSuggestion 的持久用户决策，不是临时 UI 状态。
