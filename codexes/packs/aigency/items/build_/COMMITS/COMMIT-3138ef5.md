# Commit Brief: `3138ef5` — ops: anchor cron + K/T policy backend — schema, cron-tick, calibration, history

| Field | Value |
|-------|-------|
| SHA | [`3138ef5`](https://github.com/iQube-Protocol/AigentZBeta/commit/3138ef5bf8a893048e4e1410cab9775f53b11114) |
| Author | Claude |
| Date | 2026-06-01T12:36:24Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
ops: anchor cron + K/T policy backend — schema, cron-tick, calibration, history

Phase 1 of the anchor-economics fix per the proposed K=50/T=15min
policy. Replaces the client-driven auto-process loop in
hooks/ops/useSyncStatus (only ran when /ops was open in a browser)
with a server-side cron endpoint that is presence-independent.

Migration 20260531100000_anchor_config_and_history.sql:
- ops_anchor_config — single-row tunable policy
  (batch_size_k=50, max_age_minutes_t=15, cron_cadence_seconds=60,
   is_paused=false)
- anchor_history — append-only ledger of every tick (anchored /
  deferred / skipped / failed) with drift_before / drift_after /
  duration_ms / batch_id / anchor_txid / decision_reason

POST /api/ops/sync/cron-tick:
- Cron-token gated (CRON_TRIGGER_TOKEN header) — infra-driven, no
  persona dependency
- Reads live config from ops_anchor_config every tick
- Size-OR-time decision: anchor when
    posCount >= batch_size_k
    OR (posCount > 0 AND now - lastAnchorAt >= max_age_minutes_t)
- Records every tick in anchor_history
- is_paused kill switch returns no-op without touching canisters

GET/PUT /api/ops/sync/calibration:
- Admin-gated read + write of K / T / cron cadence / is_paused
- Bounds: K [1..10000], T [1..1440 min], cron [10..3600 s]
- Updates are immediate — next cron tick picks up the new values

GET /api/ops/sync/anchor-history:
- Admin-gated. Last N rows for the calibration panel's activity feed
- Optional ?action= filter

Next commits: AnchorCalibrationCard + ops page wiring (commit 2);
network-costs first-class doc (commit 3).
```

## Body

Phase 1 of the anchor-economics fix per the proposed K=50/T=15min
policy. Replaces the client-driven auto-process loop in
hooks/ops/useSyncStatus (only ran when /ops was open in a browser)
with a server-side cron endpoint that is presence-independent.

Migration 20260531100000_anchor_config_and_history.sql:
- ops_anchor_config — single-row tunable policy
  (batch_size_k=50, max_age_minutes_t=15, cron_cadence_seconds=60,
   is_paused=false)
- anchor_history — append-only ledger of every tick (anchored /
  deferred / skipped / failed) with drift_before / drift_after /
  duration_ms / batch_id / anchor_txid / decision_reason

POST /api/ops/sync/cron-tick:
- Cron-token gated (CRON_TRIGGER_TOKEN header) — infra-driven, no
  persona dependency
- Reads live config from ops_anchor_config every tick
- Size-OR-time decision: anchor when
    posCount >= batch_size_k
    OR (posCount > 0 AND now - lastAnchorAt >= max_age_minutes_t)
- Records every tick in anchor_history
- is_paused kill switch returns no-op without touching canisters

GET/PUT /api/ops/sync/calibration:
- Admin-gated read + write of K / T / cron cadence / is_paused
- Bounds: K [1..10000], T [1..1440 min], cron [10..3600 s]
- Updates are immediate — next cron tick picks up the new values

GET /api/ops/sync/anchor-history:
- Admin-gated. Last N rows for the calibration panel's activity feed
- Optional ?action= filter

Next commits: AnchorCalibrationCard + ops page wiring (commit 2);
network-costs first-class doc (commit 3).

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/ops/sync/anchor-history/route.ts` |
| Added | `app/api/ops/sync/calibration/route.ts` |
| Added | `app/api/ops/sync/cron-tick/route.ts` |
| Added | `supabase/migrations/20260531100000_anchor_config_and_history.sql` |

## Stats

 4 files changed, 535 insertions(+)
