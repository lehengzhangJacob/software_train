# C-35-S3 Trace UI Browser Verification

Date: 2026-08-24 (Asia/Shanghai)
Branch: `codex/c35-trace-refactor`
Local URL: `http://localhost:3100/agent`

## Automated gates

- `npm run verify` passed: tests, lint, typecheck, and production build.
- Build emitted only the existing Next.js middleware convention deprecation warning.
- `npm run test:agent-trace` and `npm run test:agent-trace-ui` passed.

## Browser acceptance

- A new turn rendered the optimistic user message before the response completed; the immediate DOM contained the short prompt exactly once.
- The running panel showed one logical row per step. Start/completed events were projected into one node instead of appearing as duplicate timeline rows.
- Completed desktop turn: `本回合已完成`, `11/11 个逻辑节点已完成 · 终态 #76`.
- Technical details exposed actual sequence ranges (`#02–#03`, `#14–#71`, `#15–#69`, `#16–#70`), model/answer delta counts, durations, and safe summaries. No raw parameters, results, token values, credentials, or payment links were rendered.
- 375px viewport: `document.documentElement.scrollWidth === clientWidth` (360px); no element exceeded the content viewport. The 1px body fractional rounding is the browser scrollbar boundary, not a visual horizontal overflow.
- Browser console returned no errors or warnings.

## Screenshots

- [Desktop completed projection](desktop-completed.png)
- [Desktop technical projection](desktop-technical.png)
- [375px technical projection](mobile-technical.png)

## Implementation commits

- `3853c23` architecture amendment and lifecycle projection decision
- `79b3b07` canonical trace projection reducer and contract test
- `c292b3c` workbench integration, deduplicated SSE events, and lifecycle UI
