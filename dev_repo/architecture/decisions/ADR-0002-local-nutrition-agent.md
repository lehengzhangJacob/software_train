# ADR-0002: Local-First Nutrition Agent

## Status

Accepted by C-03-A0 on 2026-08-15.

## Context

The repository contained a FastAPI/Vite implementation while the hardened branch contained a more complete Next.js and Prisma product. The target product is a personal local tool rather than a public SaaS and must preserve existing course data while adding configurable AI providers, cross-session memory and guarded MCP tools.

## Decision

- Next.js App Router is the only application runtime.
- Prisma migrations are the only deployable schema authority; legacy SQL remains reference material.
- The existing local SQLite database is migrated through a verified copy before the live path is changed.
- AI providers are accessed through a server-side registry. The GUI may submit credentials, but complete credentials never return to the browser.
- Agent memories are inspectable, attributable, correctable and deletable.
- MCP tools are allowlisted and treated as untrusted. Search and order drafts may run automatically; external writes require explicit final confirmation.

## Consequences

The legacy FastAPI and Vite application leaves the main runtime. Agent memory requires an ER amendment and migration. Real takeaway ordering remains provider-dependent and cannot be claimed until an official or user-authorized tool passes the action-policy contract.
