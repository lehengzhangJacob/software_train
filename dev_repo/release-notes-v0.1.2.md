# 食刻 FoodMoment v0.1.2

## Highlights

- 运动计划增加逐项 checklist：支持 `完成 x/N`、全部完成态和刷新后持久化。
- 日更文章改为后台任务：请求先返回 `202`，长驻 worker 与 systemd timer 负责生成正文和配图，阅读页自动观察 `pending/generating/ready/failed`。
- Android shell version metadata updated to `versionCode 3` / `versionName 0.1.2`。
- 运动计划完成进度使用新增的 additive migration；历史计划、旧建议和历史餐食保持不变。

## Verification

- Cloud deploy: `20260823114823`
- `npm run verify`
- `npx tsx --test scripts/android-update-contract.test.ts`
- Team A cloud exercise checklist: `完成 1/4` -> `计划已完成` -> reload remains `4/4`
- Daily article background acceptance: `202` -> `generating` -> `10/10 ready`；five active accounts ready
- Visual evidence: `dev_repo/evidence/C-28/S3/insights-ready.png`

Issue #10 remains open for external retest, as requested. Issues #3/#4/#5 also remain open; no unconfirmed issue was closed.
