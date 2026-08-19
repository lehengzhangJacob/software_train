# ADR-0008: invited account authentication

- Status: accepted
- Contract: C-17
- Date: 2026-08-18

## Context

The deployed product currently protects a single shared SQLite dataset with a
shared access code. That boundary is adequate for a private demo, but it is
not a user system: every request resolves the smallest `user_profile` row and
the browser has no revocable identity.

## Decision

Add three server-owned entities:

- `UserAccount`: unique login, salted password hash, status, and a one-to-one
  link to the existing `UserProfile`.
- `AuthSession`: revocable random session token digest, account owner, expiry,
  and last-seen timestamp.
- `InviteCode`: hashed registration code with active state, usage limit, and
  optional expiry.

Keep `UserProfile` as the owner of nutrition-domain rows. Existing foreign keys
and historical data remain intact. The first invited account may claim the
lowest unbound imported profile in a transaction; subsequent accounts create a
new profile. The old shared access code may be seeded as a bootstrap invite,
but it is not a production page/API authorization credential after C-17.

## Security and compatibility

Passwords use `scrypt` with a random salt. Raw session and invite values never
enter the database; only SHA-256 digests are persisted. Authentication is
disabled only for local development when `AUTH_REQUIRED` is false. Cloud
delivery sets `AUTH_REQUIRED=true` and keeps the SQLite single-writer model.

## Rejected alternatives

- Reusing `APP_ACCESS_TOKEN` as the account password: it cannot isolate users or
  support revocation.
- Adding `account_id` to every nutrition table: it duplicates the existing
  profile owner and creates a destructive, unnecessary rewrite.
- Browser-only localStorage identity: it cannot protect APIs or synchronize
  Web and Android against the same server authority.
