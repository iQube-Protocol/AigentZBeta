# Step 4 — persona plan tiers + VentureQube Lite/Pro gating

**Date:** 2026-06-21
**Surface:** billing/entitlement + Founder Office (Venture Lab)
**Branch:** `claude/optimistic-davinci-exiykx`

## What shipped (Step 4 — the entitlement keystone)

The persona-scoped plan layer that makes the commercial model real, and the
Lite/Pro gate on VentureQubes.

- **`persona_plans` table** (`20260621100000_persona_plans.sql`) — one row per
  persona: `plan_tier` (citizen / citizen_plus / sovereign_citizen /
  first_citizen) + `founder_office_tier` (none / basic / pro / elite) + status.
  T0 `persona_id`, service-role RLS.
- **`services/billing/personaPlan.ts`** — `getPersonaPlan(admin, personaId)`
  resolves the plan and the entitlements: `ventureProUnlocked` (Founder Office
  pro/elite) and `ventureLimit` (Lite = 1, Pro/Elite = unlimited). Defaults to
  the free Citizen tier if the table is unavailable (pending migration never
  locks the free path).
- **`GET /api/billing/plan`** — the active persona's plan + entitlements (T1-safe).
- **Gating in `createVentureQube`** — Lite personas may own one VentureQube; a
  second returns "Upgrade to Founder Office Pro to create additional ventures."
  (The experience-model synthesised venture is not a `venture_qubes` row, so Lite
  operators still get their derived venture plotted + one real VentureQube.)
- **Founder Office UI** — the header badge now reflects the live tier (Lite/Pro)
  from `/api/billing/plan` instead of a hardcoded "Pro"; the cap message surfaces
  on create.

## Stubbed (per the Step 4 scope decision)
- **Checkout / payment** — plan rows are set by admin/grant until the existing
  payment rails are wired. No live billing yet.
- **Pro ExperienceGuide intake** (Standing-fed) and **multiple metaMe Studio
  venture views** — seams exist; deferred (see
  `2026-06-21_ventureqube-lite-pro-step4-scope.md` +
  `2026-06-21_venture-office-followon-backlog.md`).

## Operator actions

Apply the migration, then grant a plan to a persona as needed (Supabase SQL):

```sql
-- 1. Apply: supabase/migrations/20260621100000_persona_plans.sql

-- 2. Grant a persona Founder Office Pro (unlocks multi-venture VentureQube Pro):
insert into public.persona_plans (persona_id, plan_tier, founder_office_tier, source)
values ('<PERSONA_ID>', 'first_citizen', 'pro', 'grant')
on conflict (persona_id) do update
  set plan_tier = excluded.plan_tier,
      founder_office_tier = excluded.founder_office_tier,
      status = 'active',
      updated_at = now();

-- Downgrade to Lite (free):  set founder_office_tier='none', plan_tier='citizen'.
```
