# 迁移、回填与兼容责任

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
