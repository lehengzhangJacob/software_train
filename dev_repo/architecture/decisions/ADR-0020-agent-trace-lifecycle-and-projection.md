# ADR-0020：Agent Trace 生命周期与单一投影

## 状态

accepted — C-35-A1

## 背景

C-33-A1 已经让 AgentKernel 在真实模型、工具和持久化边界产生
`AgentTraceEvent v1`，但当前浏览器仍把原始事件数组直接画成时间线。一个逻辑步骤的
`started` 与 `completed` 因此变成两行；答案/模型增量没有终态；压缩增量后视觉顺序也
可能与 `sequence` 不一致。工作台另外用 `sending` 和兼容 activity 维护回合状态，导致
答案已经出现时 Trace 仍显示处理中。

## 决策

1. `AgentTraceEvent v1` 继续是当前回合唯一的原始事件来源。事件信封、SSE 事件名、
   `AgentMessage` 持久化合同和安全摘要边界保持兼容。
2. 在浏览器与 Trace 事件之间增加纯函数 `TraceProjectionReducer`。它按 `runId` 接受
   事件，保留原始 `eventId`、`parentId`、首尾 `sequence` 与发生时间，并把同一逻辑
   步骤的生命周期聚合为一行投影节点。
3. 增量事件是一个可收敛的流式节点。它可以在运行中显示“处理中”，但在收到
   `run.completed`、`run.failed` 或 `run.cancelled` 后必须得到对应终态；终态事件之后
   的事件被忽略，不得让已完成回合重新变为处理中。
4. 投影顺序按原始事件的首个 `sequence` 排序；聚合节点的最新序号只用于技术详情，
   不能改变节点在视觉时间线中的位置。并行父步骤仍通过 `parentId` 表达，不由 UI 猜测。
5. 回合摘要和回合详情是同一个 `runId` 的两种视图。摘要只显示当前生命周期，详情由
   用户主动展开；完成后不因 SSE 收尾、消息对账或滚动而自动重播。
6. `sending`、兼容 activity 和答案文本只作为传输/显示辅助状态，不能决定 Trace 的
   完成事实。完成事实必须来自 Canonical Trace 的终态投影。

## 保持不变

- 不新增 `AgentTraceEvent` v2，不把 Trace 写入 Prisma、AgentMessage、Memory 或
  session digest。
- 不新增 LangGraph/DeerFlow 第二运行时、checkpoint、后台 subagent 或自动支付。
- 账户会话、模型供应商能力门、ToolRegistry、ActionPolicy、MCP 白名单和未支付订单
  边界保持不变。
- 原始思维链、system prompt、凭据、原始工具参数/结果、URL 和支付链接仍不得进入
  SSE 或浏览器。

## 验证

- 纯 projection fixture 覆盖 started/completed 聚合、增量收敛、乱序压缩、终态冻结和
  失败回合。
- 真实 Browser 场景覆盖消息立即出现、真实工具调用、答案流式输出、完成同步、详情
  手动展开和 375px 无横向溢出。
- `npm run verify`、Trace 合同测试和桌面/移动端截图证据全部通过。
