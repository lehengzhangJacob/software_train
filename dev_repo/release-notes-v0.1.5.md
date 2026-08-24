# 食刻 FoodMoment v0.1.5

## Highlights

- Agent Trace UI now projects the real `Canonical AgentTraceEvent v1` lifecycle instead of a fixed timeline template.
- Started/completed/model-delta/answer-delta events are folded into stable logical nodes with real sequence ranges, durations, and delta counts.
- The run terminal event is authoritative: completed turns collapse cleanly, failed turns remain explicit, and post-terminal noise is ignored.
- User messages render optimistically before the Agent response completes; streamed events are deduplicated by `eventId` and reset by `traceId`.
- Technical details are opt-in and show safe event summaries only; raw parameters, results, tokens, credentials, and payment links remain excluded.

## Verification

- `npm run verify`
- `npx tsx --test scripts/android-update-contract.test.ts`
- Android release build: `versionCode 6` / `versionName 0.1.5`; uploaded asset is explicitly unsigned (`app-release-unsigned.apk`)
- Local Browser desktop and 375px acceptance: optimistic message, no duplicate logical rows, terminal `11/11` with `#76`, technical sequence/delta projection, no console errors or visual horizontal overflow

## Visual evidence

![Desktop technical Trace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.5/dev_repo/evidence/C-35/desktop-technical.png)

![375px technical Trace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.5/dev_repo/evidence/C-35/mobile-technical.png)

## Issue status

No Issue is closed by this release. Issues #3/#4/#5/#9/#10 remain open for external retest; Issues #6/#7/#8 remain closed after prior confirmation.
