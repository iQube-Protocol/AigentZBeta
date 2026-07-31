# VentureQube Lite / Pro + Step 4 scope (build-now vs stub)

**Date:** 2026-06-21
**Branch:** `claude/optimistic-davinci-exiykx`

## Naming (shipped this change)

- **VentureQube Lite** = schema `venture-iqube/v0.1–v0.4`. The **standard / free**
  path, wired into the aigentMe experience-model onboarding (single-venture idea
  incubation; matrix position derived in the Lite experience-guide flow).
- **VentureQube Pro** = schema `venture-iqube/v1.0`. The **premium** path
  (Step 4): multi-venture/portfolio, advanced Pro experience-guide intake fed by
  Standing declarations, Venture Lab Pro surfaces, multiple metaMe venture views.

The `venture-iqube/vX` strings stay as canonical protocol IDs; Lite/Pro are
display labels mapped via `ventureQubeTier()` / `VENTUREQUBE_TIER_LABEL`
(`types/ventureQube.ts`). Founder Office is the Pro surface (it creates Pro
VentureQubes) and is now labelled accordingly.

## Step 4 — what to BUILD when we get there

1. **Persona-scoped plan-tier entitlement layer (keystone).** Plans —
   Citizen / Citizen Plus / Sovereign / Founder Office Basic / Pro / Elite —
   held by the persona, wired into `evaluateAccess` + `cartridgeFlags`; checkout
   via the existing payment rails. (No new crypto; entitlement + gate only.)
2. **Gate Pro vs Lite.**
   - VentureQube **Lite** (single venture, experience-model derived) = free,
     ungated. Enforce a single-venture cap for non-Pro personas in
     `createVentureQube`.
   - VentureQube **Pro** (multi-venture creation in Founder Office, Venture Lab
     Pro surfaces) = gated behind the Founder Office Pro entitlement.
3. **Enforce at the seams already in place:** Founder Office tab (Pro creation),
   `services/venture/ventureQubeService.createVentureQube` (Lite cap), the
   Venture Lab Pro surfaces, and the multiple-metaMe-views toggle.

## Step 4 — what to STUB for follow-on dev (do NOT build yet)

1. **Pro ExperienceGuide intake.** The advanced intake that pulls from the
   Standing declarations process *beyond* what Lite derives, to populate the
   richer VentureQube Pro layers. Seam already exists:
   `services/venture/standingForVenture.ts` reads Standing and
   `ventureQubeService.calibrate()` folds it in — Pro intake extends this with a
   deeper declarations→Pro-layer population + a dedicated intake UI. **Stub:**
   documented seam + entitlement check; build the advanced intake later.
2. **Multiple metaMe venture views in the Studio.** Per-venture Studio matrix
   views for Pro operators. Seam already exists: the matrix calibration
   (`experienceMatrixDeriver`) already returns **per-venture** growth points; a
   multi-view is a venture selector that re-points the Studio's calibrated cell
   per venture. **Stub:** data is there; the multi-view selector UI is follow-on.
3. **Pro portfolio management** beyond the v1.0 basics (cross-venture rollups,
   portfolio-level confidence, investor-office handoff). **Stub:** follow-on.

## Why this split
Lite stays the free acquisition/onboarding path (maximises Passport→active
conversion). Pro is the monetised apex (Founder Office Pro) — so the gating in
Step 4 maps cleanly onto Lite=free / Pro=paid, and the heavier Pro intake +
multi-view capabilities are deferred until the tier layer exists to gate them.
