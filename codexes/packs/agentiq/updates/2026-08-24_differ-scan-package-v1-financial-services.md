# Differ Scan Package v1 — Financial Services Journey Spine + MoneyPenny Advisor/Architect/Runtime

**Status:** PACKAGE DEFINITION ONLY — no code has been submitted to any third party
**Date:** 2026-08-24
**Parent:** `2026-08-24_aee-differ-phase0-audit-financial-services.md` (see its "Addendum — Vendor clarification" section)
**Purpose:** define exactly what bounded slice of this codebase should go through Differ's compatibility scan (`https://ramp.getdiffer.com/`), so the operator (or whoever holds the Differ account) can act on it without having to re-derive the scope from the audit.

---

## 0. What this document is and is not

This is a **scope definition**, not a submission. Nothing in this repository has been sent to Differ, ramp.getdiffer.com, or any third party as part of producing this document. Whether and how to actually run the scan is an operator decision — see §4 "Who does what" below.

---

## 1. Bounded scope (unchanged from the Phase 0 audit)

> **Financial Services Journey Spine + MoneyPenny Advisor + MoneyPenny Architect + MoneyPenny Runtime pre-action experience, with consequential Runtime execution kept native.**

This is the SAME boundary the Phase 0 audit already established (`2026-08-24_aee-differ-phase0-audit-financial-services.md` §2–§3) — this document does not widen it. aigentMe, Aigent Z, DevOn, and the wider metaMe UI remain out of scope unless the scan result proves one is an unavoidable dependency.

---

## 2. File/directory list for the scan package

Grouped by what Differ needs to understand the actual interface topology — enough for a meaningful compatibility read, not the whole estate.

### 2.1 Journey Spine core

| Path | Why it's in scope |
|---|---|
| `types/journey.ts` | The journey/stage/state contract every surface below is shaped by. |
| `services/journey/resolveJourneyState.ts` | The authoritative state resolver — Differ needs to see this to understand what it would be OBSERVING, not deciding. |
| `services/journey/interactionContextAssembly.ts` | Builds the recommendation-vs-authorization-safe projection. |
| `services/journey/conditionEvaluator.ts` | How stage satisfaction maps to real evidence — relevant to what a Differ recommendation could safely reference. |
| `services/journey/journeySurfaceRegistry.ts` | The existing surface-reuse registry — shows Differ the "no forking a second UI" discipline already in force. |
| `components/journey/JourneyRunSurface.tsx` | The actual rendered stepper/viewport component — this is the literal UI surface a hosting/observation platform would need to understand. |
| `services/journey/horizenMoneyPennyJourney.ts` | The mature, real Financial Services journey definition (the reference instance audited in Phase 0). |
| `app/api/journey/moneypenny-horizen/state/route.ts` | The real state route this journey's UI reads from. |

### 2.2 MoneyPenny service/orchestration surfaces (Advisor / Architect / Runtime pre-action)

| Path | Why it's in scope |
|---|---|
| `app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx` | The real, live MoneyPenny mode chooser — named the safest first candidate in the Phase 0 audit. |
| `app/(shell)/moneypenny/components/serviceOrchestrationPanelState.ts` | Its state machine — cross-agent isolation discipline Differ's own observation must not violate. |
| `services/financialServices/serviceCatalog.ts` | Defines Advisor/Architect/Runtime as distinct service definitions with explicit `serviceClass`/`governancePath`. |
| `services/financialServices/serviceRequestOrchestrator.ts` | Sequences requests to the catalog entries above. |
| `services/financialServices/discovery.ts`, `services/financialServices/eligibility.ts` | Read-only discovery/eligibility projections the chooser UI displays. |
| `types/financialServices.ts` | The consequence-class / governance-path type contract (`INFORMATIONAL`/`PROPOSAL`/`CONSEQUENTIAL`, `NONE`/`CONSTITUTIONAL_SERVICE_PIPELINE`/`CONSTITUTIONAL_COMMERCE`) — this is the exact vocabulary Differ needs to respect the NATIVE_ONLY boundary in §3. |
| `app/api/moneypenny/architect/route.ts` | Architect's PROPOSAL-class route (never executes). |
| `app/api/moneypenny/service-orchestration/route.ts` | The discovery/orchestration API the chooser UI calls. |

