# Horizen Coherence Matrix — Nakamoto Reference Journey

**Date:** 2026-08-10
**Governs:** Item 6 of the operator's POSIT/Observer/AR coherence-pass directive (2026-08-10) — "Produce a coherence matrix for the current Nakamoto Journey. Before changing presentation... Then fix the generic observer/rendering seams, not the individual displayed strings."
**Doctrine:** `codexes/packs/irl/foundation/CFS-055_proof-of-state-in-time-and-state-coherence.md` (operator-ratified same day)
**Method:** live `/state?agentSlug=nakamoto` read (unauthenticated — see caveat below) cross-referenced against a full code audit of the state route, journey definition, `StageReceiptsDrawer`, `AgreementRatifyPanel`, `PulseTransparencyToggle`, `JourneyRunSurface`, and the consequence-fork classifier.

**Caveat on the live pull:** the `/state` read used to populate `EffectiveAt`/`EvidenceRefs`/`DVN` below carried no persona bearer token (unauthenticated GET). Persona-scoped reads (the Ratify agreement row, in particular) fall back to the monotonic ratchet only and understate live evidence for `verify`. This is flagged per row, not silently absorbed.

---

## The matrix

| Predicate | Canonical state | Authority | EvidenceRefs (live) | DVN | Current stepper rendering | Current detail rendering | Current drawer rendering | Mismatch |
|---|---|---|---|---|---|---|---|---|
| **Register** | COMPLETE | `settled-fact` (registration row / `resolveAgentRegistrationState`, not the 10 receipt types) | 16 receipts scanned in, but canonical bypasses them | n/a (not fork-tracked) | ✓ emerald | Evidence checklist shows all 10 present | Shows receipts (agent-scoped, 7 types) | **Confirmed, self-documented in code** (`route.ts:909-919`): several of the 7 drawer types postdate real registrations and will never exist for some agents — a canonically-COMPLETE stage can show a partially-empty drawer |
| **Claim** | COMPLETE | `prior-resolution` | 4 | n/a | ✓ emerald | consistent | 1:1 match, agent-scoped | None — single receipt type (`agent_control_proven`), same scope on both sides. `MarketaEligibilityView` runs a second independent query of the identical fact (not the shared resolver pattern), currently harmless |
| **Orient** | COMPLETE | `prior-resolution` | 1 | n/a | ✓ emerald | consistent | Queries `orientation_ritual_completed` only | **Confirmed for the legacy-precedent path**: an agent admitted before Orient existed can satisfy it via `orientationLegacyPrecedentEstablished(...)` with zero matching receipt — drawer would show empty for that case. `OrientationPanel` itself is coherent (shares `resolveOrientationCompletion`) |
| **Passport** | COMPLETE | `prior-resolution` | **0** | n/a | ✓ emerald | 3 canonical facts present | **"No receipts recorded"** | **Confirmed canary, exact mechanism found**: canonical truth comes from admission/operatorPassport table reads, receipts only corroborate; drawer does its own unscoped `/api/assistant/receipts` scan for 4 types that were never written under this agent |
| **Delegate** | COMPLETE | `prior-resolution` | 0 | n/a | ✓ emerald | `evidenceMissing: [boundedDelegationActive, personaAssignedAsDelegate]` even though COMPLETE | **Drawer suppressed** (`receiptsSurfacedNatively: true`) | Latent, not currently exercised — but `personaAssignedAsDelegate` has no receipt type at all, so if the drawer were ever shown it could never corroborate that signal |
| **Operate** (aigentMe) | COMPLETE | `prior-resolution` | 2 | n/a | ✓ emerald | consistent | **Drawer suppressed** | None currently exercised — receipt-only predicate (`aigentme_activated` + `experienceqube_focus_disposition_recorded`), no settled-fact backdoor |
| **Agreement/Ratify** | COMPLETE (session note: `evidenceMissing` shows all 5 on this unauthenticated pull — persona-gated agreement row didn't resolve without a bearer token; authenticated reads should show it populated) | `prior-resolution` | 4 | verify fork = **Proven** | ✓ emerald, "Proven" | `AgreementRatifyPanel` never receives `runtimeState` at all | **Unscoped** query across 9 receipt types incl. two (`agreement_formed`/`agreement_authorized`) the route's own comment says are tagged only to `aigent-z`, never the subject agent | **Confirmed, two independent failure directions**: (1) `AgreementRatifyPanel` hand-duplicates the `AGREEMENT_STATUS_RANK` comparison in a second, unshared `isAuthorized` check, and independently polls `/verify/status` for Pulse/P&L labels; (2) the drawer's unscoped scan can both under-report (canonical COMPLETE, receipt not agent-tagged) and cross-contaminate (surface another agent's `agreement_formed` receipt under the same persona) |
| **Pulse Authorization** | **not-started** (live) | evidence (`hasReceipt`) | 0 | — | dependent on Ratify's node, no separate node | `PulseTransparencyToggle` never receives this boolean as a prop | in the same unscoped 9-type list as Ratify | **Confirmed independent re-derivation**: the toggle gates its own "Pulse monitoring authorized" card on `horizen.pulse?.enabled` from its own **plain `fetch`** (not `personaFetch`) of the Agent Card, plus a third bespoke `/verify/status` state machine — neither is the canonical `hasReceipt('horizen_pulse_authorized')` |
| **P&L Disclosure** | **complete** per `axes.verification.pnl`, but see caveat — `pnlEvidence` block reports `serviceRegistered:false` | evidence | 0 (this pull) | — | same as above | Toggle computes `disclosureAuthorized` from its **own Agent Card fetch**, never from props | same unscoped list | **Confirmed independent re-derivation** — identical failure shape to Pulse: rendered from Agent Card metadata, never from the canonical `hasReceipt('horizen_pnl_transparency_enabled')` |
| **P&L Service** (registered) | not established (live: `serviceRegistered:false`) | evidence | 0 | `serviceRegisteredDvnStatus: null` | same as above | Toggle: canonical prop **OR** a live corroborating reread — additive-only, documented | **Not in the drawer's type list at all** | **Confirmed coherent** — the OR-with-reread pattern is exactly the doctrine's permitted "Observer Spine corroborates, never overrides" shape |
| **P&L Evidence** (verified) | not established (live: `serviceVerified:false`) | evidence | 0 | `serviceVerifiedDvnStatus: null` | same as above | Toggle: canonical prop only, no override | Not in the drawer's type list | **Confirmed coherent** — pure prop consumption, no independent read at all |
| **Ingest** (Factory, stage `deploy`) | COMPLETE | `prior-resolution` | 3 | fork = **DVN Pending** (established fact + pending anchoring, rendered as two orthogonal facts — correct) | ✓ emerald + amber "DVN Pending" pill | consistent | **Drawer suppressed** | None currently exercised. `IngestIntoFactoryPanel`'s own precondition GET queries the identical receipt type/scope the canonical check uses — a duplicate query, not a shared resolver, but presently coherent |
| **Stand** (Standing) | COMPLETE | `prior-resolution` | 2 | fork = **DVN Pending** | ✓ emerald + amber "DVN Pending" pill | consistent | **Unscoped** raw `standing_accrued` type query | **Confirmed independent re-derivation, same class as Passport**: `standingEvidenceProjection` deliberately excludes superseded/sequencing-invalid receipts from the canonical fact; the drawer's raw scan has no such filter and is also unscoped by agent |

