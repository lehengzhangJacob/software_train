# Food Tracker - 食物热量识别与饮食管理系统

拍照识食 | 营养看板 | 运动建议

这是一个私有单用户课程项目，用于本机演示，不是公网多用户 SaaS。

## Tech Stack

- **Frontend**: Next.js 16 + shadcn/ui + Tailwind CSS + Recharts
- **Backend**: Next.js API Routes
- **Database**: SQLite + Prisma ORM
- **AI**: Step-3.7 Flash (阶跃星辰)

## Quick Start

```powershell
Copy-Item .env.example .env
npm ci
npm run db:init
npm run dev
```

On macOS or Linux, replace the first command with `cp .env.example .env`.

## Release Check

The application is intended for a private, single-user course demonstration. Verification does not call the AI provider.

```powershell
Copy-Item .env.example .env
npm ci
npm run db:init
npm run release:check
npm run start
```

| Command | Purpose |
| --- | --- |
| `npm run db:init` | Creates the SQLite file, applies migrations, and seeds exercise reference data. |
| `npm run verify` | Runs ESLint, TypeScript, and the production build. |
| `npm run smoke` | Starts the production server and verifies HTML and API error envelopes. |
| `npm run release:check` | Runs migration status, verification, and the production smoke. |

After the first start, create the local profile from `/profile`. The database is local and ignored by Git; copy it before experimenting with an existing course database.

## Legacy Database Migration

For an existing database, create a backup first and validate the migration on a copy. Do not run `db:init` over the only copy of user data.

## Project Structure

```text
src/app/          Next.js pages and API routes
src/components/   Product and UI components
src/lib/          Validation, persistence, and shared services
prisma/           Schema, migrations, and reference seed
scripts/          Database and release verification
dev_repo/         Runtime, architecture, and data-model truth
```

See `database/README.md` for the original schema design and `dev_repo/architecture/` for the current architecture.
