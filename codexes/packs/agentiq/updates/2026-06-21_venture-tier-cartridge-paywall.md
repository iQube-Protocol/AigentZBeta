# Venture tier split + cartridge-access paywall + aigentMe venture badge

**Date:** 2026-06-21
**Branch:** `claude/optimistic-davinci-exiykx`
**Revises:** `2026-06-21_step4-plan-tiers-gating.md`

## The model (operator-confirmed)

**Cartridge access is gated by payment; admin is an override.** The primary gate
is the persona's plan (subscription or outright purchase); admins see all
cartridges regardless. Entitlements are decoupled (a persona can hold Venture Lab
and/or Marketa access independently of any bundle).

Tier split:

| Tier | Ventures | Venture Lab cartridge | Marketa | Notes |
|---|---|---|---|---|
| **Citizen** (free) | 0 (glimpse only) | ❌ | ❌ | persona + experience + Standing; can still populate their **VentureQube Lite** (experience-model venture) which informs aigentMe — but cannot *activate* it in Venture Lab |
| **Venture Lab Lite** | 1 | ✅ | ✅ | first paid tier — the upgrade CTA |
| **Venture Lab Pro** | 3 | ✅ | ✅ | |
| **Venture Lab Elite** | unlimited | ✅ | ✅ | |

The free citizen keeps their persona-anchored venture (VentureQube Lite, the
synthesised experience-model venture) and a **glimpse badge** on aigentMe; the
Venture Lab cartridge + Marketa are the premium unlock.

## What shipped

- **`persona_plans`** migration revised: `venture_tier` (none/lite/pro/elite)
  replaces the earlier `founder_office_tier`. `plan_tier` (citizen ladder) kept
  for future premium citizen levels.
- **`services/billing/personaPlan.ts`** — resolves `ventureLabAccess`,
  `marketaAccess`, `ventureLimit` (0/1/3/unlimited) from `venture_tier`.
- **`GET /api/billing/plan`** — returns the tier + entitlements + labels.
- **Cartridge-access paywall** — `CodexPanelDynamic` injects the plan-gated
  activations (`venture-lab`, `marketa`) into the effective activation set:
  **admins get all; paid personas get theirs; free citizens get none** (the
  existing `activationId: 'venture-lab'` group gate then hides Venture Lab).
  Additive + fail-open (a failed plan fetch never removes existing access).
- **`createVentureQube`** — enforces `ventureLimit` per tier (free = 0 → "Venture
  Lab is a premium service. Upgrade to Venture Lab Lite…").
- **aigentMe venture-position badge** (`VenturePositionChip`) in the right-pane
  carousel — the free-citizen *glimpse*: shows the derived venture position
  (growth label + zone) and, on click, an inline capsule with an **"Upgrade to
  Venture Lab Lite"** CTA (or "Open Venture Lab" when access exists).
- **ExperienceQube badge truncated** (`max-w-[150px] truncate`) so more carousel
  badges fit.

## Verify in dev (the one thing I can't test here)
Confirm a **non-admin free citizen** does NOT see the Venture Lab group in metaMe
(and a granted persona does). If free citizens currently receive a legacy
`venture-lab` persona_activation from some auto-grant path, that legacy grant
would still show it — tell me and I'll make `venture-lab` plan-derived only.

## Operator actions (Supabase)

```sql
-- Apply (revised): supabase/migrations/20260621100000_persona_plans.sql
--   If you already applied the earlier version: drop table persona_plans; then re-apply (no data yet).

-- Grant Venture Lab Lite (1 venture + VL + Marketa):
insert into public.persona_plans (persona_id, plan_tier, venture_tier, source)
values ('<PERSONA_ID>', 'citizen', 'lite', 'grant')
on conflict (persona_id) do update
  set venture_tier = excluded.venture_tier, status = 'active', updated_at = now();
--   Pro = 3 ventures: venture_tier='pro'   ·   Elite = unlimited: venture_tier='elite'
--   Back to free: venture_tier='none'
```

## Decoupled entitlements (future)
The model already separates `ventureLabAccess` and `marketaAccess`; today both
derive from `venture_tier`. To sell Marketa or Venture Lab independently, add
discrete grant columns/rows and OR them into the resolver — the gating
(`PLAN_GATED_ACTIVATIONS`) already keys off the two flags.
