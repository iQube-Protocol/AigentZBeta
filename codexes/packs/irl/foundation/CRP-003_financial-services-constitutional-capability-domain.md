# CRP-003 — Financial Services: the First Constitutional Capability Domain

**Constitutional Research Program · Programme Charter · v1 · Status: CHARTERED 2026-07-15 (operator ratification).**
Umbrella: **CRP-001** (Constitutional Research Program) — the second programme formally chartered under it (after CRP-002, Invariant Intelligence Compression).
Institution: **metaMe IRL** (CFS-019). Companion to: **CFS-031** (the Constitutional Cybernetic Loop — this charter is the FIRST worked instance of §4/§5's macro loop, scoped to one domain), **CFS-015/023** (Founder Office, named but deferred), **IRL-010A** (§3.6 already scores today's commerce infrastructure honestly — see §5 below).

> This charter is written to double as a product/research dual spine (the CRP-002 pattern): its domains are fundable research programmes AND named Founder Office capabilities. Nothing here blocks, gates, or sequences a Chrysalis deliverable — per CRP-001's interface rule, it feeds the platform, it is not part of it. **No invariant in this charter is seeded into the crystal.** Every "Invariant F-nnn" / "Invariant CFI-nnn" below is a CANDIDATE, proposed vocabulary awaiting its own future seed-and-ratify ceremony (the CFS-031 §6 discipline, applied here) — and, when that ceremony happens, each candidate must be RENUMBERED into the crystal's own `inv.<namespace>.<n>` scheme (e.g. `inv.finance.1xx`), never kept as a parallel "F-nnn" numbering system.

## 0. The reframe this charter makes

> "Where does constitutional trust create the greatest incremental value? If we choose domains where success depends primarily on prediction or market timing, we're competing with thousands of existing agents. If we choose domains where success depends on trust, delegation, verification, and coordination, we're playing to the strengths of the platform." — Alethean, 2026-07-15

