# Data Model Constitution

## C-17-S2 account-scoped settings amendment

`AccountSettings` is a one-to-one child of `UserAccount`. It stores the
account's AI provider settings JSON and McDonald's MCP token/endpoint. The
first account may import the legacy runtime files as a compatibility backfill;
later accounts are created with empty settings. Account-scoped reads never
fall back to another account's file or environment credential.

本目录描述 Nutrition Agent 的持久事实、所有权、派生字段与迁移责任。

## 权威顺序

1. prisma/migrations/**：部署与升级的 schema 真相。
2. prisma/schema.prisma：ORM 类型与关系真相。
3. 运行数据库：当前实物，由 migration 创建和验证。
4. database/schema.sql：最初课程设计参考，不再作为隐式第二套部署 schema。

已接受但尚未落地的 ER 修宪以对应 ADR 和 `approved_target` 标记描述目标；在 migration 验证并提交前，不得把它叙述为当前运行数据库实物。

## 课程项目约束

- 新数据库允许 0 个 UserProfile，首次使用由用户建档。
- 应用只呈现一个 primary profile；旧 demo 数据可能有多行，S2 在服务端稳定选择最小 user_id，不自动删除历史行。
- 生产 reference seed 只写 ExerciseCalorieReference；demo 用户和餐食必须显式选择 demo fixture。
- 图片不写入数据库；recognition_raw 仅保存脱敏结构化识别结果或来源元数据。
- Agent 对话与长期记忆归属 primary profile；记忆必须可查看、修正、停用和删除，且不得保存凭据。

任何实体身份、关系、所有权、状态含义、数据库 provider、迁移或回填责任变化都需要 ER 修宪。
