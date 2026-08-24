# ADR-0019：AgentKernel、自主工具循环与 Canonical Trace

## 状态

accepted — C-33-A1-S0

## 背景

当前 `/api/agent/chat` 由路由直接编排上下文读取、一次模型请求、麦当劳
特殊分支和消息保存。虽然已有 `AgentTraceEvent v1`，但 Trace 仍依赖路由中
手工包裹的步骤，普通回合没有模型驱动的工具选择、工具调用循环或能力门控。
Trace UI 因此只能把少量固定标签映射成看似完整的时间线，不能证明每个步骤
对应一次实际执行。

## 决策

1. 在现有 `agent.runtime` 内增加内部 `AgentKernel` 边界。Kernel 负责模型回合、
   工具选择、步数/超时/取消和终态；`/api/agent/chat` 继续是账户、SSE 和 JSON
   完成合同的外层 façade。
2. 首选使用 OpenAI Agents SDK TypeScript（`@openai/agents`），但只能通过本仓的
   `ModelProviderAdapter` 接入。Adapter 复用现有 `src/lib/ai/client.ts` 和账户级
   Provider 配置，不让 SDK 直接读取密钥、数据库或 MCP。
3. `ToolRegistry` 只注册现有安全上下文读取、运动计划和 MCP 适配器。所有外部写
   操作仍必须经过 `action.policy`；麦当劳明确点餐意图与一笔未支付订单的既有
   边界不变。模型不能调用支付、账户变更或绕过一次性授权。
4. `AgentTraceEvent v1` 保持外部合同不变，并成为当前回合的 Canonical Trace 来源。
   Trace 事件只能在实际模型、工具、策略、持久化和终态边界产生；UI 不再拥有
   第二套步骤真相。事件仍是临时投影，不写入 Prisma 或 AgentMessage。
5. Provider 能力必须显式标注。支持工具调用且支持流式事件时，Kernel 才运行
   自主工具循环；仅支持完整响应的 Provider 走明确 `fallback`；能力未知时不能
   对外宣称自主流式。
6. 第一阶段不引入 LangGraph/DeerFlow 的第二运行时、跨重启 checkpoint、历史
   Trace 回放、后台 Subagent 或自动支付。这些能力若以后需要，必须另立架构或
   ER 修宪合同。

## 新的运行边界

```text
Agent API façade
  -> AgentKernel
  -> ModelProviderAdapter
  -> Context + ToolRegistry
  -> ActionPolicy
  -> MCP / domain tools
  -> Canonical AgentTraceEvent v1
  -> SSE transport
  -> Browser Trace Projection
  -> final AgentMessage only
```

## 保持不变

- AuthSession、账户所有权、UserProfile 和现有上下文脱敏规则不变。
- `action.policy`、MCP 白名单/超时、麦当劳订单与支付边界不变。
- `/api/agent` 的 JSON `{ data, error }` 完成合同和 SSE `trace/delta/done` 外层
  事件保持兼容。
- `AgentMessage` 只保存最终 user/assistant 消息；当前回合 Trace 不落库。
- 运动计划、日更文章、图片资产和 Android 薄壳不改变持久化或所有权边界。

## 兼容性与失败策略

- Kernel 以能力门控和 feature flag 方式接入；不满足能力的 Provider 保留旧的
  单次请求/fallback 路径。
- SSE 断线不改变服务端业务结果；最终消息对账按稳定 message id 完成，禁止重复
  持久化或重复创建未支付订单。
- 若新增 Trace 字段会破坏 v1 JSON 消费者，执行必须停止并另立增量修宪合同。

## 验证

- Fake Provider 覆盖至少两轮 model → tool → result → model 循环、步数上限、超时、
  取消和 fallback。
- 只读工具与明确点餐/阻断路径覆盖真实 Trace 边界和策略回归。
- Browser 使用三个测试账号验收桌面与 375px 移动端，截图和脱敏 SSE 记录归档到
  `dev_repo/evidence/C-33-A1`。
- 本 ADR、`graph.json`、`index.json`、`invariants.md` 和 `runtime-flow.mmd` 必须
  在 S0 同步更新；本合同不产生 ER、migration 或 backfill。
