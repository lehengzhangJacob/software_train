# 迁移、回填与兼容责任

## 当前实物

- 当前数据库由 prisma db push 创建。
- database/schema.sql 声明过视图、trigger 和 CHECK，但当前 DB 并没有这些对象。
- 当前 demo DB 有多个测试档案；它不进入 Git，也不得在修宪切片中被直接修改。

## C-02-S1 已批准目标

1. datasource 使用 DATABASE_URL。
2. 建立 prisma/migrations 初始 migration，并明确 SQLite 单实例约束。
3. Prisma schema 使用 updatedAt 语义；服务层计算和持久化 BMR。
4. API 校验与数据库约束共同防止非法枚举、负数和坏日期。
5. reference seed 以 exercise_name 幂等 upsert，只写 ExerciseCalorieReference。
6. demo 用户和餐食若保留，必须迁到显式 demo fixture，不属于 db:seed。
7. 在当前数据库的只读副本上回填 bmr 空值并验证行数、integrity 和 foreign keys。

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
