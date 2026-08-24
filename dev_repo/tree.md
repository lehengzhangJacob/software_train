# Campaign: nutrition-agent

## Current execution override

- Current contract: `C-33-A1 - AgentKernel、自主工具循环与真实 Canonical Trace` [in_progress]
- Current slice: `C-33-A1-S1`；父合同 `C-21` 保持 in_progress，完成后返回 C-21；Issues #3/#4/#5/#9/#10 仍保持开放等待外部复测
- Parent contract: `C-03 - 本地个人营养 Agent` [completed]
- Return path: `C-21`
- Issue state: #6-#8 closed as completed after external confirmation; #3-#5 and #10 remain open until external testers confirm non-reproduction.
- C-21-S2 completed: disabled/expired memories are isolated from Agent context, suppressed text is redacted from digest/history, and the local date anchor is explicit.
- C-21-S3 completed: the desktop Agent shell is fixed-height with right-only conversation scrolling, and the waiting copy follows the running activity.
- C-21-S4 completed: recognition candidates survive route changes in a session-scoped, one-shot handoff and still require the existing review gate.
- C-21-VERIFY completed locally and in the cloud: desktop history remains bounded, while mobile history is a collapsible side drawer instead of a panel below the chat. Issues #6-#8 were later closed after external confirmation; #3-#5 remain open for external retest.
- C-21-UI1 completed in the cloud: desktop and mobile Browser acceptance confirm 最近对话 is the first sidebar section, with an independent vertical scroll boundary and no message/data contract change.
- C-22-A1 completed: the version-aware delivery amendment adds a public no-store build metadata endpoint while keeping all business APIs behind the account session gate.
- C-22-S1 completed: the shared Web shell compares the server-provided build id with the no-store version endpoint and offers an explicit refresh; stale-tab visual proof is scheduled with the cloud deployment.
- C-22-S2 completed: cloud v0.1.1 is live, `/api/app/version` is public no-store, Android 0.1.1 APK built, and Browser desktop/375px screenshots prove the notice stays in content flow. The GitHub Release target is v0.1.1; Issues #6-#8 are closed after external confirmation and #3-#5 remain open.
- C-23-S4 completed: Trace 默认展示用户语言进度并在回合完成后收起，技术字段通过“查看技术详情”按需展开；云端桌面/375px 移动 Browser 验收通过。
- C-24-A1 completed: AgentExercisePlan becomes the structured plan source; legacy ExerciseSuggestion rows will be mirrored idempotently without deleting or rewriting the old table.
- C-24-S1 completed: schema/migration/repository/API persist validated AgentExercisePlan revisions and preserve every legacy suggestion row as a legacy mirror; local SQLite migration check passed.
- C-24-S2 completed: Agent exercise-plan mode emits a validated marker, persists it with the assistant message, and carries an owned plan into adjustment prompts without leaking marker JSON during SSE.
- C-24-S3 completed: the exercise page consumes the active Agent plan projection, keeps legacy/history visible, and links into a return-aware coach adjustment workspace.
- C-24-S4 completed: StepFun exercise turns request low reasoning effort so hidden reasoning cannot consume the answer budget; cloud generation, persistence, coach return link, active plan projection, legacy history and Browser console checks passed. Existing pre-generation desktop/375px visual evidence remains; the current In-app Browser session could not export screenshot bytes, so no post-generation screenshot is claimed.
- C-25-A1 completed: ADR-0015 defines per-account ten-article batches, safe context, DashScope async image tasks, durable shared assets, protected daily job and visual fallback; ER/data-model and architecture invariants are amended. C-25-S1 is implementing additive empty-start tables and account-scoped APIs.
- C-20 is separately blocked on the remote repository write permission and is not part of this fix line.
- C-27-A1 completed: AgentExercisePlanStepProgress is an additive completion projection; migration copy preserved existing plan, suggestion and meal rows with no backfill.
- C-27-S1 completed: GET plan projections include x/N progress and derived planCompleted; PATCH toggle is ownership-scoped and idempotent. Return path is C-27-S2.
- C-27-S2 completed: the exercise page now renders native accessible checkboxes, `完成 x/N`, and `计划已完成`, with failed-write rollback. Return path is C-27-S3.
- C-27-S3 completed: deploy 20260823114823; Team A cloud checklist passed partial, completed and reload persistence checks; Android 0.1.2 metadata test and full verify passed. Exercise screenshot API failed, so no PNG is claimed for this slice.

