# Food Tracker 架构

## 系统上下文

Food Tracker 是课程项目中的私有单用户饮食记录应用。它提供档案、餐食记录、营养看板、日历、运动建议和周期报告。浏览器不保存数据库，也不直接持有 StepFun 凭据。

~~~mermaid
flowchart LR
  U[单个课程演示用户] --> B[浏览器]
  B --> N[Next.js 16 / Node.js]
  N --> P[Prisma]
  P --> S[(SQLite 文件)]
  N --> A[StepFun API]
~~~

## 容器与职责

| 容器 | 职责 | 权威文件 | 状态 |
|---|---|---|---|
| Browser UI | 页面、表单、图表、审核与交互状态 | src/app/**, src/components/** | confirmed |
| Next API | 校验输入、绑定 primary profile、编排 DB 与 AI | src/app/api/**, src/lib/** | partial；C-02-S2~S5 收口 |
| Prisma | 类型化持久化和正式 migration | prisma/schema.prisma, prisma/migrations/** | approved_target；C-02-S1 落地 |
| SQLite | 单实例课程数据 | DATABASE_URL 指向的文件 | confirmed |
| StepFun | 图片识别 | 服务端代理 | confirmed |
| Delivery | lint、typecheck、build、production smoke 与 CI | package scripts、release smoke、CI | confirmed；C-02-S7 已完成 |
| dev_repo | 合同、架构、ER 与证据真相 | dev_repo/** | active |

## 关键运行流

### 建档与所有权

应用只呈现一个 primary profile。服务端选择或创建该档案，业务 API 不接受客户端提供的 userId 作为所有权依据。此边界适合私有单用户课程演示，不构成公网身份认证。

### 餐食与 AI

图片经浏览器传给同源 AI 代理，代理校验类型/体积、从服务端环境读取密钥并调用 StepFun。识别结果必须先由用户审核餐别、份量和营养值，再显式保存；图片本体不写入 SQLite。

审核后的多项食物通过 /api/meals 的 items[] 合同一次事务保存，全成或全败。

### 运动与报告

/api/exercise/suggest 的 GET 返回候选和已采用计划，POST 采用计划，PATCH 取消采用；所有热量值由服务端依据 reference 和体重重新计算。报告返回包含今天的连续自然日序列，并显式标记未记录日期。

### 个性化页面

档案、餐食、看板、日历、运动和报告包含个人数据，必须按请求动态渲染，禁止在构建产物中静态固化。

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
