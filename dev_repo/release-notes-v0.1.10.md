# 食刻 FoodMoment v0.1.10

## Highlights

- 拍照识别后的食品审核卡片增加清晰的 1、2、3、4 序号徽标，序号跟随当前审核列表顺序变化。
- 序号只属于审核界面展示，不写入餐食记录或 API payload；选择、编辑、删除和批量保存行为保持不变。
- Web 与 Android 版本同步：Web `0.1.10`，Android `versionCode 11` / `versionName 0.1.10`。

## Verification

- `npm run release:check`：通过。
- `npx tsx --test scripts/meal-ui-contract.test.ts scripts/android-update-contract.test.ts`：5/5 通过。
- `npm run lint`、`npm run typecheck`：通过。
- Cloud deploy：`20260825204415`。
- `/api/app/version`：`0.1.10`（build `_RCfVx21FG4WWEHjkYUJu`）。
- Cloud gate：Team A 匿名/登录态访问检查全部通过。
- Issues unchanged：#3/#4/#5/#9/#10 继续等待外部复测；#6/#7/#8 保持关闭。

## UI evidence

序号 UI 的定向验证记录：`dev_repo/evidence/C-46/S1/verification.md` 与 `verification.json`。自动化选择器为 `recognized-food-card-{n}`，可用于验收第 n 张识别卡片。

## Android

Release asset 为 `app-release-unsigned.apk`（`versionCode 11`、`versionName 0.1.10`），明确为未签名测试包。

APK SHA-256：`6D302CC1EBD9DD53D45C0F352AEE52DBFB59708FEC4C52F6030399C2FBED88E3`
