# ADR-0009: account-scoped runtime settings

Status: accepted in C-17-S2

## Context

The account migration replaced the shared access gate, but AI provider
configuration and the McDonald's MCP token still lived in process-wide JSON
files. That shape would let one signed-in user change the connector used by
another user and would make the cloud database an incomplete source of truth.

## Decision

Add one `AccountSettings` row for each `UserAccount`.

- `ai_settings_json` stores the validated provider settings and masked public
  projection remains the only browser response.
- `mcdonalds_endpoint` and `mcdonalds_token` store the account's connector
  configuration; raw tokens never enter messages, memory, or logs.
- The first account may import the legacy `data/credentials.json` and
  `data/mcdonalds.json` values once for compatibility. Later accounts receive
  empty settings.
- Account-scoped reads do not fall back to another account's stored file or
  environment credential. Legacy files and environment variables remain only
  for the local no-account compatibility path.
- The existing nutrition tables remain owned by `UserProfile`; no destructive
  rewrite or bulk reassignment is performed.

## Consequences

The SQLite database is the cloud source of truth for account credentials and
settings. The settings APIs and Agent/MCP runtime must resolve the active
account before reading configuration. A future deployment may add envelope
encryption or secret rotation without changing the ownership relation.

## Verification

`20260818193000_add_account_settings` applies cleanly. A two-account HTTP
smoke proves that account A's AI/MCP settings, profile edits, meals, and Agent
threads are not visible to account B; unauthenticated settings/MCP APIs return
401.
