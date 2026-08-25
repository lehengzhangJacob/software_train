# ADR-0022: Agent goal/action/verify loop for domain changes

## Status

Accepted under C-39-A1.

## Context

The existing AgentKernel can stream model text and invoke read-only tools, but
the exercise-plan write path is still a post-processing convention: the route
parses an `<exercise-plan>` marker after the model has finished and then writes
the plan as a side effect of saving the assistant message. That makes the
workbench a chat box with a trace wrapper. It cannot truthfully show that the
Agent chose a goal, executed a domain action, or verified the committed state.

## Decision

The Agent runtime uses an ephemeral per-turn task state and a domain action
loop:

```text
user message
  -> AgentIntentPolicy + goal router
  -> AgentKernel
  -> read context/tools
  -> validate domain artifact
  -> commit through an allow-listed action tool
  -> read back and verify the committed state
  -> final AgentMessage
```

For exercise plans, `validate_exercise_plan`, `save_exercise_plan`, and
`verify_exercise_plan` are server-owned tools. They receive the authenticated
user/thread context, reuse `AgentExercisePlan` revision semantics, and expose
only bounded summaries to the model and Trace. A save creates a new revision,
supersedes the previous active revision, and is not considered successful until
the verify action reads the owned row back. The assistant response may claim an
updated plan only when the same run has a committed and verified plan.

The action state is ephemeral for the current run. Existing `AgentMessage` and
`AgentExercisePlan` rows remain the durable truth. The assistant message stores
the resulting `exercisePlanId`; the plan source-message link is attached after
the message is created. No new task table, schema migration, or historical
backfill is introduced.

Canonical Trace remains the only UI source. Goal detection, validation, action
commit, read-back verification, and terminal outcome are emitted at their real
boundaries. Friendly projection labels those real spans without inventing a
fixed five-stage template; Technical projection keeps the same event order and
run identity.

## Boundaries and safety

- Only authenticated, owned `AgentExercisePlan` rows may be read or written.
- The action registry is explicit; read-only turns do not receive plan-write
  tools unless the goal router identifies a plan request.
- Invalid plans never reach Prisma. A failed save or verify cannot produce a
  success claim.
- Raw model/tool payloads, hidden reasoning, credentials, URLs, and provider
  errors remain outside durable messages and safe Trace summaries.
- Off-topic policy remains deterministic and bypasses the AgentKernel.
- Existing revision, status, legacy-mirror, and checklist semantics are kept.

## Compatibility and verification

The `<exercise-plan>` marker remains a compatibility fallback for the explicit
exercise-plan route when a provider cannot use tools. The canonical path is the
goal/action/verify loop; a marker alone is never treated as proof of an Agent
action when the action-capable runtime is available.

Verification covers a shared scripted case that asserts read -> validate ->
save -> verify, revision increment and ownership, no success before verify,
real Trace ordering, ordinary `/agent` plan requests, and deterministic
off-topic handling. Browser acceptance confirms the optimistic user message,
varying Trace, updated plan projection, and no cross-account leakage.
