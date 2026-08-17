# 实体关系与所有权

## 实体

| 实体 | 表 | 来源 | 身份 | 所有者 |
|---|---|---|---|---|
| UserProfile | user_profile | 用户输入 + 派生 BMR | user_id | 课程应用 |
| MealRecord | meal_records | 用户输入或审核后的 AI 结果 | record_id | UserProfile |
| ExerciseSuggestion | exercise_suggestions | 规则/AI 建议与采纳状态 | suggestion_id | UserProfile |
| ExerciseCalorieReference | exercise_calorie_reference | 版本化 reference seed | exercise_id | 应用参考目录 |
| AgentThread | agent_threads | 用户创建或 Agent 工作台创建 | thread_id | UserProfile |
| AgentMessage | agent_messages | 用户、助手或工具的本地对话消息 | message_id | AgentThread |
| MemoryItem | memory_items | 用户输入、档案、餐食模式或 Agent 推断 | memory_id | UserProfile |
| DailyActivity | daily_activity | 设备 Health Connect 同步或用户手填的每日活动聚合 | activity_id | UserProfile |

## 关系

- UserProfile 1:N MealRecord，通过 user_id，删除档案时级联删除。
- UserProfile 1:N ExerciseSuggestion，通过 user_id，删除档案时级联删除。
- UserProfile 1:N AgentThread，通过 user_id，删除档案时级联删除。
- AgentThread 1:N AgentMessage，通过 thread_id，删除对话时级联删除消息。
- UserProfile 1:N MemoryItem，通过 user_id，删除档案时级联删除。
- AgentMessage 1:N MemoryItem 为可选来源关系；删除来源消息时 source_message_id 置空，长期记忆不被连带删除。
- UserProfile 1:N DailyActivity，通过 user_id，删除档案时级联删除；(user_id, activity_date) 唯一，同步按自然日部分字段 upsert。
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
- AgentMessage 保存可查看的本地历史，不保存 system prompt、完整工具原始响应或任何凭据。
- MemoryItem 是精选长期事实，不是全量对话副本；只允许 active 且未过期的记忆进入建议上下文。
- Agent 回复产生的合法推断记忆以 is_user_confirmed=false 自动创建；用户创建或修正后为 true，并记录 user_edited_at。该字段表示审阅来源，不控制记忆是否可被检索。
- confidence 表示来源可信度，importance 表示未来建议相关度，二者均为 0–1。
- 删除 MemoryItem 为硬删除；status=disabled 用于可逆停用。
- active 且未过期的推断记忆可以参与后续建议；精确重复候选复用现有 active 行，精确匹配 disabled 行时不得新增或恢复。
- DailyActivity 只存步数、活动消耗与运动分钟数的自然日聚合；Health Connect 原始明细留在设备端，不落库。source_kind 区分 health_connect 自动同步与 manual 手填。
