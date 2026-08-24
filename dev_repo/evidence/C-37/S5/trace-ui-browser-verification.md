# C-37-S5 Browser Verification

Date: 2026-08-24 (Asia/Shanghai)

## Build and deployment

- `npm run verify` passed after the terminal-barrier correction, including all Agent/search/Trace/UI and existing business contract tests, lint, typecheck, and production build.
- Focused post-fix checks also passed: `npm run test:agent-trace-ui`, `npm run typecheck`, `npm run lint -- --quiet`, `git diff --check`, and `npm run build`.
- Cloud deploy `20260824204147` completed with Prisma migration status clean, `/access` 200, anonymous `/api/users` 401, and the content timer enabled/active.
- Public version endpoint remained `0.1.5` (`build=kBAGzLnp0_fp0fj3sCrD3`).

## Cloud Browser

Account: FoodMoment Team A (test account; credentials are not recorded here).

1. Sent an in-scope fitness request: `请给我一个今天10分钟的低强度拉伸训练，并提醒安全边界`.
   - The user message appeared before the assistant response.
   - During generation, the friendly projection stayed `进行中` while the answer streamed.
   - The completed projection showed four real phases: `确认请求范围`, `准备相关信息`, `生成个性化建议`, `保存本回合结果`.
   - Technical projection showed `16/16 个真实 span 已完成 · 终态 #185`, 80 model deltas, 75 answer deltas, and real read-only tools: `read_profile`, `read_daily_activity`, `read_active_memories`, `read_exercise_plan`.
2. Sent an unrelated Warhammer 40K question.
   - The deterministic scope reply was returned without model/search activity.
   - The reply redirected the user toward diet, training, recovery, and health records, while allowing a coaching-themed reframing.
3. Sent an explicit latest-research request while the account was using StepFun and DashScope/Qwen was not configured.
   - The UI and answer stated that real-time search was unavailable.
   - No research phase or fabricated citation appeared; the answer was clearly based on existing exercise-science context.

## Evidence files

- `cloud-trace-streaming-fixed.png`: in-progress stream and friendly Trace.
- `cloud-trace-completed-fixed.png`: completed turn and synchronized answer state.
- `cloud-trace-completed-detail.png`: four completed friendly phases.
- `cloud-trace-technical.png`: real span projection with sequence, duration, tool names, and delta counts.
- `cloud-off-topic-scope.png`: deterministic off-topic scope reply.

The test accounts currently use StepFun. The DashScope Web Search adapter and citation path are covered by `npm run test:agent`; a real search phase will appear once an account is configured with a DashScope/Qwen endpoint and key.