```text
C-21 - 集中修复 GitHub Issue #3 至 #8 [in_progress]
├── C-22 - Web/Android 版本探测与增量刷新 [completed]
    ├── C-22-A1 版本契约与架构修宪 [completed]
    ├── C-22-S1 Web 更新提示 [completed]
    └── C-22-S2 Android 提示与 v0.1.1 发布 [completed]
└── C-23 - 真实 Agent Trace 流与成熟 Trace UI [completed]
    ├── C-23-A1 Trace 事件契约与架构修宪 [completed]
    ├── C-23-S1 后端真实 Trace 与模型流 [completed]
    ├── C-23-S2 成熟 Trace UI 与即时对话流 [completed]
    ├── C-23-S3 浏览器/云端回归与截图交付 [completed]
    └── C-23-S4 用户态 Trace 信息密度收敛 [completed]
└── C-24 - Agent 结构化运动计划、教练调整与旧建议无损迁移 [completed]
    ├── C-24-A1 架构/ER 修宪与 legacy 镜像迁移语义 [completed]
    ├── C-24-S1 结构化计划模型、迁移、仓储与读取 API [completed]
    ├── C-24-S2 Agent 计划输出、持久化与调整上下文 [completed]
    ├── C-24-S3 计划页与教练调整深链 UI [completed]
    └── C-24-S4 云端迁移、生成回归与截图验收 [completed]
└── C-25 - Agent 日更图文与 DashScope 生图 [completed]
    ├── C-25-A1 日更内容架构、ER 修宪与 DashScope 边界 [completed]
    ├── C-25-S1 批次/文章迁移、仓储与账户隔离 API [completed]
    ├── C-25-S2 Agent 生成、DashScope 图片适配器与每日 job [completed]
    ├── C-25-S3 每日阅读流 UI [completed]
    └── C-25-S4 云端部署、五账号验收与截图 [completed：截图二进制不可用，DOM 证据已保存]
└── C-26 - Issue #10 餐食超规模营养数字防护 [completed]
    ├── C-26-A1 营养值域与数据模型修宪 [completed]
    ├── C-26-S1 后端创建/批量/更新校验 [completed]
    └── C-26-S2 前端输入、提示与历史展示保护 [completed]
└── C-27 - Agent 运动计划完成 checklist 与 v0.1.2 发布 [completed]
    ├── C-27-A1 数据模型与迁移 [completed]
    ├── C-27-S1 完成状态 API [completed]
    ├── C-27-S2 运动页 checklist UI [completed]
    └── C-27-S3 云端验收与 Release [completed：deploy 20260823114823；运动清单云端持久化通过]
    └── C-28 - 日更文章后台生成边界修正 [completed，return_to=C-27-S3]
        ├── C-28-A1 架构与运行时边界 [completed]
        ├── C-28-S1 持久入队与后台 worker [completed]
        ├── C-28-S2 阅读流后台状态 [completed]
        └── C-28-S3 云端验收与证据 [completed，return_to=C-27-S3]
```

- 当前合同：`C-21 - 集中修复 GitHub Issue #3 至 #8 [in_progress]`
- 当前切片：无；C-26 Issue #10 修复已完成并回归主合同
- 下一步：等待 Issues #3/#4/#5/#10 外部复测；不关闭未确认的 Issue
- C-29 - 移动端中央记一餐入口、路线切换动效与 Team A 两周演示数据 [completed：UI 云端验收、375px 截图、Team A 56/14/7/3 数据回读与 B/C 隔离证据]
- C-30 - 修复 Issue #9 计划页补记日期失效 [completed：日期参数、手动保存与清理云端回归、截图证据；Issue #9 保持 Open]
- C-31 - 将每日阅读降为今天的二级 Tab [completed：一级导航收敛、移动底栏 2+中央+2、桌面云端截图与 DOM 验收]
- C-32 - 发布 v0.1.3 今天二级导航版本 [completed：版本元数据、云端 0.1.3、GitHub Release 与两张截图证据]
- C-33-A1 - AgentKernel、自主工具循环与真实 Canonical Trace [in_progress]
    ├── S0 架构修宪、Provider 能力探针与基线证据 [completed]
    ├── S1 AgentKernel 与 ModelProviderAdapter [in_progress]
    ├── S2 白名单工具循环与 Canonical Trace [pending]
    ├── S3 Trace UI 纯投影与 Browser 验收 [pending]
    └── S4 云端验收、截图与证据归档 [pending]