This charter deliberately does NOT propose "the three biggest financial categories." It proposes three domains chosen because each maps to ONE constitutional primitive this platform already has more of than any competitor: Bounded Delegation, Standing, and Evidence. A fourth, cross-cutting domain studies the constitutional properties of financial agents themselves; a fifth applies the resulting integrity principles to real-world economic exchange (repositioning, not replacing, the platform's existing commerce infrastructure — see §5).

## 1. Constitutional Capability Domain — a new formal category (companion amendment, CFS-019)

This charter introduces a naming convention worth formalizing once, here, for reuse: a **Constitutional Capability Domain** is an IRL-catalogued area of work with three SIMULTANEOUS outputs — Scientific (candidate invariants + experimental evidence), Platform (reusable constitutional primitives implemented in code), and Commercial (a Founder Office capability or service). Financial Services is the first named instance. The category itself (not this charter's specific content) is cross-referenced into CFS-019 as a formal IRL organizing unit, alongside CRP (research programme) and CFS (ratified specification) — a Domain is neither; it is the thing that PRODUCES candidates for both.

## 2. Domain 1 — Investment Operations

*(Generalized 2026-07-15 from "Treasury & Portfolio Operations" — same constitutional focus and candidate invariants, renamed so the domain reads as capability-generic rather than crypto-treasury-specific. Original name retained here for traceability.)*

**Constitutional focus: Bounded Delegation.** Not "pick the best trade" — "operate an investment or treasury function safely." Scope: portfolio management, asset allocation, treasury, liquidity, yield, capital deployment. Typical tasks: multi-chain portfolio visibility, treasury allocation recommendations, rebalancing, yield strategy comparison, stablecoin management, liquidity monitoring, risk exposure summaries. Fits because every technical founder eventually has a treasury; the work is operational, repeatable, and requires coordination between multiple specialized agents — exactly the shape Bounded Delegation already governs (CFS-023 sovereignty layer 3).

**Candidate invariants** (proposed, unseeded):
- **F-001 — Verifiable State Before Action.** No portfolio action should be delegated until the current portfolio state has been independently verified.
- **F-002 — Explainable Allocation.** Every recommended allocation must include an auditable rationale and confidence signal.
- **F-003 — Delegation Boundaries.** Agents may recommend allocation changes but cannot execute beyond delegated authority.

## 3. Domain 2 — Market Operations

*(Generalized 2026-07-15 from "Trading & Execution Orchestration" — same constitutional focus and candidate invariants, renamed so the domain reads as capability-generic rather than crypto-trading-specific. Original name retained here for traceability.)*

**Constitutional focus: Standing & Accountability.** Deliberately narrowed: not a better trading bot — the constitutional orchestration layer AROUND market-facing agents. Scope: trading, execution, market making, arbitrage, rebalancing, order routing. Aigent Z becomes the constitutional portfolio manager; specialist agents (arbitrage, market-making, sentiment, execution, risk) are the specialists Aigent Z selects among, under explicit authority, with results independently verified before Standing updates.

**Candidate invariants** (proposed, unseeded):
- **F-101 — Separation of Advice and Execution.** Recommendation and execution remain independently attributable.
- **F-102 — Standing-Weighted Agent Selection.** Agent selection considers demonstrated standing, not historical popularity alone.
- **F-103 — Verification Before Standing.** Financial outcomes contribute to standing only after independently verifiable execution.

## 4. Domain 3 — Financial Intelligence

**Constitutional focus: Evidence & Verification.** The underserved domain: not trading questions but intelligence questions technical founders spend enormous time answering. Scope: research, protocol analysis, risk analysis, governance, opportunity discovery — which protocol to integrate, which token to accept, what regulations apply, which grants are available, which chains are active, which investors fit their stage. Agent ecosystem: research, protocol, governance, grant, and regulatory agents.

**Candidate invariants** (proposed, unseeded):
- **F-201 — Source Diversity.** High-impact recommendations should incorporate multiple independent evidence sources.
- **F-202 — Evidence Attribution.** Every recommendation should preserve traceability to supporting evidence.
- **F-203 — Confidence Calibration.** Confidence should reflect evidence quality, not model certainty.

## 5. Domain 4 — Constitutional Financial Integrity (the cross-cutting programme)

*(Scope, added 2026-07-15: standing, verification, delegation, settlement integrity, attribution — the properties that must hold across Domains 1–3, not a sixth capability area.)*

Not "Constitutional Financial Agents" (an earlier working title, superseded same-day) — **Constitutional Financial Integrity**, because the focus is how constitutional trust is maintained THROUGH financial interactions, not what agents do within them. This is the programme that studies the constitutional properties of Domains 1–3 themselves.

**The governing principle, refined in dialogue (2026-07-15):**

> Not: "every action should be paid for." But: **every constitutional action should be constitutionally self-sustaining** — carrying, or explicitly referencing, the authority, resources, verification, and settlement required to complete itself, without creating hidden obligations for unrelated participants.

**Candidate invariants** (proposed, unseeded):
- **CFI-001 — Constitutional Self-Sufficiency.** Every constitutional transaction should contain, or explicitly reference, the authority, resources, verification, and settlement required to complete itself without creating hidden obligations for unrelated participants. Micro-settlement, x402, x409, USDC, and traditional banking rails are all candidate IMPLEMENTATIONS of this invariant — the invariant is independent of the settlement rail (see §6).
- **CFI-002 — Constitutional Agreement Required (added 2026-07-16, Alethean's refinement of the missing primitive).** There must be an explicit, attributable agreement before delegated execution: a machine-readable record binding requesting operator, requested capability, selected agent, delegated authority, constraints, verification requirements, and settlement terms (if any). This is CFI-001's authority/verification/settlement clauses given a single carrying artifact — the **Constitutional Agreement** (§7 Workstream 2) — rather than three separately-referenced properties. `x409` is the pilot's first candidate PROVIDER for this primitive (a negotiation/authorization protocol); the invariant is independent of which negotiation protocol implements it, exactly as CFI-001 is independent of the settlement rail — see the "primitives are invariant, providers are replaceable" rule (CFS-018 amendment, 2026-07-15).

**Research questions** (constitutional, not implementation-shaped):
- **CFI-Q1** — How can every delegated financial action remain constitutionally attributable?
- **CFI-Q2** — Can every financial interaction become economically self-sustaining without introducing central coordination?
- **CFI-Q3** — Does embedding settlement into delegation increase accountability?
- **CFI-Q4** — Can financial integrity become an emergent property of constitutional architecture rather than external regulation? (Named as the most open and interesting of the four — no answer proposed here.)

## 6. Domain 5 — Constitutional Commerce, repositioned

*(Scope, added 2026-07-15: micropayments, settlement, revenue distribution, incentive alignment, vendor-neutral execution.)*

**What already exists (verified against the codebase, not asserted):** IRL-010A §3.6 already scores this honestly — Q¢ pricing rails, cart/multi-rail payments, and KNYT commerce are **Implemented (early)**; *constitutional* commerce (standing-mediated exchange) is **Proposed**, flagged ⚑. `agentiq-os`'s protocol docs already name x402 as the ecosystem's declared value-exchange standard (payment intent in HTTP headers, settlement logged as a DVN receipt, linked to a persona FIO handle) — infrastructure exists; this charter does not duplicate it.

**What this domain changes is the FRAME, not the infrastructure:**

> Instead of "Constitutional Commerce is a payment protocol" — **Constitutional Commerce is the constitutional integrity layer for economic interactions.** Settlement becomes an implementation detail; integrity (bounded authority, attributable settlement, explicit costs, aligned incentives) is the primitive.

This reframe is why Domain 4 (the invariant layer) and Domain 5 (the operationalization across settlement rails) are named as TWO domains, not merged: Domain 4 asks *what invariant laws govern trustworthy financial interactions?*; Domain 5 asks *how do we operationalize those laws across heterogeneous payment/settlement systems?* — the same Research → Platform → Commerce pattern this charter's §1 names generally. The practical benefit: a settlement adapter (Q¢, x402, a future rail) becomes replaceable without touching the constitutional integrity layer above it.

**The Blocksee outcome (operator-attested, 2026-07-16 — outside code-witness scope, same status as IRL-010A row 3.8):** an earlier plan to launch a conditional-commerce pilot with a consortium of vendors, which fell through. The direct consequence for this charter: the programme deliberately commits to delivering Constitutional Commerce in a **vendor-neutral** manner — no single vendor or consortium is a dependency of the constitutional integrity layer itself, which is exactly the architectural separation §6 argues for (settlement adapter replaceable; integrity layer invariant). Blocksee is recorded here as the historical reason the vendor-neutral commitment exists, not as a technical or code fact this document independently verifies.

```
Intent → Standing → Delegation → Verification → Constitutional Integrity → Settlement Adapter
```

## 7. The Horizen pilot — the Constitutional Agent Execution Pilot

**⚠ Correction to the prior "zero prior footprint" claim (2026-07-16):** "Horizen" as a NAME is not new to this codebase — it appears as item #14 of the KNYT campaign's Wave-1 partner list (`KNYT_PARTNER_AND_INVESTOR_ACTIVATION_ADDENDUM.md`, `KNYT_CAMPAIGN_OPERATIONS.md`, `KNYT_CAMPAIGN_ACTIVATION_BLUEPRINT.md`) — a real crypto-ecosystem partner already in the marketing/activation pipeline, unrelated in origin to this charter's research use of the name. **Whether the KNYT campaign's "Horizen" and this pilot's intended agent-registry partner ("Horizen Pulse") are the same organization is NOT verified by this document** — it is recorded here as an open question, not resolved either way, because conflating or silently separating them without confirmation would be exactly the kind of unverified claim CLAUDE.md's no-guessing rule forbids. What remains true regardless: **no technical or code integration with any Horizen entity exists in this codebase.** The prior claim should be read as "no technical footprint," not "no footprint at all."

*(Renamed and re-scoped 2026-07-15/16 per Alethean's stack decomposition: from "Standing & Trusted Agents" to the **Constitutional Agent Execution Pilot**, structured as six workstreams rather than three research questions. The Invariant Field Theory framing (below) is preserved, not replaced — the six workstreams are WHAT the pilot builds and runs; field theory is HOW its results are measured.)*

### 7.1 The stack, decomposed by primitive rather than vendor

Alethean's assessment (2026-07-15): decomposing Constitutional Commerce into primitives rather than vendors shows the platform already holds most of the stack. Settlement is native (USDC for commercial settlement, QriptoCENT/Q¢ for constitutional service fees — both already wallet- and identity-integrated, no new lift). Identity, Standing, Bounded Delegation, Verification, and Agent Orchestration are all core platform capabilities, already built. **The one primitive genuinely missing is Agreement** — an explicit, attributable, machine-readable record binding intent to delegated authority before execution (CFI-002, §5, added 2026-07-16). Everything else in the loop below — Founder Intent → Agent Discovery (Horizen) → Standing Filter → Agreement → Bounded Delegation → Execution → Verification → Standing Update — already exists or is already being built; only "Agreement" does not.

**The Agreement primitive is provider-agnostic by design**, per the "primitives are invariant, providers are replaceable" rule (CFS-018 amendment, 2026-07-15): `x409` is the pilot's first candidate implementation, but the platform commitment is to a **Constitutional Agreement Object** (requesting operator, requested capability, selected agent, delegated authority, constraints, verification requirements, settlement terms), not to `x409` itself. A future implementation may be a signed JSON agreement, a different negotiation standard, or eventually a smart contract, without touching the invariant (CFI-002).

**KYC is positioned as a verification SERVICE, not part of identity** — invoked only when a specific agreement's policy requires it (`Agreement → Policy Requirements → KYC (if required) → Delegation`), keeping Polity Passport privacy-preserving by default and compliance a discrete, consent-gated, per-transaction step rather than a blanket identity requirement.

### 7.2 Six workstreams

| # | Workstream | Constitutional focus | Status |
|---|---|---|---|
| 1 | **Sovereign Identity** | Polity Passport, Standing bootstrap, identity continuity | Platform-native, already built |
| 2 | **Constitutional Agreement** | Provider-agnostic agreement service (CFI-002); `x409` as first candidate provider; research questions: agreement formation, authority negotiation, delegation contracts, policy constraints | Missing primitive — the pilot's core deliverable |
| 3 | **Agent Discovery & Orchestration** | Agent discovery, capability qualification, standing-aware routing (Horizen Pulse candidate registry); Aigent Z orchestration | Pilot partner + platform-native orchestration |
| 4 | **Constitutional Execution** | Intent → Agreement → Delegation → Execution → Verification → Standing, the loop §7.1 traces | Composes Workstreams 1–3, no new mechanism |
| 5 | **Constitutional Commerce** | Vendor-neutral settlement adapters (USDC for commercial settlement, QriptoCENT for constitutional service fees, future rails); governs authorization/attribution/settlement/integrity, not payment rails (§6) | Settlement adapters already native |
| 6 | **Constitutional Memory** | Transaction receipts, execution receipts, receipt hashing, Transaction Reconstitution (§7.3), Constitutional Evidence Store (AutoDrive as one implementation), audit trail, provenance, Standing evidence | Carries forward the full scope of the previous (pre-CRP-003) proposal — not dropped |

### 7.3 Constitutional Memory — Transaction Reconstitution, distinct from Reconstitution

**A distinction worth making precisely** (the IRL's own "discipline of distinctions," CFS-019): CFS-031 §3 already ratifies **Reconstitution** as a system-level property — the convergence half of constitutional evolution, where code diverges from the constitution to answer a new consequence, then reconverges when evidence ratifies a principle. This workstream introduces a narrower, complementary property at the level of a SINGLE transaction:

- **Transaction Reconstitution** (new, this amendment): a constitutional receipt is not merely a blockchain receipt — from the receipt trail ALONE it must be possible to reconstruct the original intent, the Constitutional Agreement, the delegated authority, the executing agent, the outputs, the verification, the settlement, and the standing impact of one completed transaction. This is a REPLAY/AUDIT property of the Constitutional Memory workstream, not a claim about the platform's overall evolution.
- **Reconstitution** (existing, CFS-031 §3, unchanged by this amendment): the SYSTEM-level convergence of code and constitution over time, mediated by Standing.

The relationship: a completed, Transaction-Reconstitutable receipt is the unit of evidence that feeds the existing Reconstitution loop (CFS-031 §3/§4) — the diagram's final step, "Standing Accrual → Invariant Research → Platform," is not a new mechanism this amendment invents; it is the already-ratified Reconstitution process, given a concrete entry point (one completed constitutional transaction) by this pilot. No new "Platform Reconstitution" term is minted — that name would duplicate CFS-031 §3 under a different label, exactly the kind of near-collision this session's discipline exists to catch.

**Constitutional Evidence Store**: AutoDrive is positioned as one IMPLEMENTATION of this store (execution blobs, receipts, verification evidence, agreements, delegated authority, provenance, standing evidence), not the store itself — consistent with §7.1's primitive/provider separation. Secure execution and evidence preservation technologies, including Trusted Execution Environments (TEEs, candidate: Horizen-provided, unconfirmed) and decentralized storage (candidate: Sui Walrus), will be evaluated where appropriate, deliberately without committing to either in this charter — TEEs and decentralized storage answer different questions (was computation trustworthy while it occurred, versus can the evidence be preserved and reproduced afterward) and are not mutually exclusive.

### 7.4 Field-theory measurements (preserved from the 2026-07-15 reframe)

*(How the six workstreams' results get measured, per the CFS-019 "Invariant Field Theory" amendment — this pilot is that amendment's first named domain laboratory.)*

> "Domain: Financial Services. Objective: Discover the invariant field of constitutional finance. Method: Run experiments across the five capability domains. Measurements: Domain invariants, shared invariants, field strength, interference, coherence, and Time-to-Value." — Alethean, 2026-07-15

| Measurement | What it asks, scoped to Financial Services |
|---|---|
| Domain invariants | Which candidate invariants (F-001–F-203, CFI-001, CFI-002) hold specifically within one of Domains 1–5? |
| Shared invariants | Which of those same candidates recur across two or more domains rather than belonging to one — e.g. does "Verification Before Standing" (F-103) turn out to be the same invariant as CFI-001's settlement-integrity clause, expressed twice? |
| Field strength | Which candidates are load-bearing (many domains depend on them, break the field if removed) versus local (one domain, low transfer)? |
| Interference | Do any two candidate invariants reinforce, conflict, or produce diminishing returns when composed — the question EXP-003's breadth-arm result (CFS-019's Field Theory amendment) raises as a general possibility, tested here on a concrete domain instead of a knowledge-substrate benchmark? |
| Coherence | Does the resulting invariant set satisfy CFS-013/014's composition laws, or does the pilot surface a genuine composition failure worth its own finding? |
| Time-to-Value | Does evidence-aware, field-informed reasoning reduce the time a technical founder spends reaching a usable financial decision, relative to an ungrounded baseline? |

Each series would enter the SAME experimental pipeline every other CCE/CIE/CAE/COE experiment already uses (CFS-019 §Phase C2.1/C3) — no parallel research mechanism proposed. Sequencing, staffing, and scheduling are explicitly OUT of this charter's scope (per CRP-001's interface rule: a CRP charters the research question, it does not sequence a Chrysalis deliverable). **None of these six measurements has an operationalized metric yet** — "field strength" and "interference" in particular are proposed concepts (CFS-019's Field Theory amendment), not yet reduced to a computation; the first Horizen experiment run, whenever scheduled, is where that definition work would actually happen.

**Minimal validation loop (the ten-step version, Alethean 2026-07-15):** Founder Operator declares intent → Agent Z identifies candidates via Horizen → Standing qualifies → Constitutional Agreement forms → Delegation occurs → agent executes → output verified → Standing updates → constitutional service fee settles via QriptoCENT → commercial settlement (if applicable) via USDC. This is the whole constitutional commerce loop the pilot needs to validate — it does not require tokenomics, revenue sharing, or new payment rails; "even a mock settlement layer would allow validating the constitutional loop" (Alethean).

## 8. The loop this charter instantiates

> "Demand from Founder Office generates capability gaps. Capability gaps become research questions. Research discovers invariants. Validated invariants become constitutional primitives. Those primitives improve Agent Z. Agent Z improves Founder Office. Founder Office generates new demand. That's the constitutional cybernetic loop." — Alethean, 2026-07-15

This is CFS-031 §4's macro loop, named there as architectural vision with an explicit honest-limits caveat (Founder Office and Horizen are both deferred/unbuilt). This charter is the FIRST attempt to fill that vision with a concrete, scoped worked example — Financial Services, specifically — rather than leaving it abstract. Filling it in does not build it; §9 restates the limit plainly.

## 9. Honest limits

- **None of Domains 1–5 are built.** No investment-operations service, no market-operations surface, no financial-intelligence agent, no Constitutional Financial Integrity mechanism, no Constitutional Commerce standing-mediated layer exists as of this charter. What exists is named precisely in §5 and §6 (Q¢, multi-rail payments, x402 documentation) — everything else is proposed.
- **No candidate invariant in this charter (F-001–F-203, CFI-001, CFI-002, CFI-Q1–Q4) is seeded into the invariant crystal.** They are vocabulary for a future research and ratification cycle, exactly as CFS-031 §6 treats Signals/Hypotheses. Their "F-nnn"/"CFI-nnn" numbering is a DRAFTING convenience, not the crystal's numbering scheme — a future seeding pass must translate each into `inv.finance.<n>` (or the appropriate namespace), never adopt this shorthand as a second numbering system.
- **The Horizen pilot (§7) is unscheduled**, and its six field-theory measurements (domain invariants, shared invariants, field strength, interference, coherence, Time-to-Value) have no operationalized metric yet — naming them is not defining how to compute them.
- **The Constitutional Agreement primitive (CFI-002, §7.1) is named, not built.** No agreement service, `x409` integration, or Constitutional Agreement Object schema exists in this codebase as of this amendment. It is the pilot's single identified missing primitive, not a shipped one.
- **The Constitutional Memory workstream (§7.2 #6, §7.3) is named, not built.** No Transaction Reconstitution mechanism, no Constitutional Evidence Store route, and no AutoDrive/Walrus/TEE wiring for this purpose exists yet — this amendment carries forward the scope of a prior proposal so it is not lost, it does not claim any of it is implemented.
- **Whether the KNYT campaign's "Horizen" and this pilot's candidate agent-registry partner are the same organization is unverified** (§7, correction). This document does not resolve that question; a future increment should confirm it with the operator before treating them as identical or as unrelated.
- **"The Blocksee outcome"** (§6) is operator-attested, not code-witnessed, same status as IRL-010A row 3.8: an earlier conditional-commerce pilot planned with a vendor consortium, which fell through — the historical reason for this charter's vendor-neutral commitment, not a fact this document independently verifies.
- **Domain 1/2 renaming (§2/§3) is a same-day generalization, not a re-scoping.** "Investment Operations" and "Market Operations" cover exactly what "Treasury & Portfolio Operations" and "Trading & Execution Orchestration" covered — the candidate invariants (F-001–F-103) are unchanged; only the header and the explicit scope-item lists changed, so the domains read as capability-generic rather than crypto-specific.
- **This charter does not sequence or gate any Chrysalis 2.0 deliverable** (CRP-001's interface rule, inherited in full).

## Ratification record

- [x] **CHARTERED 2026-07-15 by operator direction**, following the CRP-002 precedent (a charter is chartered; invariants within it remain candidates until their own seed-and-ratify pass).
- [x] **Generalization amendment — RATIFIED 2026-07-15 by operator direction, same day as the charter.** Domain 1 → Investment Operations, Domain 2 → Market Operations (renamed, candidate invariants unchanged); explicit scope-item lists added to all five domains per Alethean's breakdown; §7 Horizen pilot reframed around the six Invariant Field Theory measurements (CFS-019 amendment) in place of three separate per-domain questions.
- [x] **Constitutional Agreement + Constitutional Memory amendment — RATIFIED 2026-07-16 by operator direction** ("for your reference and ratification as need be," relaying Alethean's stack decomposition). New candidate invariant CFI-002 (Constitutional Agreement Required, Domain 4); §7 renamed the Constitutional Agent Execution Pilot and restructured into six workstreams (Sovereign Identity, Constitutional Agreement, Agent Discovery & Orchestration, Constitutional Execution, Constitutional Commerce, Constitutional Memory); corrected the prior "Horizen has zero prior footprint" claim (the name already appears as a KNYT Wave-1 campaign partner — a distinct, unverified-if-related fact from any technical integration, which remains unbuilt); named **Transaction Reconstitution** as a per-transaction audit/replay property distinct from CFS-031 §3's system-level **Reconstitution**, deliberately declining to mint a redundant "Platform Reconstitution" term. Companion amendment: CFS-018 gains "Constitutional primitives are invariant; providers are replaceable" as a named cross-cutting rule.
