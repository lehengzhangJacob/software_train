# ADR-0017: Exercise plan checklist progress

## Status

Accepted under C-27-A1.

## Decision

`AgentExercisePlan` remains the immutable, Agent-generated source for a plan's
steps. User completion is a separate derived projection in
`AgentExercisePlanStepProgress`, keyed by `(plan_id, step_order)`. A row means
that the corresponding step is complete; an absent row means unchecked. The
overall plan status is derived in the read projection when every validated step
has a progress row.

## Compatibility and migration

- Existing plans, revisions, legacy mirrors, and `plan_json` are not rewritten.
- The migration creates an empty progress table; there is no historical
  backfill because prior plans have no trustworthy completion event.
- Deleting a plan cascades only its progress projection. Deleting a step is not
  a supported mutation; a new Agent revision gets a fresh checklist.
- Every API write first verifies plan ownership and that `step_order` exists in
  the validated plan payload.

## Consequences

The checklist can be toggled independently from Agent generation and survives
route changes and refreshes without putting ephemeral UI state into
`plan_json`. The UI can show `completedCount/totalSteps` and a derived
`planCompleted` flag without adding a second plan state machine.
