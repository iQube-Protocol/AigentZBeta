# CRP-003a — Constitutional Financial Services Programme (CFSP): the implementation spine

**Constitutional Research Program · Implementation Programme Spec · v0.1 · Status: DRAFT — awaiting operator ratification (2026-07-17).**
Charter: **CRP-003** (Financial Services: the First Constitutional Capability Domain, CHARTERED 2026-07-15). This document is the *implementation programme* for that charter — the "how/what-to-build," reconciled against the actual codebase. CRP-003 is the "why + candidate invariants"; CRP-003a is the buildable spine.
Source: operator-supplied **PRD v1.0 "Constitutional Financial Services Programme (CFSP)"** (MetaProof Internal, 2026-07-17), authored by Aletheon.
Institution: **metaMe IRL** (CFS-019). Companion: **CFS-031** (the Constitutional Cybernetic Loop — CFSP is its first production instance), **CFS-018** ("primitives invariant, providers replaceable"), **IRL-010A §3.6** (the honest commerce-infrastructure scoring this spec inherits).

> **Numbering note (ratification decision #1).** Filed as **CRP-003a** — the implementation appendix to the CRP-003 charter, mirroring the CFS-022 → CFS-022a/022b precedent (a chartered programme + its implementation designs) and CRP-003 §0's own framing of Financial Services as "a product/research dual spine." The alternative is a standalone **CFS-037**. The operator should confirm; a rename is cheap now, expensive later.

---

## 0. What this spec is — and the discipline that governs it

The PRD was authored by an agent (Aletheon) reasoning largely from the constitutional docs, and — the operator's own words, 2026-07-17 — **"its context is drifting on what's in place versus new, so the code is truth here."** This spec therefore opens with a **code-truth reconciliation** (§1), produced by a four-agent read-only inventory of the actual repository (2026-07-16/17), and every downstream section builds on that reconciliation rather than on the PRD's assertions.

Two governing mandates, both from the PRD itself (§3.1, §16) and both already law in this codebase (CLAUDE.md "extend, don't duplicate"; CRP-001's interface rule):

1. **Consume canonical primitives; redesign nothing.** Passport, Standing, Bounded Delegation, Founder Office, pricing, subscription tiers are canonical. The programme composes them.
2. **Providers are adapters; primitives are invariant** (CFS-018). Horizen (registry), x409/Consenti (agreement acceptance), AutoDrive/Walrus (storage), USDC/QriptoCENT (settlement) are all replaceable implementations behind a stable primitive.

**No invariant is seeded by this spec.** CRP-003's candidate invariants (F-001–F-203, CFI-001, CFI-002) remain unseeded vocabulary; a future seed-and-ratify pass renumbers them into `inv.finance.<n>` (CRP-003 §9). This spec is docs-first and ratify-before-build: it is the ratification gate, not a build record.

---

## 1. Code-truth reconciliation — what is IN PLACE vs GENUINELY NEW

Verdicts and anchors from the 2026-07-16/17 inventory. This table is the spec's spine — it replaces the PRD's in-place-vs-new framing with the code's.

### 1.1 IMPLEMENTED — reuse as-is (the ~85% the PRD treats as "to build")

| Primitive (PRD dependency) | Verdict | Canonical seam (reuse this) |
|---|---|---|
| Sovereign Identity / Polity Passport | **Implemented** | `services/identity/getActivePersona.ts` (spine); `services/passport/bureauIdentityService.ts` (anonymous citizen); `services/passport/personhoodProof.ts` (World ID) |
| Wallet (USDC→Q¢ credit) | **Implemented** | `app/api/wallet/base-qc/credit-from-usdc/route.ts` (1 USDC = 100 Q¢), `SmartWalletDrawer` |
| **USDC commercial settlement (Base)** | **Implemented** | `services/billing/planCheckout.ts` §"USDC settlement (Base mainnet)" — `UsdcPaymentIntent` (Base `8453` `BASE_USDC`, treasury `payTo`, 6-decimal micro-units), on-chain transfer verified via the facilitator path; `usdc` is a live `CheckoutRail` |
| Standing (accrual + score + bands) | **Implemented** | `services/crm/standingAccrualService.ts` (`accrueStanding` keystone, lanes personal/delegated/stewardship/capability); `services/standing/standingScore.ts`; L1–L5 bands in `services/homecoming/delegateStanding.ts` |
| Bounded Delegation | **Implemented** | `app/api/codex/chat/agentiq-os/delegation/route.ts` (grant envelope: allowed/forbidden actions, surfaces, TTL, max_actions, dual gate L3+); `services/identity/personaAssignmentStore.ts`; homecoming stand-up |
| Subscription tiers + pricing | **Implemented** | `services/billing/personaPlan.ts` (`venture_tier none/lite/pro/elite`, `research_tier`); `services/billing/planCheckout.ts` (priced SKUs); `services/activations/activationPlanGate.ts` (`ACTIVATION_PLAN_GATE`) |
| Agent / capability registry + discovery | **Implemented** | `services/constitutional/capabilityRegistry.ts` (ConstitutionalObject kind `capability`); `services/capability/capabilityGraph.ts` (`recommendProducers`); `services/constitutional/modelQube.ts` |
| Settlement rails | **Implemented** | Q¢/QCT + x402 + **Base USDC**: `services/x402/*`, `app/api/a2a/facilitator/pay-intent/route.ts`, `app/api/community-content/settle/route.ts`, `planCheckout.ts` (USDC) |
| Constitutional Memory (receipts + evidence) | **Implemented** | `services/receipts/activityReceiptService.ts` (~60 action types, DVN-anchored); `services/dvn/activityReceiptDvnPipeline.ts` (`ANCHORABLE_ACTION_TYPES`); `services/constitutional/capabilityEvidence.ts`; `services/artifact/artifactRecordStore.ts` (cited invariants) |
| Invariant learning (grounding + reach) | **Implemented** | `services/invariants/grounding.ts` (`citeInvariants`, `buildInvariantSlice`); `services/invariants/engine.ts` (CFS-035) |

### 1.2 GENUINELY NEW — greenfield (the true deliverables)

| # | Primitive | Verdict | Why it's the deliverable |
|---|---|---|---|
| **N1** | **Constitutional Agreement Object + formation/acceptance/authorization gate** (CFI-002 · WS2 · lifecycle step 3) | **Absent** | The single missing link binding {requesting operator · requested capability · selected agent · delegated authority · constraints · verification requirements · settlement terms} into one attributable, machine-readable record *before* delegated execution. Every `x409`/`ConstitutionalAgreement` hit is docs-only. **This is the keystone.** |
| **N2** | **Transaction Reconstitution** (WS6, CRP-003 §7.3) | **Absent** | No engine replays a receipt trail into {intent + agreement + authority + agent + outputs + verification + settlement + standing}. Becomes tractable only once N1 rides the receipt (the agreement is the missing anchor field). |

### 1.3 PARTIAL — extend a shipped primitive (do not rebuild)

| # | Item | Verdict | The FS extension |
|---|---|---|---|
| P1 | Founder Office "Capability Suite" host | **Partial** | Founder Office exists as a venture-formation tab (`FounderOfficeTab.tsx`) with a tier-gated preview; "Capability Suite" is doc-only. FS suite = a **tab-group + `activationId`** in `data/codex-configs.ts` + one `ACTIVATION_PLAN_GATE` entry. No new tiering. |
| P2 | 3-experience delivery (Preview / FO / Advanced) | **Partial** | Compose the existing `FounderOfficePreviewBanner` + `PlanUpgradeModal` + tier-graduated `wizardAccess`-style flags. No new gating machinery. |
| P3 | Delegation spend cap | **Partial** | The envelope has no **enforced monetary cap** (`spend_autonomy` is a coarse string, not an amount). Money-moving domains (1/2) need `PolicyEnvelope` extended with an enforced per-agreement value ceiling **before** any fund movement. |
| P4 | FS standing accrual source | **Partial** | `accrueStanding` is the keystone but no FS-specific `standingType`/action-type is wired to a call site; the two band scales (0–100 delegate vs 0–1 capability) are unreconciled. |
| P5 | "Constitutional service fee" (fee-split) | **Partial** | Settlement rails are live (Q¢/QCT + **Base USDC**, §1.1). The remaining gap is narrow: no **fee-split / "constitutional service fee"** logic (a constitutional cut on a settled transaction) exists in code — that concept is charter-only. |
| P6 | Constitutional Evidence Store (AutoDrive/Walrus) | **Partial** | AutoDrive is used only as content-CID storage; there is **no evidence-store abstraction** unifying CIDs with the Supabase receipt/evidence hashes, and **no Walrus**. |
| P7 | Policy Validation | **Partial** | `services/access/evaluateAccess.ts` is a Phase-1.3 content-access gate (no DVN/canister yet); `PolicyEnvelope` is built at the delegation route. FS policy hooks compose these. |

**Bottom line:** the constitutional service loop is substantially built and receipt-anchored. **N1 (Constitutional Agreement) is the one load-bearing hole.** Close it, and the canonical service pattern runs end-to-end; everything else is composition (§1.1), thin extension (§1.3), or a later greenfield (N2) that N1 unblocks.

---

## 2. The keystone — the Constitutional Agreement Object (N1)

### 2.1 Primitive vs provider (the x409 split, verified against the repo)

x409 / the **Consenti Agreement Protocol** (`github.com/consenti-ai/agreement-protocol`) is *"terms before transactions"* — a cryptographically verifiable **acceptance** record, gated by an HTTP **409** (an agent acting without prior acceptance gets 409; it carries `X-Agreement-Id` thereafter). Its record fields: `timestamp`, `acceptor_type` (human/agent), `acceptor`, `terms` (title, version), `acceptance_endpoint`, `status`, a commitment hash, and an anchor-chain reference. It exposes `@consenti-ai/verifier` (`verify`, `computeAgreementHash`, `canonicalize`) and discovery via `/.well-known/agreements.json`. It is **not** a payment protocol and **not** x402.

The critical read: **x409 is narrower than our Constitutional Agreement Object.** It supplies the **acceptance-proof + anchoring** half. The platform owns the **agreement content** — capability, delegated authority, constraints, verification requirements, settlement terms. That is a textbook CFS-018 split:

- **Invariant (platform-owned):** the **Constitutional Agreement Object** — the content model + lifecycle.
- **Provider (replaceable):** the **acceptance/anchor** mechanism — x409/Consenti first; the platform's own DVN anchor is a candidate second (see §2.4).

### 2.2 The Object — compose, don't invent (per the inventory's cheapest path)

Model the Constitutional Agreement as a `ConstitutionalObject` (mirror `services/constitutional/capabilityRegistry.ts`'s `buildCapabilityObject`), so it inherits standing/authority/provenance/lifecycle and T2-safety by construction. It **references** existing seams rather than duplicating them:

```
ConstitutionalAgreement (a ConstitutionalObject, kind: 'agreement')
  requestingPersonaRef   // T2-safe hashPersonaRef of the operator (never raw personaId)
  capabilityRef          // a capability_registry id (Discovery, step 2)
  selectedAgentRef       // a producer from recommendProducers / a delegate id
  delegatedAuthority     // the PolicyEnvelope shape (step 5/6) — bands, allowed/forbidden actions, TTL, max_actions
  constraints            // incl. an ENFORCED value ceiling when settlement terms are present (P3)
  verificationRequirements  // what "verified" means for this agreement (step 8); KYC-if-required hook
  settlementTerms?       // optional x402 payParams / Q¢ / (future) USDC terms (step 9)
  acceptance             // provider-produced: acceptor, timestamp, commitment hash, anchor ref (x409)
  status                 // proposed → accepted → authorized → executed → settled → reconstitutable
```

### 2.3 The 409 gate — idiomatic to both x409 and this codebase

Delegated execution **refuses without an accepted, authorized agreement**, returning HTTP **409** with the remediation (form/accept an agreement). This is not a new pattern here: `recordOperationalValidation` already 409s when a capability is unregistered, and the merge gate 409s on unmet validation. The Agreement gate is the same idiom, now guarding execution. On success the agreement id rides every downstream receipt (`X-Agreement-Id` ≈ the receipt's `policyEnvelopeId` sibling).

### 2.4 Receipt + anchor (the one permitted unilateral change)

Agreement formation and authorization emit new action types — `agreement_formed`, `agreement_authorized` — via the unified `createActivityReceipt` writer, added to `ANCHORABLE_ACTION_TYPES` (adding a type is the *only* permitted unilateral change to the DVN pipeline; CLAUDE.md). **Open decision:** whether the agreement's tamper-proof anchor is x409/Consenti's (Pangea/ETH/BTC), the platform's existing DVN pipeline, or both. Recommendation: DVN as the constitutional anchor of record (it already carries our receipts), x409 as the acceptance-proof provider — but this touches the PARAMOUNT-protected DVN pipeline, so it is **operator-gated, not unilateral** (ratification decision #3).

---

## 3. The canonical constitutional service pattern as a code seam

PRD §10's 12-step lifecycle becomes a real composable pipeline — "the canonical Founder Office execution model" — **shadow/observe-first** (CFS-017), never a rebuild of the steps it composes:

| # | Step | Seam today | Status |
|---|---|---|---|
| 1 | Intent | `app/api/assistant/intent/route.ts` + `GroundingContext` | Partial |
| 2 | Discovery | `capabilityGraph.recommendProducers`; `registeredCapabilityBlock` | **Reuse** |
| 3 | **Constitutional Agreement** | **N1 — new** | **Build** |
| 4 | Standing Validation | `delegateStandingAllowsBand`, enforced at delegation | **Reuse** |
| 5 | Policy Validation | `evaluateAccess` + `PolicyEnvelope` | Partial (P7) |
| 6 | Bounded Delegation | delegation grant route + `delegationGrantStore` | **Reuse** |
| 7 | Execution | `delegateProduce` / produce route (D1: execution stays human/dormant) | Partial |
| 8 | Verification | `validation-record`, `chrysalis-test`, consequence gate | Partial |
| 9 | Settlement | x402 rail (bind to the agreement's settlementTerms) | **Reuse** (rail) |
| 10 | Evidence | `createActivityReceipt` + DVN anchor | **Reuse** |
| 11 | Standing Accrual | `recordOperationalValidation`, `accrueStanding` | **Reuse** (add FS source, P4) |
| 12 | Invariant Learning | `citeInvariants` + reach | **Reuse** |

The pipeline **observes** first (runs alongside, receipts the trace) and is flipped to authoritative per CFS-017/CFS-035 discipline once evidence supports it.

---

## 4. Workstream reconciliation — PRD (7) → CRP-003 §7.2 (6)

The PRD's seven workstreams are CRP-003's six plus the research/commercial split. No new doctrine; a mapping.

| PRD workstream | CRP-003 §7.2 | Code status (from §1) |
|---|---|---|
| 1 · Constitutional Identity | WS1 Sovereign Identity | Implemented — reuse |
| 2 · Constitutional Agent Registry | WS3 Agent Discovery & Orchestration | Implemented — reuse (`capabilityGraph`, registry) |
| 3 · Financial Services Capability Suite (5 domains) | Domains 1–5 (§2–6) | **New surface (P1/P2)** over reused primitives; domain *logic* unbuilt |
| 4 · Constitutional Computing (Agreement) | WS2 Constitutional Agreement | **N1 — the keystone build** |
| 5 · Invariant Intelligence | (research half of the CCD) | Research — existing IRL pipeline; unseeded candidates |
| 6 · Invariant Field Experiments | §7.4 field-theory measurements | Research — no operationalized metric yet (CRP-003 §9) |
| 7 · Founder Office Growth | the Commercial output of the CCD | Reuse tiers/activation; commercial, not a build |

## 5. Capability Domains + the Suite surface

The five domains (Investment Operations · Market Operations · Financial Intelligence · Constitutional Financial Integrity · Constitutional Commerce) are CRP-003 §2–6 verbatim. The **Suite surface** is a tab-group in a cartridge config with an `activationId: 'financial-services'`, gated by one `ACTIVATION_PLAN_GATE` entry, delivering the three experiences by composition (P1/P2):

- **Constitutional Preview** — existing preview-banner pattern; read-only demand-gen (no fund movement, no agreement required).
- **Founder Office Experience** — full capability at the existing FO tier.
- **Advanced Founder Office** — higher existing tier via `PlanUpgradeModal`; multi-agent orchestration.

**Consequence ordering (a safety rule this spec adds):** deliver **Domain 3 (Financial Intelligence)** first — it is read/intelligence, no fund movement, no enforced-spend-cap dependency (P3). Domains 1/2 (money movement) wait on P3 (enforced monetary ceiling in `PolicyEnvelope`) and P5 (USDC settlement) landing first. This is the CFS-025 consequence-tier discipline applied to the domain sequence.

## 6. Provider-adapter registry (CFS-018)

| Primitive (invariant) | Provider(s) — replaceable | Status |
|---|---|---|
| Agent registry / discovery | Horizen Pulse (pilot) · native `capabilityGraph` | Native built; Horizen = external adapter, unbuilt |
| **Constitutional Agreement acceptance/anchor** | **x409 / Consenti** (first) · DVN anchor (candidate) | Adapter — N1 |
| Settlement | Q¢/QCT + x402 + **Base USDC** (all live) · future rails | Live; a per-agreement settlement-terms binding + fee-split (P5) is the only extension |
| Evidence store | Supabase receipts+hashes (live) · AutoDrive (content CIDs) · Walrus (absent) | Live; unified store abstraction unbuilt (P6) |

Build the **adapter seam** for N1 first, with x409 as one adapter and a local/stub adapter behind the same interface — so the Object ships and is testable without blocking on external-protocol maturity.

## 7. Phased build sequence (ratify-before-build per increment; shadow-first)

- **Increment 1 — the keystone (N1).** `services/constitutional/agreement*` producing the Constitutional Agreement Object (compose capability_registry id + delegate standing + PolicyEnvelope + optional x402 terms); the 409 execution gate; `agreement_formed`/`agreement_authorized` receipts (anchorable); the acceptance/anchor **adapter interface** with an x409 adapter + a local adapter. No fund movement. Closes lifecycle step 3.
- **Increment 2 — the canonical pipeline, shadow, on Domain 3.** Wire the 12-step pattern as a composed, observe-first pipeline on ONE read-only Financial Intelligence preview capability — a full constitutional loop with zero money at risk. Receipts the trace; no flip yet.
- **Increment 3 — the Suite surface + 3 experiences.** Tab-group + `activationId` + `ACTIVATION_PLAN_GATE` + preview banner (P1/P2), reusing tiers. Domain 3 goes live behind the FO tier.
- **Later (each its own ratification):** Transaction Reconstitution (N2, replay over agreement-anchored receipts); enforced spend-cap `PolicyEnvelope` extension (P3, gates Domains 1/2); bind settlement terms (Q¢/USDC, all live) onto the agreement + fee-split "constitutional service fee" (P5); Constitutional Evidence Store abstraction (P6); FS invariant seeding `inv.finance.*` + the field-theory experiment runs (research half).

## 8. Ratification decisions (operator)

1. **Numbering** — CRP-003a (this filing) vs standalone CFS-037. **RATIFIED 2026-07-17: CRP-003a.**
2. **First increment** — N1 (Constitutional Agreement keystone) on Domain 3 (read-only), before any money-moving domain. **RATIFIED 2026-07-17: confirmed.**
3. **Agreement anchor** — **RATIFIED 2026-07-17: DVN is the constitutional anchor of record; x409/Consenti is the acceptance-proof provider, behind a swappable adapter interface so other acceptance-proof providers are interchangeable (stub/local provider ships alongside x409).**

## 9. Honest limits

- **Nothing in this spec is built.** It is the ratification gate. The four-agent inventory (§1) is code-witnessed; the build sequence (§7) is proposed, not shipped.
- **N1 is genuinely greenfield.** The Constitutional Agreement Object, its schema, the 409 gate, and any x409 integration do not exist in the codebase today.
- **The domain *logic* of all five domains is unbuilt** — §1 reuse covers the *primitives*, not investment/market/intelligence capability code.
- **The PRD's provider assumptions outrun the code** where the code says so: Walrus, the Constitutional Evidence Store abstraction (P6), Horizen integration, the fee-split "constitutional service fee" (P5), and Transaction Reconstitution (N2) are named-not-built. (USDC on Base **is** coded — an earlier draft of this spec understated it; corrected 2026-07-17 on operator direction.)
- **Field-theory measurements have no operationalized metric** (CRP-003 §9, inherited).
- **Whether the KNYT-campaign "Horizen" and the pilot's "Horizen Pulse" are the same org is unverified** (CRP-003 §7 correction, inherited — confirm with the operator before treating them as identical).
- **This spec does not seed any invariant** and does not sequence or gate any Chrysalis 2.0 deliverable (CRP-001 interface rule).

## Ratification record

- [x] **DRAFT 2026-07-17** — implementation spine authored from the operator's PRD v1.0, reconciled against a code-truth inventory (operator: "the code is truth here").
- [x] **§8 decisions 1–3 RATIFIED 2026-07-17 by operator direction:** (1) CRP-003a numbering; (2) N1 first, on Domain 3; (3) DVN anchor of record + x409 acceptance-proof provider behind a swappable adapter interface. Build of Increment 1 (N1) authorized.
- [x] **Increments 1–3 BUILT 2026-07-17** (operator ran migration 20260719000000; authorized 2b/3 sequencing, chose Increment 3). N1 = the Constitutional Agreement primitive + 409 gate + swappable acceptance providers. N2 = the canonical 12-step service pattern as a shadow pipeline on Domain 3. N3 = the Financial Services Capability Suite surface (a tab in the Founder Office cartridge driving the live N1/N2 routes). Follow-ons: Increment 2b (live executor + live-wire observed steps), Increment 3b (commercial tier-gating on the three experiences). See `agentiq/updates/2026-07-17_crp-003a-n1/n2/n3-*.md`.
