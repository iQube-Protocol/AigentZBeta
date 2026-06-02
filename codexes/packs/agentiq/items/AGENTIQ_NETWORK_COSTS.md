# AgentiQ Network Costs — Reference

**Status:** First-class reference doc. Updated as cost knobs change.
**Owners:** Ops + Network Economics workstream.
**Last revised:** 2026-05-31 (initial K/T policy + cron cutover).

This document is the canonical reference for what it costs to run the AgentiQ network's receipt + anchor + cross-chain proof stack, and how the operator-tunable knobs trade cost against audit timeliness.

---

## 1. The four cost layers

| Layer | Role | Where the cost sits |
|---|---|---|
| **PoS canister (ICP)** | Receives every receipt event (one per audited write) | ICP cycles — negligible at runtime scale |
| **Merkle batcher (ICP)** | Computes a Merkle root over the pending receipts | ICP cycles — negligible |
| **BTC anchor** | Writes the Merkle root as an OP_RETURN on Bitcoin | **Real BTC tx fee** (mainnet) — the dominant cost |
| **LayerZero cross-chain** | Propagates the anchored proof to EVM chains via DVN canister | **Destination-chain gas** per message |

Audit hierarchy from fastest to most durable:

```
receipt → ICP consensus  (seconds)
       → LayerZero msg  (seconds; cross-chain visibility)
       → Merkle root    (at anchor time; proves receipt's inclusion)
       → BTC anchor     (within audit SLA; immutable seal)
```

Skipping the BTC anchor permanently breaks the durability promise. The K/T policy never skips it — it only **defers** within a bounded window.

---

## 2. The K/T anchor policy

Receipts accumulate on the PoS canister. The cron tick (`/api/ops/sync/cron-tick`) fires every `cron_cadence_seconds` and decides per tick:

> Anchor when **EITHER**
> - `pos.pending_count >= K` (size trigger), **OR**
> - `pos.pending_count >= 1 AND (now − last_anchor_at) >= T` (time trigger)
>
> Otherwise defer to the next tick.

K is the **cost lever**: higher K = more receipts per anchor = lower per-receipt cost.
T is the **audit lever**: lower T = tighter "max age before anchor" guarantee.

A kill-switch `is_paused` returns no-op without touching canisters — for maintenance windows.

### Decision matrix

| Pending count | Age since last anchor | Result |
|---|---|---|
| 0 | any | `skipped` — `idle` |
| `>= K` | any | `anchored` — `size_k` |
| `>= 1` and `< K` | `>= T` | `anchored` — `time_t` |
| `>= 1` and `< K` | `< T` | `deferred` |

Every decision lands in `anchor_history` for audit + ops UI visibility.

### Knob bounds

| Knob | Default | Bounds | Stored at |
|---|---|---|---|
| `batch_size_k` (K) | 50 | 1 – 10,000 receipts | `ops_anchor_config` (Supabase) |
| `max_age_minutes_t` (T) | 15 | 1 – 1,440 minutes | `ops_anchor_config` (Supabase) |
| `cron_cadence_seconds` | 60 | 10 – 3,600 seconds | `ops_anchor_config` (informational) |
| `is_paused` | false | bool | `ops_anchor_config` |

Edits via `/ops` Anchor Calibration card → PUT `/api/ops/sync/calibration` → next cron tick picks up the new values. No redeploy.

> ⚠️ `cron_cadence_seconds` in the config table is **informational only**. The actual schedule is set in the external trigger (Amplify EventBridge / GitHub Actions / external uptime monitor). Setting it in the table changes the surface displayed on the calibration card but does **not** change the trigger frequency.

---

## 3. Current testnet posture (today)

The ops stack runs on:
- **BTC testnet** (Blockstream API endpoints; testnet faucet-funded)
- **LayerZero testnet** across Sepolia / Polygon Amoy / Optimism Sepolia / Arbitrum Sepolia / Base Sepolia / Solana testnet
- **ICP mainnet canisters** (PoS + DVN run on real ICP)

Daily $ cost today: **~$0 USD**. Testnet faucets cover BTC tx fees and EVM gas; ICP cycles are pre-funded.

The economics matter at **mainnet cutover**. Section 4 is the projection.

---

## 4. Mainnet cost model

