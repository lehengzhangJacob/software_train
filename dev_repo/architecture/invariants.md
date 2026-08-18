# 架构不变量

## C-17 account amendment

The earlier single-user statement is superseded by this amendment:

24. Every production business request is bound to an active `AuthSession`, a
    `UserAccount`, and exactly one `UserProfile`; client-supplied `userId` is
    never an ownership authority.
25. `UserAccount.login` is unique, passwords are stored only as salted hashes,
    session and invite tokens are stored only as SHA-256 digests.
26. Existing nutrition and conversation rows are preserved. The first invited
    registration may claim an unbound imported profile exactly once; later
    accounts cannot claim or read another account's profile.
27. The AI gateway, MCP action policy, memory provenance, Health Connect raw
    data boundary, and single-instance SQLite authority remain unchanged.
28. `AccountSettings` is one-to-one with `UserAccount`; account-scoped AI and
    McDonald's settings are read and written only through the authenticated
    account. A later account never inherits another account's stored secret.
29. Legacy credential files and deployment environment variables are compatibility
    inputs only. Account-scoped reads do not fall back to another account's file
    or environment credential.

1. 产品边界是私有单用户个人营养 Agent；本地开发与云端交付实例共享同一代码与单用户模型，云端公网可达性仅由共享访问码门约束（ADR-0007）。引入个人账号体系、第二并发用户或离线双写同步引擎必须另开架构与 ER 修宪合同。
2. 个性化页面必须动态渲染，构建产物不得包含用户档案或餐食 PII。
3. 服务端负责确定 primary profile；业务 API 不信任客户端传入的 userId。
4. API 响应统一为 { data, error }，客户端错误不得暴露堆栈、SQL、供应商响应或密钥。
5. AI 密钥可由 GUI 提交，但完整值只允许由本机服务端持有；禁止 NEXT_PUBLIC_*、源码常量、业务记忆、API 回包和日志输出。
6. AI 识别结果必须人工审核后保存；无 AI、超时或失败不得伪装为 AI 成功。
7. Prisma migration 是生产 schema 唯一真相；database/schema.sql 只是设计参考。
8. SQLite 每个部署实例只允许单写入者；本地开发库与云端生产库各自单实例，云端库是生产真相源。任何多实例写入或托管数据库切换都需要架构修宪。
9. 迁移必须先在数据库副本上验证，不得直接破坏现有课程数据。
10. 所有页面在 375px–1440px 可读可用，移动底栏不得遮挡内容或 safe area。
11. 日期使用 YYYY-MM-DD 作为持久格式，7/30 日语义是包含今天的严格自然日窗口。
12. 热量使用“千卡”，重量使用“克/千克”；数值展示遵守各字段精度。
13. 营养和运动结果是估算，不得作为医疗诊断；涉及外部 AI 时必须提示人工复核。
14. MCP 工具输出视为不可信输入；工具必须经过能力白名单、超时和参数校验。
15. 搜索、菜单读取、计价和订单草案可以自动执行。仅当当前用户消息明确表达麦当劳点餐意图时，Agent 才可自主选择商品并最多创建一笔未支付订单；支付、账户变更、普通咨询触发建单和同一请求重复建单始终禁止。
16. 长期记忆必须记录来源和置信度；Agent 可以在对话收尾阶段自动生成 active 推断，但所有记忆必须允许用户查看、修正、停用与删除，且用户停用的精确内容不得被自动恢复；密钥和支付凭据不得进入记忆。
17. 每个实现切片必须独立验证、独立提交并更新 dev_repo 证据。
18. Android 壳是渲染 live 服务的薄壳，不持有业务数据唯一真相；Health Connect 仅经用户授权读取自然日聚合并 POST 同步，原始明细不进入服务端持久层（ADR-0005）。
19. 长对话上下文 = 滚动会话摘要 + 水位线后尾部消息；历史只被压缩整理，不得静默丢弃。后台整理在响应返回后非阻塞执行，失败静默留待下次，绝不影响对话主流程；整理产物（摘要与 session_digest 记忆）遵守既有脱敏与记忆治理规则。
20. Activity 仅展示当前回合的安全摘要；不得持久化凭据、原始工具参数、原始工具结果或支付链接。
21. 云端实例未设置 APP_ACCESS_TOKEN（共享访问门）前不得绑定公网地址；该 token 未设置时全链路行为与本地开发完全一致（ADR-0007）。
22. 公网未认证请求不得触达任何业务 API（含 SSE）或个性化页面；访问码以 httpOnly cookie 携带摘要值，访问码本身不得出现在响应体、日志或前端可见面。
23. 云端部署只接收本仓构建产物，不在服务器上构建；.env.production 权限 0600 且不入 Git；本地开发回路（localhost / adb reverse）始终保持可用。
