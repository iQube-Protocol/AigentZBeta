# Per-SKU renewal — add-on subscriptions table (BACKLOG)

**Status:** BACKLOG — scoped, not built.
**Date:** 2026-07-16
**Raised by:** Phase 21 (Research Copilot as its own dedicated tier/SKU). Operator: "add that
to the backlog."

---

## Problem

`persona_plans` is **one row per persona** with a **single shared `current_period_end`** and a
single `status`. Every purchasable tier (`plan_tier`, `venture_tier`, `standing_tier`, and now
`research_tier`) coexists on that one row. This works for a ladder of mutually-reinforcing tiers,
but it breaks down once we sell **independent add-on SKUs** that each need their own billing
lifecycle.

Concretely, after Phase 21:

- A persona who holds **Sovereignty** *and* the **Research Copilot** (`research_tier = 'active'`)
  shares **one** `current_period_end`. Buying the second overwrites the period/`source` of the
  first (`upsertPersonaPlan` updates the shared columns).
- `tierKeyForPlanRow` (the renewal reverse-lookup in `services/billing/planCheckout.ts`) returns
  the **primary** citizen/venture tier only. A research-only purchase (no plan/venture tier)
  reverse-looks-up to `null` → the renewal cron has nothing to renew, so Research Copilot access
  silently lapses at +30 days.
- There is no way to cancel one SKU while keeping another.

This is acceptable for alpha (the renewal cron is generally incomplete, and access is granted for
30 days on purchase), but it is the blocker for a clean à-la-carte add-on economy — which the
research ladder (CFS-034) and any future per-copilot SKU will want.

## Proposed shape

A dedicated **`persona_plan_addons`** table (one row per persona × SKU), separate from the single
`persona_plans` ladder row:

```
persona_plan_addons
  id                uuid pk
  persona_id        uuid  (fk personas)
  sku               text  ('research_copilot', future per-copilot SKUs)
  status            text  ('active' | 'past_due' | 'cancelled')
  source            text  ('checkout' | 'paypal' | 'grant')
  current_period_end timestamptz
  created_at / updated_at
  unique (persona_id, sku)
```

Then:

1. **Checkout** — when `TIER_CONFIG[tierKey]` is an add-on SKU (flag it in the config, e.g.
   `kind: 'addon'`), `applyPlanPurchase` writes/updates the `persona_plan_addons` row for that SKU
   with its OWN 30-day period, instead of the shared `persona_plans` columns. Ladder tiers keep
   writing `persona_plans` as today.
2. **Entitlement resolve** — `getPersonaPlan` reads the addons table and derives
   `researchCopilotAccess` (and future add-on flags) from an **active, in-period** addon row,
   replacing the current `research_tier` column read. Keep `research_tier` as a fallback during
   migration, then drop it.
3. **Renewal cron** — iterate `persona_plan_addons` independently of the ladder renewal, each with
   its own period + wallet-debit. This is where the per-SKU lifecycle actually lives.
4. **Cancel** — flip one addon row to `cancelled` without touching the ladder row or sibling SKUs.

## Migration path

- Add `persona_plan_addons`; backfill an `active` `research_copilot` row from every
  `persona_plans.research_tier = 'active'` (copy `current_period_end`).
- Switch `getPersonaPlan`'s `researchCopilotAccess` source to the addons table (with the
  `research_tier` column as a transitional fallback).
- Once the addons path is live and the cron renews it, retire the `research_tier` column read.

## Files this will touch

- `supabase/migrations/*` — new `persona_plan_addons` table + backfill.
- `services/billing/planCheckout.ts` — `TIER_CONFIG` add-on flag; `applyPlanPurchase` /
  `upsertPersonaPlan` add-on branch; add-on renewal reverse-lookup.
- `services/billing/personaPlan.ts` — `researchCopilotAccess` sourced from the addons table.
- The renewal cron (wallet-debit renewal path) — iterate addons.
- (No UI change — `PlanUpgradeModal` already sells the SKU tier-key; only the persistence +
  renewal backing changes.)

## Why deferred

The Phase 21 single-row model **grants access correctly on purchase** (30-day window), which is
sufficient for alpha. The add-on table is a billing-lifecycle upgrade (independent renewal +
cancel), not a functional gap in the unlock itself — so it is backlog, not a launch blocker.
