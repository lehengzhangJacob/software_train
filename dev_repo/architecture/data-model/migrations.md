# 迁移、回填与兼容责任

## C-17 账户认证迁移

1. `20260818190000_add_account_auth` only creates `user_accounts`,
   `auth_sessions`, and `invite_codes`; it does not rewrite existing business
   tables or delete either imported `user_profile` row.
2. `UserAccount.profile_id` is unique and references `user_profile.user_id`.
   Existing profiles remain unbound until an invited registration claims one in
   an application transaction.
3. The claim operation is deterministic (lowest unbound `user_id` first),
   protected by the unique profile relation, and is the only compatibility
   backfill. Later registrations create a new profile with explicit defaults or
   registration inputs.
4. Migration verification must compare existing table row counts, primary-key
   sets, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and Prisma
   migration status on a database copy before production deployment.
5. The old `APP_ACCESS_TOKEN` may be copied into a hashed `InviteCode` bootstrap
   row on the server. It must not remain a middleware authorization shortcut.

## C-17-S2 账户设置迁移

1. `20260818193000_add_account_settings` creates only the one-to-one
   `account_settings` table; existing nutrition, conversation, memory, and
   activity rows are untouched.
2. Registration provisions one settings row after the account transaction.
   The first account may import the ignored legacy AI/MCP files; subsequent
   accounts receive validated defaults and never inherit another account's
   stored credential.
3. Account-scoped API reads do not use the legacy files or deployment
   environment variables as a fallback. Those sources remain available only
   when the local compatibility mode has no authenticated account.
4. Verification compares the existing business row counts and profile IDs,
   checks Prisma migration status plus SQLite integrity/foreign keys, and runs
   a two-account HTTP isolation smoke before cloud deployment.

## 当前实物

- 当前数据库由 prisma db push 创建。
- database/schema.sql 声明过视图、trigger 和 CHECK，但当前 DB 并没有这些对象。
- 当前 demo DB 有多个测试档案；它不进入 Git，也不得在修宪切片中被直接修改。

## C-02-S1 已实现

1. datasource 使用 DATABASE_URL。
2. 建立 prisma/migrations 初始 migration，并明确 SQLite 单实例约束。
3. Prisma schema 使用 updatedAt 语义；服务层计算和持久化 BMR。
4. SQLite baseline 保留主键、唯一索引和外键约束；枚举、数值与日期值域由 C-02-S2 的 API 白名单校验负责。
5. reference seed 以 exercise_name 幂等 upsert，只写 ExerciseCalorieReference。
6. demo 用户和餐食若保留，必须迁到显式 demo fixture，不属于 db:seed。
7. 已在当前数据库副本上回填 bmr 空值并验证行数、integrity、foreign keys 和 reference 主键稳定；原文件 SHA-256 未变化。

## C-03-M1 兼容迁移

1. `data/food_tracker.db` 只作为旧库来源读取，迁移前保存 SHA-256 并创建原样备份。
2. 旧库先复制到工作副本；baseline 仅在确认四张业务表与既有字段存在后标记为已应用。
3. `20260710130100_backfill_profile_bmr` 在副本上重算 BMR。
4. `20260710130050_retire_legacy_schema_objects` 在 BMR 回填之前退休四个统计视图和四个触发器，避免旧 trigger 改写 `updated_at`；汇总、BMR 与更新时间由应用和 Prisma 负责。
5. `20260815191000_normalize_legacy_tables` 快照自增序列后无损重建餐食、运动建议和运动参考表，去除旧 CHECK/default/index 命名差异、补齐外键 `ON UPDATE CASCADE`，并恢复原 `sqlite_sequence`。
6. 只有在主键、关系、行数、BMR、integrity、foreign key、schema diff 与 migration status 全部通过后，工作副本才能替换 `.env` 已指向的 `database/food_tracker.db`。
7. 原始旧库及其备份不参与运行时切换，也不进入 Git。

## C-03-M1 实测结果

