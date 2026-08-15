# Nutrition Agent 架构

## 系统上下文

Nutrition Agent 是本地优先的私有单用户个人营养工具。成熟基线提供档案、餐食记录、营养看板、日历、运动建议和周期报告；C-03 在保留这些行为的前提下增加 GUI AI 配置、跨会话记忆、Agent 编排与受控 MCP 工具调用。浏览器不保存数据库，也不重新读取完整密钥；Next.js 服务端负责业务编排、数据库访问、外部 AI 与工具动作策略。

~~~mermaid
flowchart LR
  U[本机单个用户] --> B[浏览器]
  B --> N[Next.js 16 / Node.js]
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
| Next API | 校验输入、绑定 primary profile、编排 DB、AI 与工具 | src/app/api/**, src/lib/** | confirmed；C-03 已完成 |
| Prisma | 类型化持久化和正式 migration | prisma/schema.prisma, prisma/migrations/** | confirmed；C-03-M1 迁移现有数据库 |
| SQLite | 单实例本地数据 | DATABASE_URL 指向的文件 | confirmed |
| AI Gateway | StepFun、OpenAI、DeepSeek、Qwen、Kimi、GLM、SiliconFlow、OpenRouter、Ollama 与自定义兼容服务 | src/lib/ai/**, src/app/api/ai/**, src/app/api/settings/ai/** | confirmed；C-03-M3 已实现 |
| Secret Store | GUI 配置的本机凭据、环境变量兼容回退与脱敏读取 | src/lib/ai/settings.ts, data/credentials.json | confirmed；C-03-M3 已实现 |
| Agent Runtime | 营养上下文、长期记忆与工具编排 | src/app/agent/**, src/lib/agent/** | confirmed；C-03-S2 已实现 |
| Memory Store | 对话、记忆来源、置信度、过期与用户治理 | Prisma + src/lib/memory/** + src/app/api/memories/** | confirmed；C-03-M4/S2 已实现 |
| MCP Gateway | 工具发现、白名单、超时与输出隔离 | src/app/api/mcp/**, src/lib/mcp/** | confirmed；C-03-S3 已实现，真实平台取决于用户授权连接器 |
| Action Policy | 搜索、草案和外部写操作确认边界 | src/lib/actions/** | confirmed；C-03-S3 已实现 |
| Delivery | lint、typecheck、build、production smoke 与 CI | package scripts、release smoke、CI | confirmed；C-02-S7 已完成 |
| dev_repo | 合同、架构、ER 与证据真相 | dev_repo/** | confirmed；C-03 已收口 |

## 关键运行流

### 建档与所有权

应用只呈现一个 primary profile。服务端选择或创建该档案，业务 API 不接受客户端提供的 userId 作为所有权依据。此边界适合本地个人工具，不构成公网身份认证。

### 餐食与 AI

图片经浏览器传给同源 AI Gateway，代理校验类型和体积，从本机 Secret Store 读取当前提供商凭据并发起调用。识别结果必须先由用户审核餐别、份量和营养值，再显式保存；图片本体不写入 SQLite。

审核后的多项食物通过 /api/meals 的 items[] 合同一次事务保存，全成或全败。

### 运动与报告

/api/exercise/suggest 的 GET 返回候选和已采用计划，POST 采用计划，PATCH 取消采用；所有热量值由服务端依据 reference 和体重重新计算。报告返回包含今天的连续自然日序列，并显式标记未记录日期。

### 个性化页面

档案、餐食、看板、日历、运动和报告包含个人数据，必须按请求动态渲染，禁止在构建产物中静态固化。

### Agent 与受控工具

Agent 对话只持久化 user/assistant 消息，不保存 system prompt。每次请求注入当前档案、近 14 天餐食和 active/unexpired 记忆；模型推断的长期记忆必须由用户确认后才写入 MemoryItem。

MCP Gateway 只暴露白名单工具，并限制输入、超时和输出体积。附近外卖搜索是只读动作；订单草案不触发外部写入；提交订单需要绑定最终参数的短时一次性确认令牌。没有官方或用户授权的连接器时，系统明确返回未配置，不声称订单已经完成。

### 数据与发布

Prisma migration 是生产 schema 唯一真相；database/schema.sql 降级为原始设计参考。SQLite 仅支持单进程/单实例写入。课程演示以本机启动为主，可选容器必须挂载持久卷。

## 明确不做

- 不实现注册、登录、多租户、角色权限或公网 SaaS。
- 不支持多副本共享同一 SQLite 文件。
- 不把营养估算或运动建议包装成医疗诊断。
- 不自动推送远端或部署公开环境。

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
