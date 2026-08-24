# 食刻 FoodMoment v0.1.6

## Highlights

- Agent now has a fitness-first domain policy: nutrition, training, recovery and health-data requests stay in scope, while unrelated topics receive a concise redirect instead of consuming model/tool budget.
- Fitness and recovery turns use a specialized system prompt with explicit safety boundaries, user-context grounding and transparent limits when live search is unavailable.
- DashScope Web Search is available through a guarded adapter for Qwen-configured accounts only; provider, host, capability and query gates prevent accidental external calls. Search citations are sanitized before reaching the user.
- Trace UI now projects the real Canonical AgentTraceEvent stream into a progressive friendly timeline. The final SSE `done` envelope is the terminal barrier, so completed state cannot appear while answer deltas are still arriving.
- Technical details remain opt-in and expose safe event summaries, sequence ranges, tool names and delta counts without raw parameters, results, credentials or tokens.

## Verification

- `npm run verify`
- `npx tsx --test scripts/android-update-contract.test.ts`
- `android/gradlew.bat assembleRelease`
- Cloud Browser Team A: optimistic user message, in-order streaming answer, four friendly phases, `16/16` technical spans, four real read-only tools, deterministic off-topic handling and transparent StepFun no-search fallback.
- Issues are unchanged by this release: #3/#4/#5/#9/#10 remain open for external retest; #6/#7/#8 remain closed after prior confirmation.

## Visual evidence

![Streaming Trace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.6/dev_repo/evidence/C-37/S5/cloud-trace-streaming-fixed.png)

![Completed Trace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.6/dev_repo/evidence/C-37/S5/cloud-trace-completed-detail.png)

![Technical Trace](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.6/dev_repo/evidence/C-37/S5/cloud-trace-technical.png)

![Off-topic scope redirect](https://raw.githubusercontent.com/lehengzhangJacob/software_train/v0.1.6/dev_repo/evidence/C-37/S5/cloud-off-topic-scope.png)

## Android

The release asset is `app-release-unsigned.apk` (`versionCode 7`, `versionName 0.1.6`). It is explicitly unsigned and intended for local/test installation.
