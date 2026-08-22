# ADR-0014: Agent 结构化运动计划与旧建议迁移

## 状态

Accepted under C-24-A1.

## 背景

`/exercise` 原先展示的是 `ExerciseSuggestion` 的规则型候选。它能依据当天餐食热量和体重估算时长，但没有 Agent 计划、教练调整、步骤结构或跨页面返回语义。旧建议已经进入生产 SQLite，不能因为切换到 Agent 计划而丢失。

## 决策

1. Agent 生成受限的 `ExercisePlanPayload`：日期、标题、目标、总时长、强度、步骤和安全提示。模型原文、隐藏推理、凭据和未校验 JSON 不进入数据库。
2. 服务端校验后将每次 Agent 计划保存为 `AgentExercisePlan`。同一用户同一天的调整创建新 revision，旧 active 版本标记为 `superseded`；计划通过来源线程和 assistant 消息追溯，但删除消息不删除计划。
3. 旧 `ExerciseSuggestion` 表和字段保持不变。迁移会为每条旧建议创建一条 `source_kind=legacy_suggestion` 的 `AgentExercisePlan` 镜像，并以 `legacy_suggestion_id` 做幂等键；旧表仍是完整历史源，迁移失败必须停止，不得删除或覆盖旧行。
4. 运动页只读取当前 Agent 计划和迁移后的 legacy 计划历史。没有当前计划时，页面提供“让教练安排”入口，不在 GET 请求中静默触发模型。
5. 运动页到教练页携带经过白名单校验的 `planId` 和站内 `returnTo`。教练回合完成后提供“回到运动计划”入口，返回页重新读取最新 revision。

## 计划数据边界

- `planDate` 使用 `YYYY-MM-DD`；步骤数量 1–8；总时长 5–180 分钟。
- `kind` 仅为 `warmup`、`cardio`、`strength`、`mobility`、`cooldown`；强度仅为 `low`、`moderate`、`high`。
- 步骤名称、说明、安全提示和标题都有长度上限；服务端拒绝未知字段、非有限数字和空步骤。
- 运动建议不是医疗诊断，也不使用模型生成的精确热量作为安全依据。

## 兼容与迁移

- 新 migration 只新增 `agent_exercise_plans` 及必要索引/外键，不重建或删除既有运动表。
- migration SQL 在同一事务中按 `legacy_suggestion_id` 幂等镜像旧建议；新库为空时不生成 legacy 行。
- 迁移前后必须比较旧表行数、主键集合、`PRAGMA integrity_check`、`PRAGMA foreign_key_check` 和 Prisma migration status。
- 任何失败都保留备份和失败副本，禁止在生产 SQLite 上反复试错。

## 不变项

- 账户、Agent 消息历史、MemoryItem、Health Connect 聚合和 MCP 点餐授权边界不变。
- `/api/exercise/suggest` 保留兼容，既有客户端和演示数据仍可读取；新运动页不再把它当作 Agent 计划来源。
- Agent Trace 仍只输出安全标签、状态、时长和答案增量。

## 验证

- 计划契约单测覆盖合法、非法、marker 隐藏和 legacy 映射。
- 临时空库与带旧 `ExerciseSuggestion` 的副本分别执行 migration；验证镜像幂等和旧行不变。
- Browser 同一账号完成运动页、教练调整、返回新 revision 的桌面/375px 验收。
