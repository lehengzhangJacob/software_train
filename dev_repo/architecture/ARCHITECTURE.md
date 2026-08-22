# Nutrition Agent 架构

## C-13-S3-A1 原生拍照适配 amendment

Android 仍是渲染云端服务的薄壳，但“立即拍照”由宿主能力明确承接：原生平台通过
`@capacitor/camera` 打开系统相机，返回的内存 Data URL 交回现有食物识别组件，继续走
同一个 `/api/ai/recognize` → 人工审核 → `/api/meals` 事务链路。浏览器继续使用 HTML
文件选择器作为兼容回路；两端都不把原始照片写入 SQLite、Agent 对话或长期记忆。

这次 amendment 只改变 Android shell 与前端拍照组件之间的能力适配，不改变 API、数据模型、
审核语义或单一云端真相源。详见 ADR-0010。

## C-17 账户身份与授权边界

The product now supports invited user accounts while keeping the existing
single-instance SQLite delivery shape. Authentication is server-owned:

```text
browser / Android WebView
        -> /auth login or invite registration
        -> AuthSession cookie + database session
        -> middleware/API session validation
        -> UserAccount -> AccountSettings + UserProfile
        -> existing meal / agent / memory / health ownership queries
```

`UserAccount` is the identity and credential owner. `AccountSettings` owns
per-account AI/MCP configuration. `UserProfile` remains the
nutrition-domain owner so existing `user_id` foreign keys and historical data
do not need a destructive rewrite. The first successful registration may claim
an unbound imported profile; later registrations receive a new profile.

The shared `APP_ACCESS_TOKEN` gate is no longer the production authorization
boundary. During rollout it may be converted into a bootstrap invite only; it
must not be used to enter business pages or APIs after C-17.

## 系统上下文

Nutrition Agent 是私密、账户化的个人营养工具，同一代码基座有两个交付形态：本地开发实例（loopback）与云端交付实例（ADR-0007、ADR-0008）。成熟基线提供档案、餐食记录、营养看板、日历、运动建议和周期报告；C-03 在保留这些行为的前提下增加 GUI AI 配置、跨会话记忆、Agent 编排与受控 MCP 工具调用；C-11 将服务部署到公网服务器，浏览器与 Android 壳共用云端数据（含对话记录），C-17 增加数据库账户、邀请码注册、账户级设置隔离。浏览器不保存数据库，也不重新读取完整密钥；Next.js 服务端负责认证、业务编排、数据库访问、外部 AI 与工具动作策略。

