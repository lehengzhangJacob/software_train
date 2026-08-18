# Nutrition Agent 架构

## C-17 账户身份与授权边界

The product now supports invited user accounts while keeping the existing
single-instance SQLite delivery shape. Authentication is server-owned:

```text
browser / Android WebView
        -> /auth login or invite registration
        -> AuthSession cookie + database session
        -> middleware/API session validation
        -> UserAccount -> UserProfile
        -> existing meal / agent / memory / health ownership queries
```

`UserAccount` is the identity and credential owner. `UserProfile` remains the
nutrition-domain owner so existing `user_id` foreign keys and historical data
do not need a destructive rewrite. The first successful registration may claim
an unbound imported profile; later registrations receive a new profile.

The shared `APP_ACCESS_TOKEN` gate is no longer the production authorization
boundary. During rollout it may be converted into a bootstrap invite only; it
must not be used to enter business pages or APIs after C-17.

## 系统上下文

Nutrition Agent 是私有单用户个人营养工具，同一代码基座有两个交付形态：本地开发实例（loopback）与云端交付实例（ADR-0007）。成熟基线提供档案、餐食记录、营养看板、日历、运动建议和周期报告；C-03 在保留这些行为的前提下增加 GUI AI 配置、跨会话记忆、Agent 编排与受控 MCP 工具调用；C-11 将服务部署到公网服务器，浏览器与 Android 壳共用云端数据（含对话记录），API/MCP 凭据收敛到云端。浏览器不保存数据库，也不重新读取完整密钥；Next.js 服务端负责业务编排、数据库访问、外部 AI 与工具动作策略。

~~~mermaid
flowchart LR
  U[单个用户] --> B[浏览器]
  U --> SH[Android 薄壳]
  B --> CD{{云端交付实例 8000 端口 共享访问码门}}
  SH --> CD
  SH --> HC[Health Connect]
  CD --> N[Next.js 16 / Node.js]
  B -. 本地开发 .-> N
  SH -. 形态A adb reverse .-> N
  N --> P[Prisma]
  P --> S[(SQLite 文件)]
  N --> A[AI Provider Gateway]
  N --> M[Memory Store]
  N --> T[MCP Tool Gateway]
  T --> X[外部搜索与动作服务]
~~~

## 容器与职责

