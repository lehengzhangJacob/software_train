# Food Tracker 架构文档

## 概述

食物热量识别与饮食管理系统。用户通过拍照或手动输入记录每餐食物，系统自动计算营养摄入，提供可视化看板和运动建议。

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 前端框架 | Next.js 15 App Router | SSR + RSC，单仓库全栈 |
| UI 组件 | shadcn/ui + Tailwind CSS | 高质感组件库，product-grade |
| 图表 | Recharts | 营养趋势、宏量营养素环形图 |
| ORM | Prisma | 类型安全数据库访问 |
| 数据库 | SQLite | 嵌入式，零配置 |
| AI | Step-3.7 Flash (阶跃星辰) | 食物图片识别 + 营养估算 |
| 运行时 | Node.js 20+ | |

## 架构原则

1. **数据主权在本地** — SQLite 文件存储在用户设备
2. **AI 作为增强层** — 识别失败不阻塞手动录入
3. **移动优先** — 所有页面在 375px–1440px 范围可用
4. **零 emoji 设计** — 使用高质图标和食物素材
5. **单层 API 包裹** — 所有响应格式 `{ data, error }`

## 管理层

- Frontend: Next.js App Router pages
- Backend: Next.js API Routes (同仓库)
- Database: Prisma + SQLite
- AI: Step-3.7 Flash (OpenAI 兼容协议)
- Runtime: dev_repo/