### 2.3 AEE seam (this repo's own provider-neutral boundary, already built)

| Path | Why it's in scope |
|---|---|
| `types/adaptiveExperience.ts` | The `AdaptiveExperienceProvider` contract itself. |
| `services/adaptive/nativeProvider.ts`, `services/adaptive/projectionValidator.ts`, `services/adaptive/journeySpineAdapter.ts`, `services/adaptive/applicationProjectionManifest.ts` | The Phase A implementation Differ's hosted recommendations would need to be validated against. |
| `services/adaptive/providers/differAdapter.ts` | Shows Differ its own current (honest, disabled) integration point in this codebase. |

### 2.4 Native-only boundary — included for topology context, NOT for hosting

These files must be visible to Differ so the scan can tell us whether it recognizes and respects the boundary — they are **not** a request to host or modify their behavior.

| Path | Why it's included, and why it stays native |
|---|---|
| `app/api/moneypenny/runtime/route.ts` | MoneyPenny Runtime's real execution route — CONSEQUENTIAL, 409-gated. The scan needs to see where the boundary is; execution itself is never hosted. |
| `services/constitutional/constitutionalAgreement.ts` | The 409 gate + spend cap — the actual authorization mechanism. |
| `services/registry/capabilityInvocationGates.ts` | Gate 2 — the frozen authoritative-mode exception. |

### 2.5 Explicitly excluded from this package

- Passport, Delegation, and Reciprocal Artifact Exchange capability code (`services/passport/`, `services/delegation/`, `services/research/reciprocalExchange.ts`) — not part of the Financial Services slice; a separate, later scope if ever relevant.
- Everything under `aigentMe`, Aigent Z, DevOn, and the wider metaMe UI — per the Phase 0 audit's own scope boundary.
- Any Supabase migration, credential, or `.env` file — never in scope for a third-party scan, regardless of feature area.

---

## 3. What the scan should tell us (per Iris's own framing)

> "That will tell us to what extent it's compatible with the hosting platform, and where we'd need to adjust things on our side to make it work."

Concretely, we're looking for the scan to answer:

1. Can Differ's hosting platform render `JourneyRunSurface` + the MoneyPenny chooser as-is, or does our component/routing shape need adjustment on Differ's side (per Iris) or ours?
2. Does the scan correctly distinguish `ServiceClass: INFORMATIONAL/PROPOSAL` (Advisor/Architect — hostable) from `CONSEQUENTIAL` (Runtime — must stay native) from the code shape alone, or does that distinction need to be made explicit to Differ out-of-band?
3. What does Differ's compatibility result actually look like (a report, a score, a list of required adjustments) — this shapes what "Phase B evidence" means going forward.

---

## 4. Who does what — the external-action boundary

**This agent (Claude Code) has NOT submitted, uploaded, or connected any code to Differ or ramp.getdiffer.com, and will not do so unilaterally.** Sharing source code with a third-party service is an external, hard-to-reverse action (per this session's own operating rules) that requires explicit operator authorization and, in practice, an operator-held account/credential this agent does not have.

**What is ready for the operator to act on:**

- The bounded file list in §2 above.
- A clear in/out scope boundary (§2.5) and the native-only lines that must not move (§2.4).

**What the operator needs to decide and do:**

1. Confirm whether Differ's scan wants (a) direct access to a repo/branch, or (b) a standalone export containing only the §2 files. `ramp.getdiffer.com` was unreachable when this agent attempted to inspect it directly (`HTTP 503` at time of writing) — the operator should check the actual submission flow themselves rather than have this agent guess.
2. If a bounded export is preferred rather than repo-level access, say so and this agent can prepare one deterministically from the §2 list (a real, reviewable directory/zip — never invented, always exactly the files named above).
3. Run the scan and share the result back — that result becomes Phase B's real evidence, replacing the "blocked pending API/SDK verification" language the Phase 0 audit's addendum already superseded.

---

## Compression

> **The package is defined. The submission is the operator's act, not this agent's — the same boundary this session applies to any action that shares code with, or grants access to, a party outside this repository.**
