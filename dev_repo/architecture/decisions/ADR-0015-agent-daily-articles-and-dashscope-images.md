# ADR-0015 Agent 日更图文与 DashScope 异步生图

状态：approved（C-25-A1）  
日期：2026-08-22

## 背景

产品需要根据账户已经授权的营养档案、餐食汇总、活动量、运动计划、长期记忆和会话摘要，
每天为每个账户生成 10 篇独立的中文营养/运动文章，并在应用内以未读阅读流呈现。
现有 AI gateway 只封装 OpenAI-compatible chat/vision 请求；DashScope 的图像生成接口是
独立的异步任务接口，不能假设它等同于 `/chat/completions`。

## 决策

1. **文本与图片分离**：文章正文由现有账户级 AI provider 生成；图片由 server-owned
   `DashScopeImageAdapter` 调用 Qwen-Image/兼容的 DashScope 图像接口生成。客户端永远不
   直接调用 DashScope，也不接触 API Key。
2. **批次幂等**：`AgentDailyArticleBatch` 以 `(user_id, content_date)` 唯一；批次只在
   10 篇经过校验的文章落库后标记 `ready`。失败批次可重试，不覆盖已经 ready 的批次。
3. **图片异步补齐**：正文先落库，文章先以结构化 `visual_json` 作为可用视觉 fallback；
   DashScope 返回 `task_id` 后由 job 轮询，成功后立即下载图片并更新文章的 `image_asset_key`。
   图片生成失败不会让用户失去当天文章。
4. **持久化图片引用而非临时 URL**：DashScope 的图片 URL 只作为短期下载源；数据库仅保存
   provider task id、状态、MIME type 和不含 `..`/绝对路径的 asset key。文件落在云端
   `shared/data/article-images/`（本地开发为 `data/article-images/`），通过账户隔离的
   `/api/agent/articles/[articleId]/image` 返回。
5. **安全上下文**：生成 prompt 只允许档案、餐食/活动聚合、active 且未过期记忆、active
   运动计划和会话摘要；不传输或持久化 system prompt、隐藏推理、凭据、支付链接、原始
   provider 响应或图片 data URL。文章输出必须通过字段、长度和安全词边界校验。
6. **每日触发**：云端以 user-level systemd timer 调用受 token 保护的内部 job route；job 对所有 active
   账户执行当天批次，重复触发安全。应用内列表 API 只读/更新当前账户，不承担跨账户批处理。
7. **通知范围**：C-25 第一版的“推送”是每日批次 + 未读数 + 首页提醒。浏览器/Android
   系统通知需要独立的 VAPID/FCM 凭据与权限链，不在没有探针证据时宣称已交付。

## DashScope 适配细节

- 默认模型为 `qwen-image-3.0-pro`，由 `DASHSCOPE_IMAGE_MODEL` 覆盖；若账户/区域没有该
  模型权限，adapter 将记录安全失败并保留本地视觉 fallback。
- 默认地域为 `cn-beijing`，支持 `DASHSCOPE_IMAGE_BASE_URL` 或
  `DASHSCOPE_WORKSPACE_ID` + `DASHSCOPE_IMAGE_REGION` 显式覆盖。地域和 Workspace 必须
  与 API Key 所属百炼空间一致。
- 创建任务使用 `X-DashScope-Async: enable`，随后以受限间隔查询 `/api/v1/tasks/{task_id}`。
  任务结果成功后立即下载，下载大小、MIME type、重定向次数和 URL scheme 均受限。
- `image_task_id` 只用于重试/观测，不是用户可见内容；provider 错误原文不进入文章、API
  响应或日志。
- 部署用户的 systemd user manager 负责 content timer；主应用仍由既有 systemd system unit 常驻，
  不扩大 `/etc/systemd/system` 写入权限。

## 不变的边界

- 不修改 AgentMessage、Agent Trace、MemoryItem、MealRecord、DailyActivity 或
  AgentExercisePlan 的既有字段和语义。
- 不删除或回填历史餐食、对话、记忆、运动建议/计划；C-25 migration 只创建新表。
- Android 仍是云端 WebView 薄壳，不拥有图片或文章数据真相；认证和 account scope 仍由
  当前 AuthSession → UserProfile 解析。

## 验证

- schema/migration：空库与现有副本均可 migrate deploy，旧表行数/主键/integrity 不变。
- generation：mock provider 的 malformed/越界输出被拒绝；同一账号同一天重复 job 不增行，
  结果始终为 10 篇 ready 文章。
- image：mock DashScope task create/poll/download 通过；临时 URL 不落库，落盘 asset 可由
  当前账户访问且其他账户收到 404；无 key/模型权限时 fallback 可用。
- cloud：systemd service/timer 可观测，三测试账号隔离，Browser 桌面/375px 阅读流无溢出、
  无 console error。
