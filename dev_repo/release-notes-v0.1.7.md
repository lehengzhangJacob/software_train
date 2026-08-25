# 食刻 FoodMoment v0.1.7

## Highlights

- 聊天输入区现在常驻在聊天面板底部的不可滚动区域，不会被长消息、流式输出或 Trace 推出可视范围。
- 消息与真实 Agent Trace 共用独立滚动区，桌面端与 375px 移动端保持一致的交互边界。
- 移动端输入区补充安全区域留白，避免被系统手势区遮挡。

## Verification

- `npm run verify`
- `npx tsx --test scripts/android-update-contract.test.ts`
- `android/gradlew.bat assembleRelease`（在 `android` 目录执行）
- `npm run smoke`
- Cloud deploy: `20260825153353`
- `/api/app/version`: `0.1.7` (`qf5uW0Rf0ud-quenuf25p`)
- Cloud smoke: `/access=200`, anonymous `/api/users=401`, content timer enabled/active
- Local Browser: desktop `1280x720` and mobile `375x812`; console errors/warnings `0`
- Issues are unchanged by this release: #3/#4/#5/#9/#10 remain open for external retest; #6/#7/#8 remain closed after prior confirmation.

## Visual evidence

![Desktop chat composer](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.7/dev_repo/evidence/C-40/S1/chat-composer-desktop.png)

![375px chat composer](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.7/dev_repo/evidence/C-40/S1/chat-composer-mobile-375.png)

## Android

The release asset is `app-release-unsigned.apk` (`versionCode 8`, `versionName 0.1.7`). It is explicitly unsigned and intended for local/test installation.

APK SHA-256: `2EF91B8E4C0A54F58361CBA5ED8423C50CAB57C638498CF4724AD2EFBCEE6827`