~~~mermaid
flowchart LR
 U[单个用户] --> B[浏览器]
 U --> SH[Android 薄壳]
  B --> CD{{云端交付实例 8000 端口 账户会话门}}
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
| Next API | 校验输入、解析账户会话并绑定 profile、编排 DB、AI 与工具 | src/app/api/**, src/lib/** | confirmed；C-17-S4 已部署 |
| Prisma | 类型化持久化和正式 migration | prisma/schema.prisma, prisma/migrations/** | confirmed；C-03-M1 迁移现有数据库 |
| SQLite | 运行服务一侧的单写持久化：本地开发库与云端生产库各自单实例，云端库为生产真相源 | DATABASE_URL 指向的文件 | confirmed |
| AI Gateway | StepFun、OpenAI、DeepSeek、Qwen、Kimi、GLM、SiliconFlow、OpenRouter、Ollama 与自定义兼容服务 | src/lib/ai/**, src/app/api/ai/**, src/app/api/settings/ai/** | confirmed；C-03-M3 已实现 |
| Secret Store | GUI 配置的账户级 AI/MCP 凭据（SQLite `account_settings`）、首账户旧文件导入、仅本地兼容回退与脱敏读取 | src/lib/account/settings.ts, src/lib/ai/settings.ts, src/lib/mcp/settings.ts, data/credentials.json | C-17-S2 已实现 |
| Agent Runtime | 营养上下文、长期记忆与工具编排 | src/app/agent/**, src/lib/agent/** | confirmed；C-03-S2 已实现 |
| Memory Store | 对话、记忆来源、置信度、过期与用户治理 | Prisma + src/lib/memory/** + src/app/api/memories/** | confirmed；C-03-M4/S2 已实现 |
| MCP Gateway | 工具发现、白名单、超时与输出隔离 | src/app/api/mcp/**, src/lib/mcp/** | confirmed；C-03-S3 已实现，真实平台取决于用户授权连接器 |
| Action Policy | 搜索、草案、明确点餐授权和外部写操作边界 | src/lib/actions/** | approved target；C-06-L1 允许在明确点餐意图内创建一笔未支付订单 |
| Delivery | lint、typecheck、build、production smoke 与 CI | package scripts、release smoke、CI | confirmed；C-02-S7 已完成 |
| Cloud Delivery | 公网交付实例：standalone 构建产物 + systemd 常驻 + 数据库账户门 + 账户级凭据/SQLite（ADR-0007/0008/0009） | scripts/deploy.mjs, scripts/verify-cloud-gate.mjs, src/middleware.ts, src/lib/auth/**, src/lib/account/** | C-17-S4 已部署并通过公网回归 |
| dev_repo | 合同、架构、ER 与证据真相 | dev_repo/** | confirmed；C-03 已收口 |

## 关键运行流

### 建档与所有权

每个已认证账户绑定一个 `UserProfile`；服务端从 `AuthSession` 选择档案，业务 API 不接受客户端提供的 userId 作为所有权依据。旧的 primary profile 选择仅保留给本地兼容模式和首个账户认领导入数据。

### 餐食与 AI

图片经浏览器传给同源 AI Gateway，代理校验类型和体积，从当前账户的 Secret Store 读取提供商凭据并发起调用。识别结果必须先由用户审核餐别、份量和营养值，再显式保存；图片本体不写入 SQLite。

审核后的多项食物通过 /api/meals 的 items[] 合同一次事务保存，全成或全败。

若用户在识别请求完成前切换客户端路由，浏览器只可在当前会话中交接已经过 API 模式校验的结构化食物候选。交接数据不包含原图、Data URL、供应商错误原文、凭据或原始模型响应；回到餐食页后仍须经过同一人工审核门，才能写入 `/api/meals`。该交接不是数据库实体、离线队列或第二条识别 API，详见 ADR-0011。

### 运动与报告

/api/exercise/suggest 的 GET 返回候选和已采用计划，POST 采用计划，PATCH 取消采用；所有热量值由服务端依据 reference 和体重重新计算。报告返回包含今天的连续自然日序列，并显式标记未记录日期。

### Agent 结构化运动计划（C-24 / ADR-0014）

运动页的主展示源是按用户、日期和 revision 管理的 `AgentExercisePlan`。Agent 在教练回合中输出受限 `ExercisePlanPayload`，服务端先校验步骤、时长、强度、日期和文本边界，再与 assistant 消息在同一持久化流中保存。计划只保存安全的结构化字段，不保存原始模型响应、隐藏推理、凭据或工具原文。

运动页读取当天最高 revision 的 active 计划；没有计划时提供站内“让教练安排”入口，不在 GET 请求中静默调用模型。调整计划时，页面把拥有权已校验的 `planId` 和白名单内的 `returnTo=/exercise` 交给 Agent 工作台，Agent 生成新 revision 并将上一版标记为 superseded；回复卡片提供“回到运动计划”链接，运动页重新读取最新版本。

旧 `ExerciseSuggestion` 不删除、不重写。新增 migration 会以 `legacy_suggestion_id` 幂等镜像旧建议为 `source_kind=legacy_suggestion` 的计划历史，旧表继续保存完整原始记录；迁移前后必须通过行数、主键、integrity 和 foreign-key 检查。

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

### 云端交付与账户门（ADR-0007 / ADR-0008 / ADR-0009）

云端实例以本仓 standalone 构建产物部署（服务器上不构建），systemd 常驻 8000 端口，SQLite 与账户级设置位于服务侧。AUTH_REQUIRED=true 时，middleware 对未认证页面请求重定向 /access、业务 API（含 SSE）返回 401；登录和邀请码注册由 Node 运行时校验数据库会话，认证后持有 httpOnly ft_session cookie。旧 APP_ACCESS_TOKEN 只允许作为迁移期 bootstrap invite，不再授权业务页面或 API。云端 SQLite 是生产真相源，Web 与 Android 双端同源读取同一对话、记录、记忆和账户设置，不引入离线同步引擎。

### 版本感知交付与增量刷新（C-22 / ADR-0012）

每个构建从 standalone 产物的 `.next/BUILD_ID` 读取不可变 build id，并由只读
`/api/app/version` 以 `{ data, error }` 契约公开版本、构建和 Release 链接。该接口是唯一
公开的版本探测入口，响应 `Cache-Control: no-store`，不读取账户或业务数据；middleware
只为此元数据接口保留匿名例外。Browser 外壳把构建 id 作为当前页面的 server prop，按首屏、
focus、visibility 和低频定时器探测远端 build，发现差异后提示用户刷新。Next 的 hash 静态
资源继续由浏览器缓存，只下载发生变化的 chunk，不引入 Service Worker 或离线业务缓存。

Android 仍是指向 live 服务的 Capacitor WebView 薄壳；它复用同一版本探测流并在发现新构建
时提供用户确认的 Release/Android 包入口。壳不静默安装 APK、不持有第二个版本真相，原生
包的安装和升级仍由用户或后续应用商店能力完成。

### 数据与发布

Prisma migration 是生产 schema 唯一真相；database/schema.sql 降级为原始设计参考。SQLite 仅支持单进程/单实例写入。本地开发以 loopback 启动；云端实例经 deploy 管道发布（migrate deploy + 产物替换 + systemd 重启）。

## 明确不做

+- 不实现多租户、角色权限或公网 SaaS；账户体系只服务于当前单实例个人营养产品。
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

### Agent Trace observability (C-23 / ADR-0013)

The activity projection is upgraded to a complete, versioned current-turn
`AgentTraceEvent` stream. `agent.runtime` creates events at the real boundaries
of context reads, policy checks, model requests/deltas, MCP `callTool` calls,
retries, answer deltas, persistence, and terminal status. Every event is tied to
one `traceId`/`runId`, carries a monotonic sequence and optional parent step, and
contains only a bounded safe summary. Tool names are allowlisted labels; raw
arguments, results, provider error bodies, payment links, credentials and
hidden chain-of-thought never cross the API boundary.

The SSE transport emits `trace` envelopes plus answer `delta` events and a
terminal `done`; ordinary JSON clients still receive the existing completion
contract. The Browser inserts the user message optimistically, renders answer
deltas while they arrive, and reconciles the final thread once. The trace
workspace is nested/collapsible, keyboard accessible, responsive at 375px, and
ephemeral: only final user/assistant messages enter `AgentMessage`. Historical
trace replay or audit retention requires a separate ER/data-model amendment.
