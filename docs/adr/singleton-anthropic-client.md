# ADR: Singleton Anthropic Client

**Date:** 2026-04-10  
**Status:** Accepted  
**Context:** M9 — Agent Improvements (Phase 4.5: Thread Safety)

---

## Context

Sophia Platform runs multiple agents in parallel (e.g. QA‖Security, Docs‖Deploy) since M9 Phase 3. Each agent calls `getAnthropicClient()` from `apps/api/src/lib/anthropic.ts`, which returns a lazy singleton instance of the Anthropic SDK client.

**Question:** Is the singleton safe to use concurrently across parallel agents in the same Node.js process?

---

## Decision

**Use the singleton pattern.** No factory is required.

---

## Evidence

T44 (`anthropic-client.test.ts`) verifies three concurrency scenarios using a mocked Anthropic SDK:

1. **Same instance returned on repeated calls** — `getAnthropicClient()` called twice returns the exact same object reference (`a === b`).
2. **2 concurrent calls receive independent responses** — `Promise.all([client.messages.create(...), client.messages.create(...)])` resolves both calls independently with distinct response IDs. Staggered resolution (B before A) does not cause cross-contamination.
3. **Rejection in one concurrent call does not affect the other** — `Promise.allSettled` confirms one rejects and one fulfills independently.

All 3 tests pass (GREEN).

---

## Rationale

The Anthropic SDK client (`@anthropic-ai/sdk`) is implemented as a stateless HTTP wrapper. Each call to `client.messages.create()` is a self-contained HTTP request with its own closure, AbortController, and response stream. Node.js's single-threaded event loop with async I/O ensures that concurrent `await`s on different HTTP requests are safe by design — there is no shared mutable state between calls.

A factory pattern (creating a new `Anthropic` instance per agent) would add unnecessary object allocation overhead and is not required for correctness.

---

## Consequences

- **No change needed** to `apps/api/src/lib/anthropic.ts`.
- Each parallel agent calls `getAnthropicClient()` and receives the same singleton; each `messages.create()` call is independently handled by the SDK.
- Per-call `AbortController` + timeout (implemented in T24) provides call-level isolation within the shared client.
