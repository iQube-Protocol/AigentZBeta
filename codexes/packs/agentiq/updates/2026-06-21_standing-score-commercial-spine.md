# Standing score + commercial-spine journey backbone (Step 1)

**Date:** 2026-06-21
**Surface:** Standing + Founder Office (Venture Lab cartridge)
**Branch:** `claude/optimistic-davinci-exiykx`

## Context

Step 1 of the four-part plan to make the **Passport → aigentMe Delegation →
Standing → Founder Office → Venture Lab → [Mobility / metaKnyt verticals]**
journey smooth and compelling **before** any entitlement gating (gating is the
last step, per operator direction).

Audit finding that shaped this: the Standing/VSP service is already fully built
(profile creation, real LLM fact extraction, verification, compilation,
passport-anchoring, asset graph, output generation, vault). What was missing was
(a) a single legible **Standing score**, and (b) **journey stitching** — nothing
connected the surfaces or showed a user the next step.

## What shipped (Step 1)

### Standing score (reconciles two stores into one number)
- `services/standing/standingScore.ts` — `computeStandingScore(admin, personaId)`.
  Veracity-led (Standing-Charter sense): approved/corrected VSP facts weighted by
  confidence level (DOCUMENT_VERIFIED 1.0 → UNKNOWN 0.3) × domain coverage ×
  volume; `crm_persona_reputation.standing_overall` is the secondary contribution
  signal. Returns score/veracity/contribution/bucket/domainsCovered/
  verifiedFactCount/hasCompiledVsp/qualified. Soft-fails on pending migrations.
- `GET /api/standing/score` — T1-safe.

### Commercial-spine backbone (the stitching)
- `services/journey/commercialSpine.ts` — `getCommercialSpineState(admin, personaId)`
  computes per-stage completion (passport / aigentMe delegation / standing /
  founder office / venture lab), the Mobility + metaKnyt verticals (hanging off
  Venture Lab), and the **next best step**. Every probe soft-fails.
- `GET /api/journey/commercial-spine` — backbone for journey CTAs, the
  golden-path NBEs (Step 2), and the matrix funnel (Step 3).

### Wired into VentureQube calibration
- `standingForVenture` now includes the reconciled `score`; `metacommonsSignals`
  uses the 0–100 score (not just the bucket) for the confidence multiplier and
  for `standingConfidence`. Standing still **calibrates, never gates**.

### Surfaced in Founder Office
- `FounderOfficeTab` renders a **commercial-spine strip** (stage dots + next
  step) and shows the real Standing **score** (veracity / contribution split,
  VSP-anchored flag) in the calibration banner.

## Next (per plan, gating last)
- Step 2 — golden-path NBEs consuming `commercial-spine` (author the nudges).
- Step 3 — **matrix-based** commercial funnel built on the Venture Lab growth
  matrix (maturity × commercialization), not a one-dimensional funnel.
- Step 4 — persona plan tiers + entitlement gating (LAST).
