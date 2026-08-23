# 食刻 FoodMoment v0.1.3

## Highlights

- “每日阅读”从一级导航移入“今天”二级 Tab，与“今日概览”形成同一信息层级。
- 移动端底栏保持左二、中央“记一餐”、右二的对称结构；今天页签支持平滑切换动效。
- 保留 `/insights` 路由和后台文章生成流程，不改变既有账户、餐食、计划或文章数据。

## Verification

- `npm run verify`
- `npx tsx --test scripts/android-update-contract.test.ts`
- Cloud deploy with `/api/app/version` reporting `0.1.3`
- C-31 desktop Browser acceptance: Today primary navigation with `今日概览` / `每日阅读` secondary tabs

## Visual evidence

![今日概览桌面验收](https://raw.githubusercontent.com/lehengzhangJacob/software_train/main/dev_repo/evidence/C-31/S2/dashboard-desktop.png)

![每日阅读桌面验收](https://raw.githubusercontent.com/lehengzhangJacob/software_train/main/dev_repo/evidence/C-31/S2/insights-desktop.png)

Issue states were not changed by this release.