| 容器 | 职责 | 权威文件 | 状态 |
|---|---|---|---|
| Browser UI | 页面、表单、图表、审核与交互状态 | src/app/**, src/components/** | confirmed |
| Android Shell | Capacitor 薄壳：WebView 渲染 live 服务，Health Connect 聚合同步（ADR-0005）；形态 B 直连云端（ADR-0007） | android/**, capacitor.config.ts, capacitor-web/** | confirmed；C-06-A1 已追认 |
| Next API | 校验输入、绑定 primary profile、编排 DB、AI 与工具 | src/app/api/**, src/lib/** | confirmed；C-03 已完成 |
| Prisma | 类型化持久化和正式 migration | prisma/schema.prisma, prisma/migrations/** | confirmed；C-03-M1 迁移现有数据库 |
| SQLite | 运行服务一侧的单写持久化：本地开发库与云端生产库各自单实例，云端库为生产真相源 | DATABASE_URL 指向的文件 | confirmed |
| AI Gateway | StepFun、OpenAI、DeepSeek、Qwen、Kimi、GLM、SiliconFlow、OpenRouter、Ollama 与自定义兼容服务 | src/lib/ai/**, src/app/api/ai/**, src/app/api/settings/ai/** | confirmed；C-03-M3 已实现 |
| Secret Store | GUI 配置的服务侧凭据（本地开发机或云端服务器 data/ 目录）、环境变量兼容回退与脱敏读取 | src/lib/ai/settings.ts, data/credentials.json | confirmed；C-03-M3 已实现 |
| Agent Runtime | 营养上下文、长期记忆与工具编排 | src/app/agent/**, src/lib/agent/** | confirmed；C-03-S2 已实现 |
| Memory Store | 对话、记忆来源、置信度、过期与用户治理 | Prisma + src/lib/memory/** + src/app/api/memories/** | confirmed；C-03-M4/S2 已实现 |
| MCP Gateway | 工具发现、白名单、超时与输出隔离 | src/app/api/mcp/**, src/lib/mcp/** | confirmed；C-03-S3 已实现，真实平台取决于用户授权连接器 |
| Action Policy | 搜索、草案、明确点餐授权和外部写操作边界 | src/lib/actions/** | approved target；C-06-L1 允许在明确点餐意图内创建一笔未支付订单 |
| Delivery | lint、typecheck、build、production smoke 与 CI | package scripts、release smoke、CI | confirmed；C-02-S7 已完成 |
| Cloud Delivery | 公网交付实例：standalone 构建产物 + systemd 常驻 + 共享访问码门 + 云端凭据/SQLite（ADR-0007） | scripts/deploy.mjs, scripts/verify-cloud-gate.mjs, src/middleware.ts, src/lib/access/** | C-11 修宪 accepted，实现进行中 |
| dev_repo | 合同、架构、ER 与证据真相 | dev_repo/** | confirmed；C-03 已收口 |

## 关键运行流

### 建档与所有权

应用只呈现一个 primary profile。服务端选择或创建该档案，业务 API 不接受客户端提供的 userId 作为所有权依据。此边界适合本地个人工具，不构成公网身份认证。

### 餐食与 AI

图片经浏览器传给同源 AI Gateway，代理校验类型和体积，从本机 Secret Store 读取当前提供商凭据并发起调用。识别结果必须先由用户审核餐别、份量和营养值，再显式保存；图片本体不写入 SQLite。

审核后的多项食物通过 /api/meals 的 items[] 合同一次事务保存，全成或全败。

### 运动与报告

/api/exercise/suggest 的 GET 返回候选和已采用计划，POST 采用计划，PATCH 取消采用；所有热量值由服务端依据 reference 和体重重新计算。报告返回包含今天的连续自然日序列，并显式标记未记录日期。

### 健康活动同步

Android 薄壳经用户授权读取 Health Connect 自然日聚合（步数、活动消耗、运动分钟数），按天 POST /api/health/sync 部分字段 upsert；GET /api/health/recent 按本地自然日窗口读取。服务端只持久化聚合值（daily_activity，(user_id, activity_date) 唯一），Health Connect 原始明细留在设备端；Web 端提供手动回填表单。壳不持有业务数据唯一真相，开发回路走 adb reverse loopback（ADR-0005）。

### 个性化页面

档案、餐食、看板、日历、运动和报告包含个人数据，必须按请求动态渲染，禁止在构建产物中静态固化。

### Agent 与受控工具

Agent 对话只持久化 user/assistant 消息，不保存 system prompt。每次请求注入当前档案、近 14 天餐食、近 7 天活动量（来源标注 health_connect / manual）、active/unexpired 记忆，以及「更早会话摘要 + 水位线后尾部 ≤24 条」的对话历史——长对话的旧消息由后台整理压缩为滚动摘要（每线程一行，按 ≥6h 空闲间隔切分会话段），历史只压缩不丢弃。模型可在回复末尾返回最多 3 条结构化长期记忆候选；服务端在保存 assistant 消息的同一事务中自动物化合法候选，不要求用户逐条确认。

会话整理在响应成功返回后的后置任务中执行：未折叠消息达到阈值时，AI 将水位线前消息整理进滚动摘要并蒸馏 ≤5 条记忆候选，候选复用既有物化规则（精确去重、active 复用、disabled 抑制），来源标记 session_digest；整理失败静默，下次触发重试，不影响对话主流程。

自动生成的 MemoryItem 必须保留 `agent_inference` 来源、置信度和来源消息。`is_user_confirmed` 仅表示用户是否审阅或修正过，不再是检索资格门；用户可以查看、编辑、停用和硬删除所有记忆。Agent 不得覆盖用户修正内容，也不得重新创建或恢复已被用户停用的同类精确记忆。

MCP Gateway 只暴露白名单工具，并限制输入、超时和输出体积。C-06 将真实连接器收敛为麦当劳中国官方 MCP。用户在当前消息中明确表达“帮我点麦当劳”等点餐意图后，该消息构成一次有限授权：Agent 可以结合档案、近期餐食、长期记忆、菜单营养和价格自主选择商品、计价，并最多创建一笔未支付订单。普通营养咨询、模糊饥饿表达、后台任务或历史消息都不能构成点餐授权。

创建未支付订单不等于支付授权。支付链接只在当前响应中交给用户，Agent 不得调用支付工具、代替用户打开确认后的支付动作、修改账户或连续创建订单；麦当劳 Token、支付链接和支付凭据不得进入 AgentMessage、MemoryItem 或日志。没有官方连接器、有效 Token、可用地址、可用门店或合法计价结果时，系统明确返回阻塞原因，不声称订单已经完成。

### 云端交付与访问门（ADR-0007）

云端实例以本仓 standalone 构建产物部署（服务器上不构建），systemd 常驻 8000 端口，SQLite 与凭据文件位于服务侧。共享访问码门由 middleware 执行：`APP_ACCESS_TOKEN` 未设置时全放行（本地开发零变化）；已设置时未认证页面请求重定向 `/access`、业务 API（含 SSE）返回 401，认证后持有 httpOnly cookie（访问码摘要）。云端 SQLite 是生产真相源，初始种子为本机库一次性拷贝；Web 与 Android 双端同源读取同一对话与记忆，不引入离线同步引擎。

### 数据与发布

Prisma migration 是生产 schema 唯一真相；database/schema.sql 降级为原始设计参考。SQLite 仅支持单进程/单实例写入。本地开发以 loopback 启动；云端实例经 deploy 管道发布（migrate deploy + 产物替换 + systemd 重启）。

## 明确不做

- 不实现注册、登录、多租户、角色权限或公网 SaaS（共享访问码门不是账号体系）。
- 不支持多副本共享同一 SQLite 文件。
- 不把营养估算或运动建议包装成医疗诊断。
- 不做离线双写同步引擎（云端中心化即同步）。
- 不在服务器上构建，不引入容器、多实例或 TLS 终止（域名到位前为已知债务）。

## 已知债务与归属

| 债务 | 负责切片 |
|---|---|
| 正式 migration、BMR/updatedAt 来源与 seed 幂等 | C-02-S1 |
| primary profile、DTO 校验、动态渲染 | C-02-S2 已完成 |
| 多食物审核后保存 | C-02-S3 已完成 |
| 运动建议采用/取消闭环；移除伪 AI 文本卡 | C-02-S4 已完成 |
| 本地日期窗口、连续报告与请求竞态 | C-02-S5 已完成 |
| 响应式、a11y 与视觉系统 | C-02-S6 已完成 |
| build/production smoke/CI/发布证据 | C-02-S7 已完成 |
### Agent activity observability

`/api/agent` keeps its existing JSON completion contract and additionally
accepts `Accept: text/event-stream` for an ephemeral current-turn activity
projection. The stream contains only safe labels, tool names, statuses, and
durations. The Browser UI renders it as a collapsible timeline; durable
`AgentMessage` history remains the canonical message projection.
