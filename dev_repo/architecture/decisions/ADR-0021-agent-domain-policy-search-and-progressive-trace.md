# ADR-0021：Agent 领域策略、受控搜索与渐进式 Trace

## 状态

accepted — C-37-A1

## 背景

C-33-A1/C-35 已经让 AgentKernel 产生真实的当前回合 Trace，但 Agent Runtime
仍缺少三个明确边界：请求是否属于饮食/运动/恢复领域、何时可以联网检索当前资料、
以及如何把真实 span 投影成用户看得懂的进度。当前工具注册表只有账户内只读数据，
系统提示词以营养为主，Trace UI 虽然来自真实事件，默认仍会暴露过多底层节点。

## 决策

1. `/api/agent/chat` 在创建模型回合前经过 `AgentIntentPolicy`。意图分为
   `nutrition`、`fitness`、`recovery`、`health-data`、`food-ordering`、
   `current-research`、`ambiguous` 和 `off-topic`。明显越界请求只生成范围说明，
   不调用个人数据工具、`web_search` 或无关模型流程；若用户把越界主题明确转成训练、
   饮食或恢复目标，则重新进入领域 Agent。
2. 系统提示词将 FoodMoment 定位为饮食、训练和恢复教练。运动建议必须考虑活动量、
   训练负荷、渐进、恢复、器械与安全边界；不得诊断、处方或编造伤病。运动计划模式
   继续使用现有受限 `<exercise-plan>` artifact 合同。
3. 首期联网能力只通过服务端 `WebSearchAdapter` 暴露为白名单 `web_search` 工具。
   仅 Qwen/DashScope Provider 在显式支持 `enable_search` 时可用；工具返回经清洗的
   标题、URL、摘要和时间信息，模型回答必须给出可见来源。其他 Provider 必须透明返回
   “当前模型未启用联网搜索”，不得伪称已检索。搜索用于当前/明确要求的公开资料，不替代
   本地档案读取，也不把原始 provider payload、搜索提示注入或凭据送入 Trace。
4. `AgentTraceEvent v1` 仍是唯一原始事实源。浏览器增加两种纯投影：默认 Friendly
   Projection 聚合为 3–5 个真实业务阶段；Technical Projection 在用户主动展开时
   显示真实嵌套 tool/model/policy span、耗时、序号和来源数量。两种投影共享同一
   `traceId`/`runId`、终态屏障和原始 sequence，不维护固定模板。

## 运行流

```text
API façade
  -> AgentIntentPolicy
     -> off-topic safe reply
     -> AgentKernel
        -> Context/ToolRegistry
        -> WebSearchAdapter (Qwen/DashScope only)
        -> ModelProviderAdapter
  -> Canonical AgentTraceEvent v1
  -> SSE
  -> FriendlyProjection / TechnicalProjection
  -> final AgentMessage
```

## 保持不变

- 账户会话、AgentThread/AgentMessage 所有权、MemoryItem 治理和运动计划 revision 不变。
- 不新增 Prisma 实体、字段、索引、迁移或回填；Trace 仍是当前回合临时投影。
- 搜索来源只作为清洗后的用户可见回答内容，不保存原始搜索响应或独立来源表。
- MCP 白名单、麦当劳一次性未支付建单和用户最终支付边界不变。
- 不引入 LangGraph/DeerFlow 第二运行时、checkpoint、后台 subagent 或自动支付。

## 不变量

- 越界请求不得触发搜索或个人数据工具。
- 搜索能力未知或失败时不得伪造联网事实；回答必须标明能力状态。
- 任何 Trace 只允许安全标签、白名单工具名、状态、耗时、序号、清洗摘要和来源计数。
- 隐藏推理、system prompt、原始参数/结果、密钥、支付入口和搜索注入原文不得跨 API 边界。

## 验证

- 意图策略 fixture：营养、健身、恢复、当前资料、普通闲聊、战锤等越界语料。
- DashScope search adapter fixture：请求体、来源解析、超时、注入隔离和无能力降级。
- Trace projection fixture：阶段聚合、嵌套 span、来源节点、终态冻结和 375px 无溢出。
- 同一云端回合完成四场景 Browser 验收：普通饮食、健身咨询、当前资料搜索、越界话题。
