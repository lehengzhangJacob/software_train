# Architecture Constitution

## C-17 current boundary: invited accounts

The C-17 amendment replaces the shared cloud passcode with database-backed
accounts. `UserAccount` owns one `UserProfile`, `AuthSession` owns a revocable
browser/WebView session, and `InviteCode` controls registration. Nutrition,
conversation, memory, MCP, and health records remain in the same single-instance
SQLite database; their existing `user_id` columns continue to point to the
profile selected from the authenticated session.

AI provider settings and the McDonald's token are now stored in the one-to-one
`AccountSettings` row. The first account may import the legacy runtime files;
later accounts start with empty credential settings. Environment variables are
available only to the legacy local fallback, never as another account's stored
credential.

The former primary-profile rule is retained only as a compatibility rule for
the first registrations that claim existing demo profiles. It is no longer an
authorization boundary.

本目录是 Nutrition Agent 的架构真相，不以宣传文案或旧聊天记录代替。

## 当前交付边界

- 产品定位：本地优先的私有单用户个人营养 Agent，不是公网多用户 SaaS。
- 运行方式：Next.js 16 App Router 在 Node.js 服务端运行，浏览器通过同源页面和 API 使用。
- 数据位置：SQLite 文件位于运行应用的本机或单实例容器持久卷，不在浏览器设备中。
- AI 边界：用户可在 GUI 配置提供商，但完整密钥只允许由本机服务端持有，不能进入浏览器构建、业务记忆或 Git。
- Agent 边界：长期记忆必须可查看、修正和遗忘；MCP 输出视为不可信输入；外部写操作必须经过动作策略和最终确认。
- 当前合同：C-03 先迁移成熟系统与现有 SQLite 数据，再实现个人工具外壳、记忆、Agent 和 MCP。graph.json 的 implementation_status 区分已实现与待实现。

## 入口

- ARCHITECTURE.md：系统上下文、组件和关键运行流。
- graph.json：机器可读节点、依赖、不变量与验证。
- index.json：文件到架构节点的索引。
- invariants.md：普通实现合同不得破坏的规则。
- data-model/：实体、关系、迁移与回填真相。
- decisions/ADR-0001-private-course-boundary.md：本次修宪决策。

## 置信度

- confirmed：由代码、配置、数据库或运行证据直接证明。
- inferred：由调用关系或目录结构推断。
- approved_target：已批准但仍需后续切片实现。
- unknown：需要探针或用户确认。

边界、公共接口、依赖方向、持久化、身份或数据语义变化必须开修宪合同。