Assumptions (clearly labelled as model inputs — they're not measurements):

| Component | Low | Typical | High | Notes |
|---|---|---|---|---|
| BTC mainnet OP_RETURN tx | $1 | $5 | $20 | Volatile with mempool fee market |
| 1 LayerZero msg (ICP → EVM) | $0.50 | $2 | $5 | Destination-chain gas varies |
| **Per anchor cycle (BTC + LZ)** | **$1.50** | **$7** | **$25** | |
| ICP cycles (PoS canister tick) | ~0 | ~0 | ~0 | <<$0.01/cycle, ignored |

Cycles per day formula:
```
cycles_per_day = min(
  cron_cap,                                  // 1440 at 60s cron
  max(T_window_count,                        // 96 at T=15min; 48 at T=30min
      receipts_per_day / K)
)
where T_window_count = 1440 / T_minutes
and a cycle only fires when pending_count >= 1.
```

### Proposed defaults: K=50, T=15min, cron=60s (15-min audit SLA)

| Receipts / day | Cycles / day | Min daily ($1.50/cyc) | Typical ($7/cyc) | Max ($25/cyc) |
|---|---|---|---|---|
| 100 (sparse) | ~50 | $75 | $350 | $1,250 |
| 1,000 (steady) | ~96 | $144 | $672 | $2,400 |
| 10,000 (busy) | ~200 | $300 | $1,400 | $5,000 |
| 50,000 (flood) | ~1,000 | $1,500 | $7,000 | $25,000 |
| 100,000+ (cron-capped) | 1,440 | $2,160 | $10,080 | $36,000 |

### Aggressive variant: K=100, T=30min (30-min audit SLA)

| Receipts / day | Cycles / day | Min daily ($1.50/cyc) | Typical ($7/cyc) | Max ($25/cyc) |
|---|---|---|---|---|
| 100 (sparse) | ~25 | $38 | $175 | $625 |
| 1,000 (steady) | ~48 | $72 | $336 | $1,200 |
| 10,000 (busy) | ~100 | $150 | $700 | $2,500 |
| 50,000 (flood) | ~500 | $750 | $3,500 | $12,500 |

### Cost per receipt (the useful number)

| Traffic | Proposed (K=50, T=15) typical | Aggressive (K=100, T=30) typical |
|---|---|---|
| Sparse (100/day) | $3.50/rx | $1.75/rx |
| Steady (1K/day) | $0.67/rx | $0.34/rx |
| Busy (10K/day) | $0.14/rx | $0.07/rx |
| Flood (50K/day) | $0.14/rx | $0.07/rx |

Aggressive is ~2× cheaper per receipt at every traffic level in exchange for 2× the audit SLA.

---

## 5. How to tune for your operating regime

1. **Default conservative**: Proposed (K=50, T=15min). Best balance of cost + auditor-defensible SLA.
2. **High-throughput / cost-sensitive**: Raise K to 100–200; keep T at 15 min. Anchors only when busy; idle days cost $0.
3. **Audit-strict**: Lower T to 5 min; keep K at 50. ~3× more T-driven cycles on sparse days, but every receipt anchors within 5 min.
4. **Maintenance window**: Toggle `is_paused = true`. Cron returns no-op; nothing posts to BTC. Resume to drain backlog at the next cycle.
5. **Burst expected**: Drop `cron_cadence_seconds` from 60 → 30 in the external trigger config to raise the burst ceiling. Note: this requires changing the actual trigger, not just the calibration knob.

### Anti-patterns

- **K=1**: Anchors every single receipt — defeats batching. ~$5/receipt typical at busy traffic.
- **T=1440 (24h)**: 24h audit window. Cheap on sparse days but audit-fragile.
- **Disabling the cron + relying on client-side `/ops`-driven repair**: The original behaviour that drove the 3400-item drift. Always run the server-side cron.

---

## 6. Operational reality checks

### Verify the cron is firing

```sql
-- Should return ticks within the last few cron_cadence_seconds intervals
SELECT cycle_action, decision_reason, receipt_count, drift_before, drift_after, created_at
FROM anchor_history
ORDER BY created_at DESC
LIMIT 20;
```

### Detect drift backlog before it grows

```sql
-- Average drift over the last hour
SELECT
  AVG(drift_before) AS avg_drift,
  MAX(drift_before) AS max_drift,
  COUNT(*) FILTER (WHERE cycle_action = 'anchored') AS anchored,
  COUNT(*) FILTER (WHERE cycle_action = 'failed') AS failed
FROM anchor_history
WHERE created_at > now() - interval '1 hour';
```

If `max_drift > K × 3` for sustained periods, raise K or lower cron cadence.

### Identify failed cycles

```sql
SELECT created_at, error, drift_before
FROM anchor_history
WHERE cycle_action = 'failed'
ORDER BY created_at DESC
LIMIT 50;
```

Common causes: ICP canister unreachable; BTC anchor RPC timeout; Lambda function timeout on a long batch.

---

## 7. Files + endpoints reference

| Concern | File |
|---|---|
| Schema | `supabase/migrations/20260531100000_anchor_config_and_history.sql` |
| Cron-tick endpoint | `app/api/ops/sync/cron-tick/route.ts` |
| Calibration read/write | `app/api/ops/sync/calibration/route.ts` |
| History read | `app/api/ops/sync/anchor-history/route.ts` |
| Calibration UI | `components/ops/AnchorCalibrationCard.tsx` |
| Sync status (drift snapshot) | `app/api/ops/sync/status/route.ts` |
| Manual repair (operator-pushed) | `app/api/ops/sync/repair/route.ts` |
| PoS canister IDL | `services/ops/idl/proof_of_state.ts` |
| DVN canister IDL | `services/ops/idl/cross_chain_service.ts` |

External trigger requirements:
- `POST /api/ops/sync/cron-tick`
- Header: `X-Cron-Token: <CRON_TRIGGER_TOKEN>` (env-configured secret)
- Schedule: matches `cron_cadence_seconds` (default 60s)
- Suggested infra: Amplify EventBridge schedule → Lambda → fetch the URL; or an external uptime monitor pingback (Uptime Robot, Better Stack) as a quick start.

---

## 8. Future work

The current implementation covers the size-OR-time policy + audit ledger + UI calibration. Worth filing as separate backlog items:

1. **Per-invocation tx ceiling** — cap how many receipts a single tick processes so a 3000-backlog doesn't time out one Lambda. Multiple cron ticks drain it progressively.
2. **Tiered cron cadence under high drift** — auto-escalate cron from 60s → 15s when `drift_before > K × 5` for N consecutive ticks; revert when caught up.
3. **Drift-trend chart on /ops** — sparkline of `drift_before` over the last 24h alongside the current calibration card.
4. **Cost telemetry** — record observed BTC fee per anchor + LZ gas per message in `anchor_history`, surface as a running cost meter in the calibration card.
5. **Multi-rail audit** — write the Merkle root to a second rail (OpenTimestamps or a second EVM chain) as a redundancy layer. Costs roughly +$0.50–2 per anchor cycle.

Pick one and file via a backlog doc in `codexes/packs/agentiq/updates/` per the standard pattern.

---

**End of network-costs reference.**
