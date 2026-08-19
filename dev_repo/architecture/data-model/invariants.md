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
15. AgentThread 与 MemoryItem 必须属于 primary profile；客户端 userId 不构成所有权证据。
16. 删除 AgentThread 必须级联删除 AgentMessage；删除来源 AgentMessage 只能将 MemoryItem.source_message_id 置空。
17. AgentMessage.role 仅为 user、assistant、tool；不持久化 system prompt。
18. AgentMessage.metadata_json、MemoryItem.content 和 source_ref 不得包含密钥、支付凭据、图片 data URL 或供应商错误正文。
19. MemoryItem.category 仅为 preference、constraint、goal、habit、context、insight；status 仅为 active、disabled。
20. confidence 与 importance 必须在 0–1；Agent 推断默认 is_user_confirmed=false，用户创建或修正后为 true；该字段只表示用户审阅来源，不构成检索资格门。
21. 个性化检索只使用 active 且未过期的 MemoryItem，包括尚未由用户审阅的 Agent 推断；disabled 或 expires_at 已过期项不得进入模型上下文。
22. 用户可查看、修正、停用和硬删除 MemoryItem；删除不得留下不可见的第二份持久记忆。
23. 自动记忆不得覆盖用户修正内容；精确 active 重复必须复用，精确 disabled 重复必须视为用户抑制并保持停用。
24. DailyActivity 必须属于 primary profile；(user_id, activity_date) 唯一，同步写入走部分字段 upsert，不得为同一自然日建重复行。
25. DailyActivity 只存自然日聚合值；Health Connect 原始明细不得进入 SQLite。steps 为 0–200000、exercise_minutes 为 0–1440、active_calories 非负。
26. source_kind 仅为 manual、health_connect；健康数据不得进入 MemoryItem 或 AgentMessage 的持久内容。
27. AgentSessionDigest 每线程至多一行；covered_message_id 单调递减禁止；删除对话必须级联删除摘要。
28. 摘要为 AI 派生的压缩整理，不是对话副本；摘要与 session_digest 来源记忆不得包含密钥、令牌、支付链接或图片原文。
29. source_kind=session_digest 的记忆与 agent_inference 记忆在用户治理（查看/编辑/停用/删除）上完全同权，物化必须复用既有去重/复用/抑制规则。