---

## Two structural findings that are ALREADY coherent (worked examples for the fix)

**Consequence-fork / DVN badge rendering (`JourneyRunSurface.tsx`) — no violation found.** The node's emerald/checked state is driven exclusively by `stageState === 'COMPLETE'`; the DVN tier only *adds* a separate amber "DVN Pending" or emerald "Proven" pill. There is no code path where DVN-pending collapses an established fact to grey. Ingest and Stand both demonstrate the doctrine's own worked example (§6) correctly, live, today.

**Stepper (`JourneyRunSurface.tsx`) — no violation found.** Every stage-color decision derives solely from `runtimeState.stages[].state`, the one canonical array the state route returns. The evidence-checklist popover renders `evidencePresent`/`evidenceMissing`/`receiptRefs` already attached server-side — "it computes nothing of its own" per its own comment.

These two are proof that the pattern works when followed — the fix is to bring the drawer and the Ratify/Pulse/P&L panels up to the same discipline, not to invent a new mechanism.

## The recurring mismatch shape (four instances, one root cause each)

1. **Canonical-bypasses-receipts stages** (Register, Orient's legacy path, Passport, and — by the same shape — a governed-corrected Stand): the canonical fact is established from a settled fact / table row / correction-aware projection that deliberately does *not* require a matching receipt, but `StageReceiptsDrawer` always does a fresh, type-only receipt search. **Fix shape:** the drawer should consume `runtimeState.stages[stageId].receiptRefs`/`evidencePresent` (already computed and attached) as its primary evidence source, with its own search retained only as a clearly-labeled supplementary/historical section — exactly CFS-055 §7.

2. **Unscoped drawer queries** (Ratify, Pulse, P&L Disclosure, Stand): the drawer's receipt search omits `agentsInvoked` filtering for stages whose canonical logic explicitly avoids a receipt scan *because* the relevant receipts are tagged to `aigent-z`/the operator, not the subject agent — or, for Stand, because the canonical projection filters superseded receipts the raw scan doesn't. **Fix shape:** same as above — consume the canonical `receiptRefs`, which already got this scoping/filtering right once.

3. **A second live observer of the same predicate** (`AgreementRatifyPanel`'s hand-duplicated status-rank check and its own `/verify/status` poll; `PulseTransparencyToggle`'s Pulse/P&L-Disclosure booleans sourced from its own Agent Card fetch): these components never receive the canonical booleans as props at all. **Fix shape:** extend `resolveSurfaceProps` (`PilotJourneyTab.tsx`) to thread `pulseAuthorizationVerified`/`pnlTransparencyEnabled`/the agreement status rank into these components' props, the same way `pnlServiceRegistered`/`pnlServiceVerified` already are — those two are the coherent worked example within the same component.

4. **A duplicate-but-currently-harmless query** (Claim's `MarketaEligibilityView`, Ingest's `IngestIntoFactoryPanel`): same predicate, same scope, independently queried rather than via a shared resolver function. Not a correctness bug today, but not the doctrine's target shape either (compare to Orient's `resolveOrientationCompletion`, which *is* a shared function). Lower priority than 1-3.

---

## What this means for the next phase (not yet built)

Per the operator's own sequencing ("Then fix the generic observer/rendering seams, not the individual displayed strings"), the concrete next increment is:

- Extend the state route's per-stage result (already close: `resolution.stages[]` carries `canonicalOutcome`/`canonicalAuthority`/`evidencePresent`/`evidenceMissing`/`receiptRefs`) down to the **sub-predicate** level for Ratify's five facts (`agreementAuthorized`, `pulseAuthorized`, `pnlDisclosureAuthorized`, `pnlServiceRegistered`, `pnlEvidenceVerified`) — currently these live only as booleans inside `stages.verify`'s completion-evidence object, with no individual authority/effectiveAt/evidenceRefs of their own.
- Rewire `StageReceiptsDrawer` to consume `receiptRefs`/`evidencePresent` as primary, per finding 1-2 above.
- Thread the missing canonical booleans into `AgreementRatifyPanel` and `PulseTransparencyToggle` per finding 3.
- Add the 7 generic coherence canaries from the operator's spec.

This document is the input to that design, not the design itself.
