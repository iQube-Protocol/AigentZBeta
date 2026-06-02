# Commit Brief: `a905e0e` — intent chains commit 6: cron extension for scheduled steps + wait timeouts

| Field | Value |
|-------|-------|
| SHA | [`a905e0e`](https://github.com/iQube-Protocol/AigentZBeta/commit/a905e0ed6bd03bc749533e9496d16ca6d27ccc45) |
| Author | Claude |
| Date | 2026-06-02T01:17:54Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains commit 6: cron extension for scheduled steps + wait timeouts

The anchor cron (/api/ops/sync/cron-tick) now also drives chain
advancement on every tick alongside the anchor cycle. No new
scheduler; the existing CRON_TRIGGER_TOKEN-gated trigger you've
already wired (Uptime Robot / EventBridge / etc.) carries both
concerns.

services/intentChains/advancer.ts:
- advanceScheduledChain(chain) — exported entry for cron-driven
  advancement of scheduled steps. Synthesizes an
  intent_chain_step_completed event with scheduled_advance=true in
  metadata, then routes through the existing onStepOutcomeObserved
  path so branches/next-step resolution behaves identically to
  event-driven advancement.
- timeoutWaitChain(chain) — exported entry for wait-step timeouts.
  Emits intent_chain_timeout DVN receipt with timeout_unit metadata,
  then either routes to step.wait.on_timeout_next via transitionToStep
  OR marks the step failed (chain halts when on_failure='halt').

services/intentChains/cronAdvance.ts (new):
- tickChainAdvances(maxPerTick=50) — single entry the cron calls.
  Two queries leveraging the partial indexes from the migration:
    1. SELECT * FROM intent_chains
       WHERE status IN ('active','waiting')
         AND current_step_kind='scheduled'
         AND scheduled_advance_at <= now()
       ORDER BY scheduled_advance_at LIMIT N
       → advanceScheduledChain per row
    2. SELECT * FROM intent_chains
       WHERE status='waiting'
         AND current_step_kind='wait'
         AND wait_timeout_at <= now()
       ORDER BY wait_timeout_at LIMIT N
       → timeoutWaitChain per row
- Bounded at 50 chains per tick by default. Higher loads catch up
  over subsequent ticks. Returns a ChainTickSummary with counters +
  cap_reached flag.
- Per-row try/catch — one chain failure doesn't poison the batch.

app/api/ops/sync/cron-tick/route.ts:
- Fires tickChainAdvances() in parallel with the anchor cycle (so
  ICP canister calls don't serialize with the Supabase polls)
- Wraps in catch returning a zero-summary so cron-tick stays robust
  if chain advancement throws
- Awaits the chain tick promise immediately before each return path
  and merges chain_tick: {scheduled_advanced, wait_timed_out, errors,
  cap_reached, duration_ms} into every response (200 anchored,
  200 deferred, 200 skipped, 500 failed, 503 unconfigured)
- Operator monitoring: GET /api/ops/sync/anchor-history still works
  for anchor visibility; per-tick chain_tick summary surfaces in the
  cron's response JSON for immediate inspection

End-to-end pipeline now closed for scheduled + wait steps. The 3-day
follow-up in marketa.ask-partner-proposal will advance automatically
once Uptime Robot is firing the cron-tick endpoint.
```

## Body

The anchor cron (/api/ops/sync/cron-tick) now also drives chain
advancement on every tick alongside the anchor cycle. No new
scheduler; the existing CRON_TRIGGER_TOKEN-gated trigger you've
already wired (Uptime Robot / EventBridge / etc.) carries both
concerns.

services/intentChains/advancer.ts:
- advanceScheduledChain(chain) — exported entry for cron-driven
  advancement of scheduled steps. Synthesizes an
  intent_chain_step_completed event with scheduled_advance=true in
  metadata, then routes through the existing onStepOutcomeObserved
  path so branches/next-step resolution behaves identically to
  event-driven advancement.
- timeoutWaitChain(chain) — exported entry for wait-step timeouts.
  Emits intent_chain_timeout DVN receipt with timeout_unit metadata,
  then either routes to step.wait.on_timeout_next via transitionToStep
  OR marks the step failed (chain halts when on_failure='halt').

services/intentChains/cronAdvance.ts (new):
- tickChainAdvances(maxPerTick=50) — single entry the cron calls.
  Two queries leveraging the partial indexes from the migration:
    1. SELECT * FROM intent_chains
       WHERE status IN ('active','waiting')
         AND current_step_kind='scheduled'
         AND scheduled_advance_at <= now()
       ORDER BY scheduled_advance_at LIMIT N
       → advanceScheduledChain per row
    2. SELECT * FROM intent_chains
       WHERE status='waiting'
         AND current_step_kind='wait'
         AND wait_timeout_at <= now()
       ORDER BY wait_timeout_at LIMIT N
       → timeoutWaitChain per row
- Bounded at 50 chains per tick by default. Higher loads catch up
  over subsequent ticks. Returns a ChainTickSummary with counters +
  cap_reached flag.
- Per-row try/catch — one chain failure doesn't poison the batch.

app/api/ops/sync/cron-tick/route.ts:
- Fires tickChainAdvances() in parallel with the anchor cycle (so
  ICP canister calls don't serialize with the Supabase polls)
- Wraps in catch returning a zero-summary so cron-tick stays robust
  if chain advancement throws
- Awaits the chain tick promise immediately before each return path
  and merges chain_tick: {scheduled_advanced, wait_timed_out, errors,
  cap_reached, duration_ms} into every response (200 anchored,
  200 deferred, 200 skipped, 500 failed, 503 unconfigured)
- Operator monitoring: GET /api/ops/sync/anchor-history still works
  for anchor visibility; per-tick chain_tick summary surfaces in the
  cron's response JSON for immediate inspection

End-to-end pipeline now closed for scheduled + wait steps. The 3-day
follow-up in marketa.ask-partner-proposal will advance automatically
once Uptime Robot is firing the cron-tick endpoint.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/ops/sync/cron-tick/route.ts` |
| Modified | `services/intentChains/advancer.ts` |
| Added | `services/intentChains/cronAdvance.ts` |

## Stats

 3 files changed, 210 insertions(+), 7 deletions(-)
