# ADR-0018 日更文章后台生成边界

状态：approved（C-28-A1）  
日期：2026-08-23

## 背景

日更文章已经由受保护的 systemd content timer 在服务端生成，但应用内的
`POST /api/agent/articles` 仍直接等待 Agent 文本生成、正文落库和图片补齐。
这会让用户把一次“提交生成”误解为一次同步请求，也会把 provider 的长耗时和
暂时失败暴露在页面请求生命周期内。

## 决策

1. 认证的 `POST /api/agent/articles` 只负责按 `(user_id, content_date)` 幂等创建或
   复用 `AgentDailyArticleBatch`，持久化待处理状态，并以 `202 Accepted` 返回当前批次摘要。
2. 正文生成、校验、文章落库和 DashScope 图片补齐由长驻 Node 服务的后台 job 执行；
   user-level systemd timer 仍是跨重启的恢复兜底。公开请求不得等待这些步骤完成。
3. `AgentDailyArticleBatch.status` 使用既有状态流 `pending → generating → ready/failed`。
   任务失败保留可重试状态，重复请求不得新建同日批次或重复 slot。
4. `/api/agent/articles` GET 继续只读；阅读流根据批次状态显示“后台整理中/已完成/可重试”，
   并在 pending/generating 时低频刷新，ready 或卸载后停止刷新。
5. provider 凭据、原始响应、隐藏推理、DashScope 临时 URL 和图片字节仍只在服务端边界内。

## 不变的边界

- 不新增表、字段、关系、迁移或历史回填；复用 C-25 已落地的批次状态字段。
- 不改变十篇文章合同、账户隔离、文章阅读状态、结构化视觉 fallback 或图片 asset key 语义。
- 不改变 AgentMessage、Agent Trace、AgentExercisePlan、MealRecord、MemoryItem 或 Issue 状态。

## 验证

- 白盒：provider 永不返回时，认证 POST 仍快速返回 202；同账号同日请求保持一个批次。
- 运行时：后台完成后同一批次转为 ready 且包含 10 个 slot；失败可由 timer 重试。
- 云端：记录 202 响应与后续状态推进，验证 internal job 的 401/200 边界和 timer active。
- Browser：桌面与 375px 阅读流显示后台状态，无 console error 或横向溢出。
