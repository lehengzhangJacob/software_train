# ADR-0003: Inspectable Agent Memory Data Model

## Status

Accepted by C-03-A1 on 2026-08-15.

## Context

The local nutrition tool needs conversations that survive page reloads and a smaller set of durable facts that can shape future advice. Conversation history and long-term memory have different deletion, provenance and retrieval semantics. Treating the full chat transcript as memory would make correction difficult and would send unnecessary personal data to every model request.

## Decision

- `AgentThread` owns ordered `AgentMessage` records for inspectable local conversation history.
- `MemoryItem` is a separate primary-profile-owned fact with category, status, confidence, importance, source and optional expiry.
- A memory may reference one source message. Deleting that message sets the reference to null and does not delete the memory.
- Inferred memories start unconfirmed. User-created or user-edited memories are marked confirmed and record `user_edited_at`.
- Users can view, edit, disable and hard-delete every memory.
- Retrieval only uses active, unexpired memories and ranks confirmed and important items ahead of weak inferences.
- The first implementation uses structured SQLite rows, not embeddings or a remote vector store.
- System prompts, API keys, payment credentials, image data URLs and raw provider error bodies are never persisted as messages or memories.

## Consequences

Deleting a thread removes its messages but preserves separately managed long-term memories. Advice can cite memory provenance without treating a model inference as a user-confirmed fact. Semantic vector retrieval remains a future amendment if local structured retrieval becomes insufficient.
