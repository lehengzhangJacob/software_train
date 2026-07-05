# Food Tracker — 食物热量识别与饮食管理系统

拍照识食 | 营养看板 | 运动建议

## Tech Stack

- **Frontend**: Next.js 15 + shadcn/ui + Tailwind CSS + Recharts
- **Backend**: Next.js API Routes
- **Database**: SQLite + Prisma ORM
- **AI**: Step-3.7 Flash (阶跃星辰)

## Quick Start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

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