- 已收口子合同（历史桶）：`C-02 发布收口`；`C-03 本地营养 Agent`；`C-04 Keep 风格全界面`；`C-05 聚焦导航与自动记忆`；`C-06 麦当劳点餐闭环`（含 A1/C-07/C-08/C-09/C-10/L4-A1/A2）；`C-11 云端交付与双端收口`（A1 修宪 652e53e / S1 部署通道 230ed10 / S2 访问门 732ec30 / S3 形态 B）[均 completed]

```text
C-01 - 全栈功能初版 [completed]
└── C-02 - 课程项目接手验收与发布收口 [completed]
    └── C-03 - 本地个人营养 Agent [completed]
        └── C-04 - Keep 风格全界面产品化 [completed]
            └── C-05 - 聚焦导航与自动记忆 [completed]
                └── C-06 - 麦当劳本地点餐闭环 [completed]
                    └── C-11 - 云端交付与双端收口 [completed]
                        ├── A1 cloud.delivery 架构修宪（ADR-0007）[completed]
                        ├── S1 部署通道：standalone + systemd + 云端种子 [completed]
                        ├── S2 公网访问门：middleware + 访问码 + 401 [completed]
                        └── S3 Android 形态 B + 双端同源回归 [completed]
                        └── C-12 - 测试数据、核心功能回归与 README 素材 [completed]
                                ├── S1 真实云端演示数据生成 [completed：14 天/56 条餐食、7 天活动、3 条运动、3 条记忆；幂等复跑通过]
                                ├── S2 核心功能与双端 E2E 回归 [completed：照片识别 9 项、Agent 2/2、MCP 29 工具、移动视口同源]
                                └── S3 README/文档截图素材 [completed：2 张真实云端截图、7 张 UI 参考图、README 与演示索引]
                                └── C-13 - Android 拍照闭环与产品图标收口 [completed]
                                        ├── S1 相机入口、CAMERA 权限与 Debug APK [completed：Web/TypeScript/Android 构建通过；ADB 设备待接入]
                                        ├── S2 产品图标设计与 Web/Android 资源接入 [completed：内置图像生成 + 512/1024 Web 资源 + Android 多密度资源]
                                        └── S3 真机 ADB 拍照识别闭环与最终发布检查 [completed：foodtest AVD 登录、原生相机、识别审核保存与发布门禁通过]
                                                └── C-14 - 让访问门回到产品主视觉 [completed]
                                                        ├── S1 访问门重做与未认证隐藏导航 [completed：品牌入口 + 分栏表单 + API 安全边界不变]
                                                        └── S2 Web/Android 尺寸回归与截图 [completed：云端静态资源、API 401、模拟器访问门截图与生产构建均通过]
                                                └── C-15 - 访问门高级入口视觉收口 [completed]
                                                        └── S1 紧凑入口表面、云端发布与模拟器回归 [completed]
                                                └── C-16 - 访问门背景材质补强 [completed]
                                                        └── S1 接入餐食摄影背景与模拟器回归 [completed]
                                                        └── C-17 - 账户体系、邀请码注册与跨账户数据隔离 [completed]
                                                        ├── A1 账户/会话/邀请码数据模型 [completed]
                                                        ├── S1 认证核心 API、会话门与安全边界 [completed]
                                                        ├── S2 业务数据与 AI/MCP 配置按账户隔离 [completed]
                                                        ├── S3 登录、邀请码注册、退出与认证 UI [completed]
                                                        └── S4 云端迁移、双端同步与最终发布检查 [completed：云端公网、账户同步、Android 云壳构建与 release gate]
                                                        └── C-18 - 食刻落地页视口收口、品牌替换与动效升级 [completed]
```


