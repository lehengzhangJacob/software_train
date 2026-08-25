# ADR-0023: Agent meal-record actions and verified receipts

## Status

Accepted under C-44-A1.

## Context

The Agent can read recent meals and can create verified exercise-plan
revisions, but it cannot help a student record a meal from the coach
conversation. The existing `/api/meals` contract already owns MealRecord
validation and profile scoping; adding a second persistence path without an
explicit boundary would make ordinary nutrition advice indistinguishable from
a durable write.

## Decision

The Agent runtime adds a `meal-record` goal that is enabled only by an explicit
recording request such as recording, backfilling, or entering a meal. The
conversation remains advisory when the user merely mentions food, asks what to
eat, or has not supplied the required nutrition values.

When the goal is active, the allow-listed action loop is:

```text
explicit meal-record intent
  -> validate_meal_record
  -> save_meal_record (one MealRecord, current authenticated profile)
  -> verify_meal_record (owned read-back)
  -> assistant receipt + Canonical Trace
```

The action reuses `parseMealCreateInput` and the existing MealRecord entity;
there is no new column, status, relationship, migration, or backfill. An
explicit user recording request is the confirmation boundary for the values the
user supplied. If a key value is missing, the Agent asks for it or returns a
draft and does not write a row. The model never supplies `userId` or chooses an
account.

The canonical Trace emits the real goal, validation, save, read-back and
terminal events. Friendly and Technical projections continue to consume the
same events. A verified record ID is attached to the assistant message
metadata and the UI renders a receipt linking back to the meal page.

## Boundaries

- Ordinary nutrition advice never receives meal-write tools.
- One explicit turn writes at most one meal record; batch logging is a future
  amendment, not an implicit model behavior.
- Invalid, incomplete, cross-account, or unverified writes never produce a
  success claim.
- Existing manual entry, photo review, `/api/meals` routes, and MealRecord
  ownership remain the durable data truth.
- Hidden reasoning, raw model payloads, credentials, and provider errors do not
  enter Trace or message metadata.

## Compatibility and verification

The implementation must cover explicit meal-log routing, ordinary nutrition
non-routing, shared nutrition bounds, save/read-back ownership, action Trace
ordering, and a 375px/desktop coach workspace with a visible verified-meal
receipt. No Prisma migration or historical data backfill is expected.
