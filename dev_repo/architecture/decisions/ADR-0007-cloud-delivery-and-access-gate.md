# ADR-0007：云端交付实例、共享访问码门与凭据上云

- 状态：accepted
- 日期：2026-08-18
- 合同：C-11（架构修宪 A1）

## 背景

用户要求把本地优先的单机服务升级为可公网访问的成熟产品形态：服务端部署到公网服务器，Web 浏览器与 Android 壳共用云端数据（含 Agent 对话记录），API Key 与 MCP Token 配置收敛到云端。应用本就是 Next.js 单体服务 + 单一 SQLite 真相源、`src/` 内零硬编码 URL，因此"双端同步"由中心化部署天然成立，不需要离线双写同步引擎。

公网暴露引入新风险：未设门时任何人可用服务端凭据烧 AI 额度、甚至以用户名义创建麦当劳订单。

## 决策

1. 新增 `cloud.delivery` 架构节点：公网服务器上的正式交付实例，standalone Next.js 由 systemd 常驻（unit `foodtracker.service`，端口 8000），部署以本仓构建产物为唯一来源，服务器上不执行构建。
2. 共享访问码门：`APP_ACCESS_TOKEN` 环境变量配置共享访问码；middleware 对未认证页面请求重定向 `/access`、对业务 API（含 SSE）返回 401；认证后下发 httpOnly cookie（值为访问码摘要，非访问码本体）。**token 未设置时 middleware 全放行**，本地开发回路行为零变化。
3. 凭据上云：AI 凭据与麦当劳 Token 仍由既有 `local.secret_store` 机制管理（服务侧 `data/credentials.json`、`data/mcdonalds.json` + env 回退）——云端实例的该目录即云端凭据库；设置页 GUI 直接读写云端配置，完整密钥永不回传浏览器。
4. 数据同源：云端 SQLite 为生产真相源，初始种子为本机数据库的一次性拷贝（含全部对话记录与记忆）；`prisma migrate deploy` 在云端执行，无新增迁移文件。本地开发库继续独立存在。
5. Android 壳激活形态 B（ADR-0005 预留）：`FT_CLOUD_URL` 构建期注入 `server.url`，不注入时保持形态 A loopback。

## 不做

- 不做个人账号体系、多用户或离线双写同步引擎（单用户 + 共享门边界内）。
- 不启用 TLS/域名/反向代理（纯 IP HTTP；Capacitor 已允许 cleartext，列为已知债务）。
- 不在服务器上构建，不引入容器与多实例。
- 不把访问码写入仓库或前端可见面。

## 验证

- A1：graph/index JSON parse、无悬挂引用、ADR 收录断言。
- S1：`npm run verify` 全链保持全绿 + SSH 隧道 loopback smoke（`/api/users` 200）。
- S2：`test:access` 合同测试（放行/重定向/401/cookie/SSE 门）+ `verify:cloud-gate` 公网 401→输码→200 实证。
- S3：双端同源实证（web 发起对话 → Android 可见同一记录）。
