# Campaign: nutrition-agent

- 当前合同：`C-06 - 麦当劳本地点餐闭环 [in_progress]`
- 当前切片：`C-06-L4 - 本地发布回归`
- 下一步：收口 C-10-S1 会话摘要迁移验收（当前脚本仍报告 `agent_threads was backfilled`），随后关闭 C-06-L4 / C-06
- 已收口子合同：`C-06-A1 - Android 健康壳与 DailyActivity 追认修宪`；`C-07 - 深色模式与系统主题跟随`；`C-08 - 教练页窄幅排版修复`；`C-09 - 移除教练页遗留外卖演示台`；`C-06-L4-A1 - Agent 多步调用活动时间线` [均 completed]

```text
C-01 - 全栈功能初版 [completed]
└── C-02 - 课程项目接手验收与发布收口 [completed]
    └── C-03 - 本地个人营养 Agent [completed]
        └── C-04 - Keep 风格全界面产品化 [completed]
            ├── S0 生活方式视觉素材 [deferred: imagegen group permission]
            ├── S1 共享外壳与响应式导航 [completed]
            ├── S2 今日、拍照与日历 [completed]
            ├── S3 教练、运动与报告 [completed]
            ├── S4 档案、AI/MCP 与记忆 [completed]
            ├── S5 双端视觉回归与发布验证 [completed]
            └── C-05 - 聚焦导航与自动记忆 [completed]
                ├── A1 自动记忆架构与 ER 修宪 [completed]
                ├── S1 移动导航与计划入口 [completed]
                ├── S2 Agent 自动记忆闭环 [completed]
                ├── S3 全量回归与发布验证 [completed]
                └── C-06 - 麦当劳本地点餐闭环 [in_progress]
                    ├── L1 自主创建未支付订单架构修宪 [completed]
                    ├── L2 麦当劳官方 MCP 与本地 Token [completed]
                    ├── A1 Android 健康壳与 DailyActivity 追认修宪 [completed]
                    ├── L3 Agent 自主选餐与未支付订单 [completed：S1 意图门 7e46433 / S2 编排管线 13bb757 / S3 建单与支付入口 9a58964]
                    ├── L4 本地发布回归 [in_progress：真实 Token smoke、双主题/窄屏回归与生产 smoke 已通过；待 C-10 迁移门禁]
                    │   └── A1 Agent 多步调用活动时间线 [completed]
                    └── C-07 - 深色模式与系统主题跟随 [completed]
```
