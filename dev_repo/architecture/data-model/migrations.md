# 迁移计划

## 初始迁移 (S1)

将现有 SQLite schema 通过 Prisma 重新声明并建表。

### 步骤

1. 从 `database/schema.sql` 提取 4 张核心表定义
2. 编写 `prisma/schema.prisma` 与 SQL schema 1:1 映射
3. 执行 `prisma db push` 创建 SQLite 数据库文件
4. 迁移种子数据到 `prisma/seed.ts`
5. 运行 seed 脚本填充初始数据

### Rollback

删除数据库文件 + 撤销 Prisma 相关代码即可回退。

## 后续迁移

除非需求变更导致 schema 改动，否则不产生新 migration。
视图和触发器不通过 Prisma 管理，保留在 `database/schema.sql` 中。
