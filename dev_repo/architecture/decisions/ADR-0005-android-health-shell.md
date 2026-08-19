# ADR-0005：Android 薄壳与 Health Connect 聚合同步

- 状态：accepted（追认）
- 日期：2026-08-17
- 合同：C-06-A1（实现先行落地于游离 commit `ed658a0`、`068a4c2`）

## 背景

产品需要手机端的步数与活动消耗参与热量缺口核算。Web 应用是带 Node API 路由（Prisma/SQLite）的动态服务，无法静态导出进 APK；同时 Health Connect 只能由设备端原生代码读取。

## 决策

1. Android 侧是 Capacitor **薄壳**：WebView 直接渲染 live web 服务，不复制任何业务逻辑或本地数据库；服务端始终是唯一数据真相。
2. 开发期设备回路用 `adb reverse tcp:3000 tcp:<host-port>`，壳内 `server.url` 指向设备侧 loopback（`http://127.0.0.1:3000`）；模拟器与 USB 真机同路径。形态 B（部署 URL）留待后续。
3. 健康数据由壳内 `capgo-capacitor-health` 插件在用户授权后读取 Health Connect **自然日聚合**（步数、活动消耗、运动分钟数），按天 `POST /api/health/sync` 部分字段 upsert；Web 端提供手动回填。
4. 服务端只持久化聚合值（`daily_activity`，`(user_id, activity_date)` 唯一）；Health Connect 原始明细留在设备端，不进入 SQLite。
5. Agent 上下文注入近 7 天活动量（来源标注 health_connect / manual），用于热量缺口与运动建议；无数据时明确不虚构。

## 不做

- 不在壳内实现独立业务逻辑、离线缓存真相或第二数据库。
- 不读取心率、睡眠等非聚合或敏感健康明细。
- 不把健康数据写入 MemoryItem 或 AgentMessage 持久内容。
- 不自动申请超越同步所需的 Health Connect 权限。

## 验证

- `test:health` 合同测试（13 例）覆盖 upsert、值域上限、来源枚举与自然日窗口。
- `test:agent` 覆盖上下文活动量注入与无数据不虚构约束。
- 设备侧依赖 adb reverse 回路的人肉 smoke（已知债务：真机回归未入 CI）。
