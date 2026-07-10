# Architecture Constitution

本目录是 Food Tracker 的架构真相，不以宣传文案或旧聊天记录代替。

## 当前交付边界

- 产品定位：课程项目、私有单用户演示，不是公网多用户 SaaS。
- 运行方式：Next.js 16 App Router 在 Node.js 服务端运行，浏览器通过同源页面和 API 使用。
- 数据位置：SQLite 文件位于运行应用的本机或单实例容器持久卷，不在浏览器设备中。
- AI 边界：浏览器只能调用服务端 AI 代理；供应商密钥只允许存在于服务端环境变量。
- 当前合同：C-02 逐片把已批准目标落到代码。graph.json 的 implementation_status 区分已实现与待实现，不能把目标当现状。

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
