# 架构不变项

1. 所有 API 响应格式统一为 `{ data, error }`
2. 前端不直接调用 Step-3.7 Flash API，必须经过 `/api/ai` 代理
3. 数据库 schema 以 `database/schema.sql` 为权威来源，Prisma schema 需与之 1:1 映射
4. 所有页面在 375px 宽度必须可读可用
5. 不允许在任何用户界面使用 emoji 作为设计元素
6. 热量单位统一为「千卡」，重量单位为「克」
7. 数字保留一位小数
8. 日期格式 YYYY-MM-DD
9. Step-3.7 Flash API key 只存在于环境变量 `.env`，不硬编码