- 原始旧库 SHA-256：`F0FF607BBC9FAB5F2AD7539EEBA2ADE323D9D9451F88FC6280524702C7B59C85`，迁移和切换后保持不变。
- 原样备份、迁移工作副本和旧运行库备份均保存在忽略目录 `data/backups/`。
- 旧库与迁移副本四表逐行相等，行数为 `2 / 14 / 2 / 32`，四张表主键集合与 `sqlite_sequence` 完全一致。
- 两个 profile 的 BMR 分别为 `1658.8` 与 `1276.5`，均与公式一致。
- 迁移副本和切换后的 `database/food_tracker.db` 均通过 integrity、foreign key、4 migration、零 schema diff 与 production smoke。
- 旧运行库已备份后由验证副本替换；`.env` 的 `file:../database/food_tracker.db` 无需改写。

## 兼容验证结果

- 全新库：0 用户、0 餐食、0 建议、25 条 reference、2 个 migration，重复 seed 幂等。
- 旧 demo 副本：2 用户、11 餐食、0 建议、25 条 reference，主键不变。
- BMR 回填：1658.8、1276.5。
- 两类数据库的 PRAGMA integrity_check 均为 ok，foreign_key_check 为空。
- Prisma 6.19.3 与 schema 无 diff；Node 24 可执行 migration。

## 兼容策略

- 不删除四张现有业务表或现有字段。
- 不自动删除第二个 demo profile，也不重挂其餐食。
- photo_path 保留兼容，但课程 AI 流程不再写入图片。
- recognition_raw 旧值允许为空；新值只保存脱敏结构化 JSON。
- 如果副本迁移无法保持主键、外键或行数，立即停止并开 red-line delta contract。

## C-03-M4 Agent 记忆迁移计划

1. 新增 agent_threads、agent_messages、memory_items 三张表及查询索引，不修改或重建既有四张业务表。
2. AgentThread.user_id 与 MemoryItem.user_id 指向 user_profile.user_id，删除档案时级联删除。
3. AgentMessage.thread_id 指向 agent_threads.thread_id，删除对话时级联删除消息。
4. MemoryItem.source_message_id 可空并指向 agent_messages.message_id，删除来源消息时 SET NULL。
5. 旧运行库迁移前保存副本；迁移后旧四表行数、主键集合、sqlite_sequence、integrity_check 和 foreign_key_check 必须保持有效。
6. 全新空库必须可从零应用全部 migration；旧运行库副本迁移后新增三表行数均为 0，不自动从餐食或档案回填记忆。
7. Prisma schema、migration SQL、ER 文档与 relationships.json 的级联/置空语义必须一致。

## C-03-M4A 实测结果

- 迁移前运行库备份：`data/backups/food_tracker.pre-agent-memory.20260815-2055.db`，与迁移前源文件 SHA-256 同为 `622D0BD19A90DFBE14734E135C6BA809661D8889066E88D5E4DD2B9E6BB069EF`。
- 旧运行库副本应用 5 条 migration 后，旧四表行数仍为 `2 / 14 / 2 / 32`，主键集合与旧表 sqlite_sequence 不变。
- agent_threads、agent_messages、memory_items 均为 0 行，没有从档案、餐食或建议自动回填。
- 全新空 SQLite 文件可从零应用 5 条 migration，并创建全部 7 张业务表。
- Thread 删除级联 Message；Message 删除将 MemoryItem.source_message_id 置空且保留 MemoryItem。
- 真实运行库应用新增 migration 后通过 integrity_check、foreign_key_check 和 migration status。
- production HTTP 临时副本验证 primary profile 隔离、服务端来源字段、停用筛选、硬删除和第二档案越权拒绝。

## C-05-A1 自动记忆兼容说明

