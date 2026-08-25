# 食刻 FoodMoment v0.1.8

## Highlights

- 移动端 Agent 输入区会感知软键盘和视口变化，聚焦输入时保持可见，并为安全区域留出空间。
- 个人头像菜单与手动录餐表单统一到 FoodMoment 的品牌表面、分组和触控尺寸，375px 视口不横向溢出。
- 从运动计划、每日阅读、报告和外卖设置进入教练时，会预填一段可编辑的上下文提示；用户仍需主动发送，运动计划模式与返回路径保持不变。
- 消息与真实 Agent Trace、输入区的事实来源和数据边界保持不变，本版没有新增迁移或关闭 Issue。

## Verification

- `npm run verify`
- `npx tsx --test scripts/android-update-contract.test.ts`
- `android/gradlew.bat assembleRelease`（未签名 APK）
- `npm run smoke`
- Cloud deploy: `20260825162921`
- `/api/app/version`: `0.1.8` (`-OX4BGUL5h-LeqQtz0NDH`)
- Local Browser: desktop `1280x720` and mobile `375x812`; console errors/warnings `0`
- Issues unchanged: #3/#4/#5/#9/#10 remain open for external retest; #6/#7/#8 remain closed after prior confirmation.

## Visual evidence

![Agent desktop keyboard-aware layout](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.8/dev_repo/evidence/C-42/S1/agent-desktop.jpg)

![Agent mobile keyboard-aware layout](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.8/dev_repo/evidence/C-42/S1/agent-mobile-375.jpg)

![Profile menu](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.8/dev_repo/evidence/C-42/S2/profile-menu-desktop.jpg)

![Manual meal form on 375px](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.8/dev_repo/evidence/C-42/S2/manual-meal-mobile-375.jpg)

![Prefilled coach context](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.8/dev_repo/evidence/C-42/S3/agent-prefilled-exercise-desktop.jpg)

![Prefilled coach context on 375px](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.8/dev_repo/evidence/C-42/S3/agent-prefilled-exercise-mobile-375.jpg)

## Android

The release asset is `app-release-unsigned.apk` (`versionCode 9`, `versionName 0.1.8`). It is explicitly unsigned and intended for local/test installation.

APK SHA-256: `822BBAE37C071BA6679965501BBAD30B6A6F8A9935CF050575334A601E740B59`
