# ADR-0006: Agent activity observability

- Status: accepted
- Date: 2026-08-18
- Contract: C-06-L4-A1

## Decision

The Agent runtime exposes an opt-in `text/event-stream` projection for the
current turn. The projection reports safe activity labels, tool names, status,
and elapsed time. The existing JSON response remains the canonical completion
interface for non-streaming callers.

The browser renders these events as a collapsible activity timeline. Activity
is a turn presentation concern: it is not written to `AgentMessage`, memory,
session summaries, logs, or the database.

## Boundaries

- Activity never contains MCP arguments, raw MCP results, credentials, or payment links.
- The stream does not change ordering intent, action grants, one-order limits, or payment sovereignty.
- A disconnected activity consumer must not turn a valid Agent operation into a failed business operation.
- The final `thread.messages` response remains the canonical message projection.

## Verification

- Agent contract tests verify recorder merging and credential redaction.
- Ordering contract tests verify the address → store → menu → selection → price sequence.
- The production Agent API verifier checks both JSON compatibility and SSE activity events.
- Browser evidence checks running/completed states, collapse behavior, dark/light themes, and narrow layout.
