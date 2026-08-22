# 实体关系与所有权

## C-17 账户实体与认证关系

| 实体 | 表 | 身份 | 所有权/说明 |
|---|---|---|---|
| UserAccount | user_accounts | account_id / login | 账户凭据与状态；一对一绑定 UserProfile |
| AuthSession | auth_sessions | session_id / token_digest | 可撤销的登录会话；多条会话属于一个 UserAccount |
| InviteCode | invite_codes | invite_id / code_digest | 注册邀请码；记录启用状态、使用次数和过期时间 |
| AccountSettings | account_settings | settings_id / account_id | 账户级 AI/MCP 配置与凭据；一对一属于 UserAccount |

新增关系：`UserAccount 1:1 UserProfile`、`UserAccount 1:N AuthSession`、
`UserAccount 1:1 AccountSettings`。
`InviteCode` 由注册事务消费，但不拥有业务数据。所有已有
`MealRecord`、`AgentThread`、`MemoryItem` 和 `DailyActivity` 仍通过
`UserProfile.user_id` 归属；服务端从当前 `AuthSession` 解析该 profile。

旧的 primary profile 规则仅用于兼容首次注册时认领导入档案，不再作为
生产授权边界。

## 实体

| 实体 | 表 | 来源 | 身份 | 所有者 |
|---|---|---|---|---|
| UserProfile | user_profile | 用户输入 + 派生 BMR | user_id | 课程应用 |
| AccountSettings | account_settings | 账户设置 UI + 首账户兼容导入 | settings_id | UserAccount |
| MealRecord | meal_records | 用户输入或审核后的 AI 结果 | record_id | UserProfile |
| ExerciseSuggestion | exercise_suggestions | 规则/AI 建议与采纳状态 | suggestion_id | UserProfile |
| AgentExercisePlan | agent_exercise_plans | Agent 校验后的结构化运动计划与 revision 历史 | plan_id | UserProfile |
| ExerciseCalorieReference | exercise_calorie_reference | 版本化 reference seed | exercise_id | 应用参考目录 |
| AgentThread | agent_threads | 用户创建或 Agent 工作台创建 | thread_id | UserProfile |
| AgentMessage | agent_messages | 用户、助手或工具的本地对话消息 | message_id | AgentThread |
| MemoryItem | memory_items | 用户输入、档案、餐食模式或 Agent 推断 | memory_id | UserProfile |
| DailyActivity | daily_activity | 设备 Health Connect 同步或用户手填的每日活动聚合 | activity_id | UserProfile |
| AgentSessionDigest | agent_session_digests | AI 对水位线前旧消息的滚动会话摘要 | digest_id | AgentThread（每线程至多一行） |

## 关系

- UserProfile 1:N MealRecord，通过 user_id，删除档案时级联删除。
- UserProfile 1:N ExerciseSuggestion，通过 user_id，删除档案时级联删除。
- UserProfile 1:N AgentExercisePlan，通过 user_id，删除档案时级联删除；计划可选地追溯到 AgentThread、来源 AgentMessage 或旧 ExerciseSuggestion。
- UserProfile 1:N AgentThread，通过 user_id，删除档案时级联删除。
- AgentThread 1:N AgentMessage，通过 thread_id，删除对话时级联删除消息。
- AgentThread 1:N AgentExercisePlan 为可选来源关系；删除对话时计划保留并将 thread_id 置空。
- AgentMessage 1:0..N AgentExercisePlan 为可选来源关系；删除来源消息时 source_message_id 置空，计划内容和 revision 历史保留。
- ExerciseSuggestion 1:0..1 AgentExercisePlan 为可选 legacy 镜像关系；legacy_suggestion_id 唯一，旧建议删除时镜像保留但来源置空。
- UserProfile 1:N MemoryItem，通过 user_id，删除档案时级联删除。
- AgentMessage 1:N MemoryItem 为可选来源关系；删除来源消息时 source_message_id 置空，长期记忆不被连带删除。
- UserProfile 1:N DailyActivity，通过 user_id，删除档案时级联删除；(user_id, activity_date) 唯一，同步按自然日部分字段 upsert。
- AgentThread 1:1 AgentSessionDigest（可选），删除对话时级联删除摘要；covered_message_id 水位线单调递增。
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
- AgentExercisePlan 是 Agent 输出经服务端校验后的持久结构化 artifact；`source_kind` 仅为 `agent` 或 `legacy_suggestion`，`status` 仅为 `active`、`superseded`、`legacy`、`archived`。
- 同一 UserProfile 同一天只能有一个 `active` Agent 计划；调整通过新 revision 替换 active，不能覆盖旧 revision。
- `plan_json` 只允许受限的日期、标题、目标、时长、强度、步骤和安全提示；不得包含原始模型响应、隐藏推理、凭据或工具原文。
- 每条旧 ExerciseSuggestion 都保留在原表；迁移以 `legacy_suggestion_id` 幂等创建 legacy 镜像，不能删除、覆盖或重复镜像。
- AgentMessage 保存可查看的本地历史，不保存 system prompt、完整工具原始响应或任何凭据。
- MemoryItem 是精选长期事实，不是全量对话副本；只允许 active 且未过期的记忆进入建议上下文。
- Agent 回复产生的合法推断记忆以 is_user_confirmed=false 自动创建；用户创建或修正后为 true，并记录 user_edited_at。该字段表示审阅来源，不控制记忆是否可被检索。
- confidence 表示来源可信度，importance 表示未来建议相关度，二者均为 0–1。
- 删除 MemoryItem 为硬删除；status=disabled 用于可逆停用。
- active 且未过期的推断记忆可以参与后续建议；精确重复候选复用现有 active 行，精确匹配 disabled 行时不得新增或恢复。
- AgentSessionDigest 是运行时派生的压缩摘要，不是对话副本：每线程一行，覆盖水位线之前的消息，按 ≥6h 空闲间隔切分会话段；来源为 session_digest 的记忆与推断记忆在治理界面同权。
- DailyActivity 只存步数、活动消耗与运动分钟数的自然日聚合；Health Connect 原始明细留在设备端，不落库。source_kind 区分 health_connect 自动同步与 manual 手填。
