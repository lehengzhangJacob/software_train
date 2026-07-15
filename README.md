# Food Tracker — 食物热量识别与饮食管理系统

拍照识食 | 营养看板 | 运动建议

这是一个私有单用户课程项目，用于本机演示，不是公网多用户 SaaS。

## Tech Stack

- **Frontend**: Next.js 16 + shadcn/ui + Tailwind CSS + Recharts
- **Backend**: Next.js API Routes
- **Database**: SQLite + Prisma ORM
- **AI**: Step-3.7 Flash (阶跃星辰)

## Quick Start

```bash
# PowerShell
Copy-Item .env.example .env
npm ci
npm run db:init
npm run dev
```

On macOS or Linux, replace the first command with `cp .env.example .env`.

## Release Check

The project is intended for a private, single-user course demonstration. It does not deploy a public service, create accounts, or call the AI provider during verification.

```bash
# PowerShell
Copy-Item .env.example .env
npm ci
npm run db:init
npm run release:check
npm run start
```

On macOS or Linux, replace the first command with `cp .env.example .env`.

`STEP_API_KEY` is optional for manual meal entry and all release checks. Keep it only in the local `.env` file. The quality commands are:

| Command | Purpose |
| --- | --- |
| `npm run db:init` | Creates the SQLite file, applies migrations, and seeds only exercise reference data. |
| `npm run verify` | Runs ESLint, TypeScript, and the production build. |
| `npm run smoke` | Starts the production server on loopback, verifies HTML and API error envelopes, then stops it. |
| `npm run release:check` | Runs migration status, verification, and the production smoke in sequence. |

After the first start, create the one local profile from `/profile`. The database is intentionally local and ignored by Git; copy it before experimenting with an existing course demo.

首次运行前把 .env.example 复制为 .env。STEP_API_KEY 只写入本地 .env；留空时手动录入仍可使用，AI 识别会明确提示未配置。

db:init 只创建 schema 并写入运动参考数据，不会自动生成测试用户或测试餐食。

### 兼容旧演示数据库

如果复用 C-02 之前由 db push 创建的 database/food_tracker.db，请先复制备份，再执行：

~~~bash
npx prisma migrate resolve --applied 20260710130000_baseline
npm run db:migrate:deploy
npm run db:seed
~~~

全新数据库不要执行 resolve，直接使用 db:init。

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/   # Main dashboard layout
│   ├── meals/         # Meal recording
│   ├── calendar/      # Calendar view
│   ├── exercise/      # Exercise suggestions
│   ├── reports/       # Weekly/Monthly reports
│   ├── profile/       # User settings
│   └── api/           # API routes
├── components/
│   ├── ui/            # shadcn/ui primitives
│   ├── dashboard/     # Dashboard components
│   ├── charts/        # Chart components
│   ├── food/          # Food-specific components
│   └── exercise/      # Exercise components
└── lib/
    ├── prisma.ts      # Prisma client
    └── utils.ts       # Utilities
```

## Database

See [database/README.md](database/README.md) for schema design.
