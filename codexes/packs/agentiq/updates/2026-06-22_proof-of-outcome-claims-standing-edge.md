# Proof-of-Outcome Claims → Standing accrual edge (Net Value Acceleration)

**Date:** 2026-06-22
**Branch:** `claude/optimistic-davinci-exiykx`
**Status:** shipped (schema + accrual edge + verify endpoint)

## Why

Standing must never accrue from a self-declared outcome — that invites
inflation (a bad agent claiming big wins must not outrank a verified good one).
This change adopts the verification-gated outcome model and refines Proof of
Time Saved (PoTS) into **Net Value Acceleration**:

> NVA hours = max(0, timeSavedHours − riskRepairHours)

i.e. time-to-value saved **net of** the time spent repairing the risk the
venture introduced. PoTS is one dimension of outcome accrual, not the whole
story — a claim also carries `claimedValue` and a `riskProfile` for the human
verifier; the time-net-of-risk figure is what feeds the Standing number today.

## What shipped

1. **Schema — `proofOfOutcomeClaims`** (the "Outcome Accrual Evidence" block) on
   the VentureQube v1.0 outcome layer:
   - `types/ventureQube.ts` — `ProofOfOutcomeClaim` interface +
     `OutcomeClaimVerificationStatus` (`claimed | verified | rejected`). Fields:
     `claimId, description, claimedValue?, timeSavedHours?, riskRepairHours?,
     riskProfile?, verificationStatus, verifier?, verifiedAt?, confidence?
     (0–1), accruedAt?, createdAt?`. `proofOfTimeSaved` is retained but
     deprecated.
   - `services/iqube/ventureQubeSchema.ts` — matching Zod
     `proofOfOutcomeClaimSchema` folded into `outcomeLayerSchema`.

2. **Accrual edge** — `services/venture/ventureOutcomeAccrual.ts`:
   `accrueVentureOutcomes(ventureId)` sweeps verified-but-unaccrued claims,
   sums Net Value Acceleration, credits the owner's **Personal** Standing once
   via the existing `accrueStanding()` keystone (CVS = NVA × confidence), and
   stamps each claim `accruedAt` (idempotent). Reuses the keystone — no parallel
   Standing path; sponsor Delegated/Stewardship + capacity flow through it.

3. **Verification gate** —
   `POST /api/venture/qubes/[ventureId]/verify-outcome` (admin/steward only):
   moves a claim `claimed → verified | rejected`, then runs the accrual sweep on
   verify. The `verifier` label is T2-safe (never a personaId); claims already
   accrued are locked (409).

4. **Anti-inflation on ingest** — the Pro/Portfolio upload ingester
   (`app/api/persona/venture-iqube/ingest/route.ts`) now sanitises uploaded
   claims: every uploaded claim is forced to `verificationStatus: 'claimed'`
   with `verifier/verifiedAt/accruedAt` stripped, so a payload can never
   pre-mark itself verified. The admin verify endpoint is the only path to
   `verified` + accrual.

5. **Download schemas** — `public/downloads/ventureQube-pro-schema.json` gains
   the `proofOfOutcomeClaims` array (portfolio inherits it via its Pro-shape
   reference).

6. **Commentary** —
   `services/polity/frameworks/polity-papers-commentary.v1.json` PoTS concept
   updated to "Net Value Acceleration", with `implementedAs` pointing at the
   new surfaces.

## Verification model (the gate)

```
upload/declare  → verificationStatus: 'claimed'   (accrues nothing)
admin verify    → 'verified' + confidence         → accrual runs once
                  Personal Standing += NVA × confidence; claim.accruedAt set
admin reject    → 'rejected'                       (accrues nothing)
```

## Not done (follow-on)

- A wizard surface for operators to author outcome claims and for stewards to
  verify them in the Bureau / Founder Office UI (API is ready).
- `delegation_grants` persistence table (the other Phase-2 remainder).
