# ADR-0013：完整 Agent Trace 与当前回合 Trace UI

## 状态

accepted — C-23-A1

## 背景

现有 Agent 工作台只把少数手工包裹的 activity 状态投影为时间线。普通营养咨询只有
上下文和一次完整模型调用，模型响应也必须等到请求结束后才出现；用户发出的消息在服务端
完成前不会进入消息流。这样的面板能说明“正在运行”，但不能反映真实的上下文读取、模型增量、
MCP 工具边界、重试、失败和最终答案。

## 决策

1. 当前回合使用版本化 `AgentTraceEvent` 信封。每个事件带 `traceId`、`runId`、唯一
   `eventId`、可选 `parentId`、单调 `sequence`、`occurredAt`、`eventType`、`status` 和
   用户可读 `label`。工具事件还可带白名单 `toolName`，模型/答案事件可带 `textDelta`，
   其他细节只能放入经脱敏的 `safeSummary` 与 `durationMs`。
2. 事件在真实运行边界产生：上下文读取、模型请求/增量、MCP `callTool`、策略检查、重试、
   最终保存和失败都必须对应事件。禁止为了填充时间线而制造没有实际执行的 tool event 或
   人工打字机效果；非流式提供商必须明确投影为 `fallback`，而不是伪装成流式。
3. `/api/agent` 保留现有 JSON 完成合同。带 `Accept: text/event-stream` 时，服务端另外以
   SSE 发送 `trace` 事件、答案 `delta` 和最终 `done`，断线不改变服务端一次性业务结果。
   SSE 是当前回合临时投影，`AgentMessage` 仍是持久化的最终 user/assistant 消息真相。
4. Browser 在提交时立即插入 optimistic user bubble，随后渲染实时答案增量和可折叠的嵌套
   Trace workspace；`done` 到达后按 thread/message id 对账，不能重复显示 user 或 assistant。
   流中断保留用户消息并显示可重试错误，不能丢失输入或重复建单。
5. 浏览器只能收到安全摘要。Trace 不包含隐藏思维链、system prompt、凭据、原始工具参数、
   原始工具结果、供应商错误原文、支付链接或未脱敏 URL；答案 delta 也必须经过现有输出
   提取/脱敏规则。Trace 不进入 Prisma schema、migration、长期记忆或 session digest。
6. Trace UI 遵守 375px–1440px 响应式约束：时间线节点、状态、工具名、耗时和摘要可键盘/读
   屏理解，滚动跟随只在用户接近底部时启用，长摘要换行而不产生横向溢出。

## 保持不变

- 账户会话、Agent action policy、MCP 白名单/超时、麦当劳未支付订单边界和 `AgentMessage`
  持久化语义不变。
- 普通 JSON 客户端仍获得同一个 `{ data, error }` 完成响应；已有 activity 消费者可在兼容
  期继续读取映射后的状态事件。
- 若未来要求历史 Trace 回放、跨设备同步或审计留存，必须另开 ER/data-model amendment，
  不能把当前回合临时事件直接写入现有消息表。

## 验证

- Trace 合同测试覆盖事件信封、序列、脱敏和禁止字段。
- Agent/API 合同测试覆盖 optimistic message、真实上下文/工具边界、答案 delta、fallback、
  失败和 JSON/SSE 兼容。
- Browser 以真实测试账户验收桌面与 375px 移动布局，截图保存在 `dev_repo/evidence/C-23`。
