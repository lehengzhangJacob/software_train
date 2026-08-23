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
30. Native Android “立即拍照” uses the Capacitor Camera bridge and re-enters the
    existing recognition/review/save path; the shell does not create a second
    photo API or durable image store. Browser capture keeps its file-input
    fallback, and cancellation/errors cannot be reported as recognition success.
31. A client-route change may hand off only a bounded, schema-validated food
    recognition result within the same browser session. The handoff must never
    contain image data, provider error bodies, credentials, raw model output,
    or a durable meal record; the existing human review gate remains mandatory.

1. 产品边界是私密、账户化的个人营养 Agent；本地开发与云端交付实例共享同一代码与单实例 SQLite 模型，云端公网可达性由数据库账户会话约束（ADR-0007/0008）。引入多租户、角色权限或离线双写同步引擎必须另开架构与 ER 修宪合同。
2. 个性化页面必须动态渲染，构建产物不得包含用户档案或餐食 PII。
3. 服务端从有效 AuthSession 确定账户及其 UserProfile；业务 API 不信任客户端传入的 userId。
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
21. 云端实例未设置 `AUTH_REQUIRED=true` 和有效 bootstrap invite 前不得开放账户注册；旧 `APP_ACCESS_TOKEN` 只允许作为迁移期邀请码输入，不是业务授权凭据。
22. 公网未认证请求不得触达任何业务 API（含 SSE）或个性化页面；认证使用 httpOnly `ft_session` cookie，原始密码、会话值和邀请码不得出现在响应体、日志或前端可见面。
23. 云端部署只接收本仓构建产物，不在服务器上构建；.env.production 权限 0600 且不入 Git；本地开发回路（localhost / adb reverse）始终保持可用。
32. `/api/app/version` 只公开版本、build id 和 Release 链接等非敏感元数据，响应为 `data/error` 且 `Cache-Control: no-store`；它是 `AUTH_REQUIRED=true` 下唯一为版本探测保留的匿名 API 例外。
33. Browser 当前页面与 `/api/app/version` 必须比较同一构建的 build id；同 build 不提示，发现新 build 才提示刷新；更新检测不得持久化账户或营养数据。
34. Next hash 静态资源可按变化 chunk 增量下载，但不得用 Service Worker、离线数据库或 stale personalized HTML 形成第二份业务真相。
35. Android 薄壳只消费云端版本契约并提供用户确认的 Release/下载入口；不得静默安装 APK、建立独立版本源或改变 Health Connect/相机边界。

36. 每个 Agent 回合的 Trace 事件必须属于同一 `traceId`/`runId`，拥有唯一事件 id、严格递增的
    `sequence` 和 ISO 时间戳；父子步骤只能通过 `parentId` 表达，不能用 UI 猜测调用关系。
37. Trace 事件只能由真实执行边界产生。上下文读取、模型请求/增量、MCP `callTool`、重试、答案
    增量、最终保存和终态必须可追踪；没有实际执行的工具调用和人工打字机效果始终禁止。
38. Trace 对外投影只允许版本化字段、白名单工具名、有限状态、耗时、脱敏摘要和答案增量；原始
    工具参数/结果、隐藏思维链、system prompt、凭据、供应商错误原文、URL 和支付链接不得进入
    SSE、AgentMessage、MemoryItem 或日志。
39. `/api/agent` 的 JSON 完成合同保持兼容；SSE 断线不能改变服务端业务结果、触发重复持久化或
    重复创建未支付订单。非流式模型必须以 `fallback` 语义呈现，不能伪装为流式。
40. Browser 必须在发送瞬间显示本次 user bubble；最终 thread 对账按稳定消息身份只保留一份 user
    和 assistant。流中断保留输入并给出可重试错误，不能静默清空草稿。
41. Trace UI 在 375px–1440px 可读、可键盘/读屏理解，摘要必须换行且不产生横向溢出；自动跟随仅
    在用户接近底部时启用，不能抢夺用户正在查看的历史位置。
42. 当前回合 Trace 是临时投影，不新增 Prisma 实体、迁移、回填或历史回放语义；任何跨回合留存
    需求必须另开 ER/data-model amendment。

43. `AgentDailyArticleBatch` 必须按 `(user_id, content_date)` 唯一；ready 批次必须恰好有
    slot 1–10 的十篇 `AgentDailyArticle`，重复 daily job 不得复制批次或 slot。
44. 日更文章只使用允许的账户上下文。文章 `content_json`/`visual_json` 是经过服务端校验的
    派生内容，不得包含凭据、支付信息、原始 provider 响应、隐藏推理或图片 data URL。
45. DashScope 生图任务只能由服务端调用；临时 image URL 必须在有效期内下载为受限 asset key，
    数据库不得保存临时 URL 或图片字节。图片读取必须再次校验当前 AuthSession、profile 所有权、
    asset 路径和 image MIME；失败时必须提供结构化视觉 fallback。
46. 日更 job 只能通过 token 保护的内部接口触发，运行日志只记录 batch/slot、状态和脱敏错误码；
    未配置 token、DashScope key 或模型权限时不得宣称自动系统通知已启用。
47. 认证 `/api/agent/articles` POST 只允许创建/复用当天批次并返回 `202 Accepted`；响应前不得
    等待 Agent 文本生成、文章落库或 DashScope 图片任务。
48. 日更批次必须沿 `pending → generating → ready/failed` 推进；长驻后台 job 负责执行，systemd
    timer 负责跨重启恢复，重复请求不得复制 `(user_id, content_date)` 或 slot。
49. `/api/agent/articles` GET 与 `/insights` 观察流不得触发 provider；pending/generating 只显示
    后台状态，ready/failed 后停止轮询或给出可重试入口。
