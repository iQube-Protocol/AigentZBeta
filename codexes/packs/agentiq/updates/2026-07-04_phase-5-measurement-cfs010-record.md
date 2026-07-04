# Phase 5 — CFS-008 measurement instrumentation + CFS-010 rewritten as record

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Constitutional anchor:** CFS-008 (Reasoning Compression), CFS-010 §4 (completion criterion).

## What shipped

### 1. `invariants_used` on the receipt spine (CFS-008 §2)

New additive migration `20260704100000_activity_receipts_invariants_used.sql`:
`invariants_used text[]` on `activity_receipts` + a GIN index so "which executions used
invariant X" stays cheap. Threaded through `activityReceiptService` exactly like
`iqubes_used` — as an **optional column** in the graceful missing-column retry path, so
receipt writes never go down before the migration is applied.

Populated at every grounded act:
- **Consequence runner** — the `knowledge_curated` and `consequence_forecast_recorded`
  stage receipts carry the curated/compressed invariant ids; the `knowledge_evolved`
  receipt carries the executed plan's grounding set.
- **Specialist consultations** — the `specialist_consulted` receipt records the slice the
  packet was grounded in. Receipt-side instrumentation only: a consult is advisory, so
  this does **not** bump usage/Reach (reserved for executions — Law XII discipline).

### 2. Measurement readout — `GET /api/invariants/measurement`

`computeMeasurementRollup` (`services/invariants/measurement.ts`) + a spine-gated route.
Per-namespace: reuse counts (times_used/times_referenced — the adoption axis) and
consequence accuracy (times_validated vs times_contradicted — the validation axis),
reported as **separate axes, never combined** (Law XII). Plus the top-10 reused
invariants and the receipt-spine grounded-execution count — reported as `null` (honestly
unmeasured) until the instrumentation column is applied, never as a fake zero.

### 3. CFS-010 rewritten from plan → record (v1.0)

The plan's own completion criterion (§4): "the migration is complete when this document
can be rewritten as a record rather than a plan." Done — `CFS-010_migration-strategy.md`
is now **v1.0 · status: record**, describing what each stage actually did with commit
receipts (`a32c682a` → `e8372a57` and everything between), the constitutional evolution
ratified along the way (Laws XII–XIV, CFS-011–014), and the two honestly-open gates:
the seventh-primitive canonization (InvariantQubes stay `DataQube` +
`source='invariant_bundle'` until ratified) and the parked `value` score axis.

## Operator actions

One SQL block (Supabase SQL editor) to enable the receipt-side instrumentation:

```sql
ALTER TABLE public.activity_receipts
  ADD COLUMN IF NOT EXISTS invariants_used text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.activity_receipts.invariants_used IS
  'Invariant ids this receipted act was grounded in (CFS-008 §2 reuse-count instrumentation). Empty for ungrounded acts.';

CREATE INDEX IF NOT EXISTS activity_receipts_invariants_used_idx
  ON public.activity_receipts USING gin (invariants_used);
```

Until applied, everything still works: receipts write without the column (graceful
retry), and the measurement endpoint reports the receipt-spine count as `null`.

## What remains open (post-migration, by design)

- The CFS-008 **paper** — production evidence now accrues through this instrumentation;
  the skeleton stands in CFS-008 §6.
- **Seventh-primitive canonization** + `value` score axis — constitutional gates, not
  engineering tasks.
- CFS-007 renderer abstraction; session-start knowledge initialization (needs its
  server-side consumer); rediscovery-savings benchmark (needs A/B harness).
