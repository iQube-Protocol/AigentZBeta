# explain_primitive — resilient canon reads (fix the flaky "could not reach the canon")

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** fix
**Trigger:** live MCP session — `explain_primitive("standing")` / `"delegation"` intermittently
returned "could not reach the invariant canon" while `"Founder Office"` resolved fine.

## Root cause

The canon reads in `services/threshold/irlAdapter.ts` are same-origin, server-to-server
fetches from the Threshold Lambda to `/api/public/irl/*`. They had **no timeout and no
retry**, so a single transient blip (Lambda cold start / Supabase latency) surfaced to the
agent as a hard failure. The asymmetry the operator saw was real: curated terms
("standing", "delegation") went through the `?ids=` read (which forces a 500-row store read)
and **hard-failed** if it blipped; un-curated terms ("Founder Office") went through the
lighter `?q=` search and happened to succeed.

## The fix

1. **`resilientFetch`** — all canon READ paths (the invariants list + the `/resolve` POST)
   now run through a bounded-timeout (9s), 2-retry-with-backoff wrapper. Retries on network
   error / abort / 5xx; a 4xx is a real answer and is not retried. (Writes — `submitResult` —
   are left single-shot: non-idempotent, must not double-submit.)
2. **Curated terms never hard-fail.** `definePrimitive` for a curated primitive now:
   - tries the curated `?ids=` read; if it blips, **falls back to the resilient `?q=` text
     search** (the path that worked live) for Layer 1;
   - **always returns the in-code `distinctions`** — the load-bearing constitutional guards
     (Standing is personhood-bound; Standing is NOT reputation; Standing never confers
     citizenship) are held in the gateway, not fetched, so they answer even if every canon
     read is momentarily unavailable. `retrievedVia` states which path served Layer 1.
3. The un-curated branch shares the same resilient `qSearch` helper.

Net effect: a momentary canon blip degrades to "here are the constitutional distinctions;
retry for the full ratified statements" instead of a blank "could not reach the canon."

## Files

- `services/threshold/irlAdapter.ts` — `resilientFetch` + curated fallback + always-on distinctions.

No migration, no gate touched, no canon mutated. Ships with the normal dev push.
