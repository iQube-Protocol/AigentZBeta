# Standing integration — tier ladder + Verified Standing as sovereign iQubes

**Date:** 2026-06-21
**Branch:** `claude/optimistic-davinci-exiykx`

## Context

Integrating Standing (per Standing PRD v1) into the aigentMe citizenship flow +
Founder Operator workflow, on a 3-tier ladder. Assessment found Standing was
already substantially wired (VSP cartridge complete; standingScore +
standingForVenture + commercial-spine standing stage + Founder Office banner +
establish-standing NBE). This pass adds the commercial-model pieces.

## Bug fix (was blocking)
Admins were blocked from creating a VentureQube Pro: `createVentureQube`
enforced the venture-tier limit with no admin override (admin with no
`persona_plans` row → free tier, limit 0). Added `isAdmin` bypass (from the
spine) and made `GET /api/billing/plan` admin-aware (full access flags).

## Phase A — Standing tier ladder
- `persona_plans.standing_tier` (`standing` free | `professional`) —
  `20260621200000_standing_tier.sql`.
- `services/billing/personaPlan.ts`: `standingTier` + `professionalStanding`
  entitlement = `standing_tier==='professional' OR venture_tier in pro/elite`
  (Tier 3 is BOTH a standalone subscription AND bundled with Founder Office Pro,
  per operator decision).
- `GET /api/billing/plan` returns `standingTier`, `professionalStanding`, labels.
- Tier 1 Standing stays free/open (the Standing cartridge, gate 'open'); the
  aigentMe citizenship entry is the existing `establish-standing` NBE + the
  commercial-spine standing stage.

## Phase B — Verified Standing as sovereign iQubes (Tier 2, pay-per-asset)
- `services/vsp/registerVspIqube.ts` — mints a compiled VSP as a citizen-owned
  **DataQube** in the registry SoT (createMetaQube + iqube_id_map +
  persona_token_qube_ownership), T2-safe (one-way `vsp_public_ref` commitment;
  no raw persona id / no BlakQube facts in the meta). Mirrors
  `registerPersonaIqube`.
- `vsp_profiles.iqube_id` — `20260621300000_vsp_iqube.sql`.
- `POST /api/vsp/profiles/[profileId]/mint-asset` — owner/admin, requires the
  profile compiled, idempotent. **Pay-per-asset = outright purchase** (operator
  decision); the per-asset **charge is stubbed** (consistent with the platform
  checkout stub) — minting is live, payment wiring is the follow-up.

## Still to do (Phase C + follow-ups)
- **Phase C** — pull the Standing **Graph** (capability claims + edges, not just
  facts) into the VentureQube capability + signal-evidence layers (deepens
  `standingForVenture`); founder/venture capability evidence in Founder Office.
- Tier 3 Professional Standing surfaces (Reports/Analytics; Opportunity Matching
  stubbed pending the metaCommons engine).
- A "Mint as sovereign asset" button in `StandingCartridgeTab` (endpoint ready).
- Wire per-asset + Professional Standing checkout on the payment rails.

## Operator actions (Supabase)
```sql
-- Apply in order:
--   20260621100000_persona_plans.sql   (if an earlier version was applied: drop table persona_plans; re-apply — no data)
--   20260621200000_standing_tier.sql   (ALTER add standing_tier)
--   20260621300000_vsp_iqube.sql       (ALTER add vsp_profiles.iqube_id)

-- Grant Professional Standing as a standalone subscription:
update public.persona_plans set standing_tier = 'professional', updated_at = now()
where persona_id = '<PERSONA_ID>';
--   (or it's auto-granted by venture_tier pro/elite — bundled with Founder Office Pro)
```