1. 本次只改变 Agent 推断记忆的创建与检索语义，不增加、删除或重命名任何字段、索引、外键或表。
2. `is_user_confirmed=false` 表示尚未由用户审阅，不再表示不可进入上下文；现有 active、未过期的未确认行将按新语义参与检索。
3. 不执行历史回填。已有 user memory、confirmed memory、disabled memory 和来源关系保持原值。
4. disabled 精确匹配是用户抑制信号；应用升级后不得自动新增同内容行或将其恢复为 active。
5. 因 schema 不变，migration_required=false，backfill_required=false；兼容性由 Agent/Memory 合同测试和临时数据库 production API 验证负责。

## C-10 会话摘要迁移计划

1. 新增 `agent_session_digests` 表：digest_id 自增主键、thread_id 指向 agent_threads（唯一索引，ON DELETE CASCADE ON UPDATE CASCADE）、covered_message_id 水位线、summary TEXT ≤4000、created_at/updated_at。
2. 不修改或重建既有八张业务表；memory_items 的 source_kind 为应用层枚举扩展（session_digest），无列结构变化。
3. 新表零回填：未整理的既有对话保持无摘要行为，上下文退化为现状（尾部 ≤24 条）。
4. 副本迁移验证：八表行数/主键/integrity/foreign_key 迁移前后不变；全新空库可从零应用全部 migration。
5. 水位线语义：covered_message_id 单调递增，幂等保护并发整理。

## C-06-A1 DailyActivity 追认说明1. `20260817062220_add_daily_activity` 已随游离 commit `068a4c2`（2026-08-17）先行落地：新建 `daily_activity` 表、`(user_id, activity_date)` 唯一索引与查询索引、指向 `user_profile` 的 `ON DELETE CASCADE ON UPDATE CASCADE` 外键。C-06-A1 只做 ER 真相追认，不改一行已落地 SQL。
2. 新表零行起步：不回填历史步数或活动消耗，Agent 上下文在无数据时明确不使用活动量。
3. 兼容性：既有七张业务表与既有 migration 不受影响；全新库可从零应用全部 6 条 migration。
4. 写入语义：`POST /api/health/sync` 按 `(user_id, activity_date)` 部分字段 upsert；值域上限 steps ≤ 200000、exercise_minutes ≤ 1440、active_calories 非负保留一位小数；source_kind 仅 manual / health_connect。
5. 数据来源边界：服务端只存自然日聚合值；Health Connect 原始明细留在设备端，不进入 SQLite。

## C-24 AgentExercisePlan 迁移与 legacy 回填

1. 新增 `agent_exercise_plans`，保存 Agent 校验后的结构化计划、revision、来源线程/消息和可选的 `legacy_suggestion_id`；不重建或删除 `exercise_suggestions`。
2. migration 以 `legacy_suggestion_id` 为幂等键，将每条旧 `ExerciseSuggestion` 镜像为 `source_kind=legacy_suggestion`、`status=legacy` 的计划历史；原 `exercise_suggestions` 行、主键、采纳状态和估算字段保持不变。
3. legacy 镜像的 `plan_json` 只包含旧运动名称、时长、强度、原建议描述和旧采纳标记，不声称这是 Agent 生成的训练步骤；新 Agent 计划使用 `source_kind=agent`。
4. 迁移前必须复制 SQLite 文件。迁移副本验证旧运动表行数/主键集合不变，legacy 镜像数量等于旧建议行数，重复迁移不新增镜像，`PRAGMA integrity_check` 为 ok 且 `foreign_key_check` 为空。
5. 全新空库不生成 legacy 行；已有 AgentExercisePlan 的数据库升级不得重排 revision 或覆盖 active 计划。任何镜像失败都停止部署并保留失败副本。

## 验证

- prisma validate
- 临时空库 prisma migrate deploy
- reference seed 连续执行两次，行数和 business key 不变
- 数据库副本迁移前后表行数一致
- PRAGMA integrity_check 返回 ok
- PRAGMA foreign_key_check 为空
- 旧空 bmr 经过回填后为合理正数

## 回滚

迁移前复制 SQLite 文件。失败时停止应用、恢复备份文件并保留失败副本和日志；禁止在原文件上反复试错。
