# C-46-S1 Verification

- Each recognized-food review card now exposes a visible circular sequence badge sourced from the current `drafts.map` index, so the first four cards read 1, 2, 3, and 4.
- The same sequence is available through `data-testid="recognized-food-card-{n}"` for deterministic Browser/automation checks.
- The number is presentation-only: it is not added to the draft payload, `MealRecord`, or any persisted field. Existing selection, editing, deletion, and batch-save behavior remains unchanged.
- Targeted checks passed: `npx tsx --test scripts/meal-ui-contract.test.ts`, `npm run lint`, `npm run typecheck`, and `git diff --check`.
- No migration, backfill, API, or Issue status change is included in this slice.
