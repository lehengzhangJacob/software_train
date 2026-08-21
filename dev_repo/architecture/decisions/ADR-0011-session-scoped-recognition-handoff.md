# ADR-0011: Session-scoped recognition handoff

- Status: accepted
- Date: 2026-08-21
- Contract: C-21-A1

## Context

Food recognition is a browser workflow: a user selects or captures an image,
the component sends it to `/api/ai/recognize`, and the user reviews the
returned food candidates before any meal is saved. A client-side route change
can unmount the original component before a valid recognition response reaches
the review form. The request can still complete, but the completed candidates
would otherwise be lost from the user-facing workflow.

## Decision

Use a browser-session handoff for the completed, schema-validated recognition
result only.

- The handoff is session-scoped and is owned by the existing food-recognition
  component flow; it is not a second API, a database entity, or a durable meal
  record.
- Its payload contains only a request identifier, lifecycle status, and the
  bounded structured food candidates already returned by the recognition API.
- Image data URLs, image files, provider error bodies, credentials, and raw
  model responses are prohibited from the handoff.
- The active meal screen consumes the ready result exactly once and presents
  it through the existing human-review gate before `/api/meals` is called.
- A newer recognition request wins over an older one so a late response cannot
  overwrite the user's current review flow.

## Consequences

Route changes no longer make a completed recognition appear successful while
silently dropping its review candidates. The existing AI gateway, manual
review, meal persistence, and no-image-persistence boundaries remain intact.

## Verification

- Unit tests reject invalid, oversized, or image-bearing handoff payloads.
- A browser route regression covers: begin recognition, navigate away, let the
  request finish, return to meals, and review the candidates.
- Source and runtime checks confirm no new API route, Prisma model, migration,
  or raw image storage was introduced.
