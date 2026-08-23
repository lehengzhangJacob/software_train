# C-25 日更内容运行契约

## 批次语义

- 每个 `UserProfile` 每个 `content_date` 只有一个 `AgentDailyArticleBatch`。
- 一个 ready 批次恰好包含 slot 1–10 的十篇独立文章；没有历史批次回填。
- 文本文章在服务端校验通过后立即可读；图片可以处于 `pending/running/ready/fallback`，
  但每篇始终有 `visual_json`，所以不会出现空白媒体位。
- `read_at`、`saved_at`、`hidden_at` 是用户状态，必须按当前认证 profile 更新。

## 允许的上下文

`UserProfile` 目标和基础指标、最近 30 天餐食的聚合与有限明细、最近 14 天活动聚合、
active AgentExercisePlan、active 且未过期 MemoryItem、最近会话摘要。文章生成不读取
原始图片、密钥、工具原文、隐藏推理或完整 Agent Trace。

## 文章合同

文章保存为受限 JSON：`summary`、1–4 个 `sections`、2–4 条 `takeaways`、一条 `action`、
一条 `safetyNote`。每一项都有长度上限；诊断、处方、密钥、data URL 和 provider 错误
会使该结果无效。`visual_json` 仅允许有限图表种类、标签和非负数值。

## 图片合同

DashScope 只在服务端异步调用。成功 URL 立即下载到 `data/article-images`，数据库只保存
`image_asset_key` 和 `image_mime_type`。API 通过路径解析和账户所属校验返回图片；绝对路径、
路径穿越、非 image MIME、过大文件和跨账户文章均拒绝。

## 触发与重试

云端 systemd user timer 触发受 token 保护的内部 job。job 先确保文字批次，再处理待补图文章；
重复执行使用批次唯一键和文章 slot 唯一键。provider 临时失败只留下安全 fallback 和
可重试状态，不覆盖已经 ready 的内容。

## 应用内后台入队（C-28 / ADR-0018）

认证用户从 `/api/agent/articles` 发起生成时，公开 POST 只创建或复用当天的批次并返回
`202 Accepted` 与状态摘要；它不等待 Agent、正文落库或 DashScope。长驻 Node 服务在响应后
调度后台 job，user-level systemd timer 负责跨重启拾取 `pending/failed` 批次。

阅读流只读取批次状态：`pending/generating` 显示后台整理中，`ready` 显示可阅读文章，
`failed` 显示可重试提示。轮询是低频、可取消的观察机制，不是第二个生成器；GET 不触发
provider 调用，重复点击不产生第二个 `(user_id, content_date)` 批次。
