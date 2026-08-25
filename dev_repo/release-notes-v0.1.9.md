# 食刻 FoodMoment v0.1.9

## Highlights

- 教练现在可以在用户明确提出记录请求、且信息完整时，将餐食写入现有饮食记录；写入严格经过校验、保存和所有权回读核验。
- 教练工作台扩大主对话区域，提升消息、流式回答和输入区的可读性；新会话提供“把这顿饭记录下来”入口。
- 已核验的餐食会在对应 Agent 回合下显示餐别、时间、热量和三大营养素，并可直接跳转到饮食记录。
- 保持现有真实 Agent Trace、移动端固定输入区和 375px 无横向溢出；没有新增数据库迁移，也没有关闭 Issue。

## Verification

- `npm run release:check`
- `npx tsx --test scripts/android-update-contract.test.ts`
- `android/gradlew.bat assembleRelease`（未签名 APK；`versionCode 10` / `versionName 0.1.9`）
- Cloud deploy: `20260825195155`
- `/api/app/version`: `0.1.9` (`lHBbcMhzP6ZH7X9789kNn`)
- Cloud gate: Team A anonymous/authenticated access checks all passed
- Issues unchanged: #3/#4/#5/#9/#10 remain open for external retest; #6/#7/#8 remain closed.

## Visual evidence

![Coach desktop workspace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.9/dev_repo/evidence/C-44/S2/agent-chat-desktop.png)

![Coach mobile workspace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.9/dev_repo/evidence/C-44/S2/agent-chat-mobile-375.png)

![Coach empty state on 375px](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.9/dev_repo/evidence/C-44/S2/agent-chat-empty-mobile-375.png)

## Android

The release asset is `app-release-unsigned.apk` (`versionCode 10`, `versionName 0.1.9`). It is explicitly unsigned and intended for local/test installation.

APK SHA-256: `6CFEE64396DFBB16F60FC5A1EB7CCDCF0C26E6111CE0A3B7171F43AF0E27D0C7`
