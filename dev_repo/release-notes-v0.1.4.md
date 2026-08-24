# 食刻 FoodMoment v0.1.4

## Highlights

- AgentKernel 接入现有 Agent 运行边界，支持策略约束的模型驱动只读工具循环。
- Agent Trace 改为真实 Canonical Trace 投影：工具调用、工具结果、模型增量和答案增量来自实际回合，不再使用固定模板。
- 默认视图使用用户可读摘要，技术详情按需展示序号、工具名和增量计数；发送消息后立即显示用户消息并实时更新当前回合。
- Web 与 Android 版本元数据同步更新，保留既有账户、餐食、计划、文章和 MCP 写入确认边界。

## Verification

- `npm run verify`
- `npx tsx --test scripts/android-update-contract.test.ts`
- Cloud deploy: `20260824122436`
- `/api/app/version`: `0.1.4` (`LZ_mbeaJ47eTMxiEFlcUs`)
- Android release build: `versionCode 5` / `versionName 0.1.4`; uploaded asset is explicitly unsigned (`app-release-unsigned.apk`)
- Android APK SHA-256: `375C5AB2070EEB8219FF9DB0D7825C7D4A70E527372FB64546546F1EBE71A041`
- Team A cloud Browser: real `read_recent_meals` start/result, 148 model deltas, 148 answer deltas, clean console, and 375px no-overflow

## Visual evidence

![云端桌面工具调用](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.4/dev_repo/evidence/C-33-A1/S4/cloud-trace-desktop-tool.png)

![云端 375px Trace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.4/dev_repo/evidence/C-33-A1/S4/cloud-trace-mobile-375.png)

## Issue status

No Issue is closed by this release. Issues #3/#4/#5/#9/#10 remain open for external retest; Issues #6/#7/#8 remain closed after prior confirmation.
