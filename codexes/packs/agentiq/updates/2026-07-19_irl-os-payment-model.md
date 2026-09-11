# IRL OS payment model — fold the research agent into the tier ladder (2026-07-19)

Operator direction: make IRL OS mirror aigentZ/DevOn. The Research Agent stops
being a standalone-only add-on and becomes the premium service within IRL OS.

## The model

| Tier | Price | Grants |
|---|---|---|
| Free | — | IRL OS content (read the lab, publications, participate). |
| **Sovereign** | $29/mo | **EITHER** aigentZ **OR** Research Agent (light) — the subscriber picks one (`sovereign_selection`). Research light = **3 experiments/month**. |
| **Steward** | $99/mo | **BOTH** aigentZ + Research Agent (full). Full = **high experiment cap** (`STEWARD_EXPERIMENT_CAP` = 50/month — a high cap, not unlimited). |
| Add-ons | $29/mo each | `aigentz_tier` and `research_tier` are standalone, stackable add-ons so a subscriber on one path can bolt the other service on without going to Steward. |

Grandfathering (non-breaking):
- `sovereign_selection` NULL reads as `'aigentz'` — every existing Sovereign
  subscriber keeps aigentZ until they explicitly switch.
- `research_tier === 'active'` holders keep the Research Agent (add-on clause).

## BUILT (committed)

- **Migration** `20260726000000_persona_plans_sovereign_selection.sql` —
  `sovereign_selection` + `aigentz_tier` columns on `persona_plans`, and the
  `experiment_run_counters` table (monthly quota).
- **`services/billing/personaPlan.ts`** — entitlement resolution: `aigentzLiteAccess`
  / `researchCopilotAccess` derive from steward | sovereign-selection | add-on;
  new `experimentMonthlyCap` (3 light / 50 steward / 0 none); grandfathering.
  `RESEARCH_LIGHT_EXPERIMENT_CAP` / `STEWARD_EXPERIMENT_CAP` constants.
- **`services/billing/experimentQuota.ts`** — `checkExperimentQuota` /
  `recordExperimentRun` (admin-uncapped, monthly counter).
- **`services/billing/planCheckout.ts`** — `aigentz` add-on tier + $29 price.
- **`services/activations/activationPlanGate.ts`** — `researcher` now upsells
  Sovereignty (either/or) instead of the standalone SKU.
- **`data/activation-catalog.ts`** — the `researcher` card becomes the **IRL OS**
  card (id kept so grants/deep-links resolve); new **metaMe IRL** admin card
  (`adminOnly`, payment-gate stubbed for future). Both surface builders
  (`spineActivations`, `personaActivations`) hide `adminOnly` cards from
  non-admins.

## Operator SQL (run once)

```sql
ALTER TABLE public.persona_plans
  ADD COLUMN IF NOT EXISTS sovereign_selection text,
  ADD COLUMN IF NOT EXISTS aigentz_tier text;
CREATE TABLE IF NOT EXISTS public.experiment_run_counters (
  persona_id uuid NOT NULL,
  period text NOT NULL,
  runs int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, period)
);
ALTER TABLE public.experiment_run_counters ENABLE ROW LEVEL SECURITY;
```

Since checkout is stubbed (rows admin-granted), set a persona's path by writing
`persona_plans`: `plan_tier='sovereign_citizen', sovereign_selection='research'`
for a research-light sovereign; `plan_tier='steward'` for full; `aigentz_tier='active'`
/ `research_tier='active'` for add-ons.

## REMAINING (next increment — flagged for operator confirmation)

1. **Open the experiment-run routes to paid tiers + enforce the cap.** The
   `/api/experiments/exp00*` routes are currently **admin-only** and spend
   provider credits (~25 model calls per experiment). The model requires paid
   Sovereign/Steward users to run experiments (3/50 per month), so those routes
   must change from admin-only to **admin OR `researchCopilotAccess`**, with the
   monthly cap enforced at the results-publish chokepoint via `experimentQuota`.
   This opens previously-admin-only credit-spending routes to paid tiers — a
   deliberate gate broadening the pricing model calls for; held for explicit
   operator confirmation before wiring.
2. **Checkout either/or UI** — `PlanUpgradeModal` needs the Sovereign
   pick-one (aigentZ vs Research Agent) selector + the aigentZ add-on tile.
   Lower urgency while checkout is stubbed (admin-granted).
3. **Request-access → CAS** — the IRL OS card's "Request access" already routes
   to the pending-request/admin-review flow; optionally re-point it at the
   Constitutional Access Service `research-lab` domain for a unified queue.
