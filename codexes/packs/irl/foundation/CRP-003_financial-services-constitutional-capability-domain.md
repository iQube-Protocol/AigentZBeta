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

## 2. Domain 1 — Treasury & Portfolio Operations

**Constitutional focus: Bounded Delegation.** Not "pick the best trade" — "operate a digital treasury safely." Typical tasks: multi-chain portfolio visibility, treasury allocation recommendations, rebalancing, yield strategy comparison, stablecoin management, liquidity monitoring, risk exposure summaries. Fits because every technical founder eventually has a treasury; the work is operational, repeatable, and requires coordination between multiple specialized agents — exactly the shape Bounded Delegation already governs (CFS-023 sovereignty layer 3).

**Candidate invariants** (proposed, unseeded):
- **F-001 — Verifiable State Before Action.** No portfolio action should be delegated until the current portfolio state has been independently verified.
- **F-002 — Explainable Allocation.** Every recommended allocation must include an auditable rationale and confidence signal.
- **F-003 — Delegation Boundaries.** Agents may recommend allocation changes but cannot execute beyond delegated authority.

## 3. Domain 2 — Trading & Execution Orchestration

**Constitutional focus: Standing & Accountability.** Deliberately narrowed: not a better trading bot — the constitutional orchestration layer AROUND trading agents. Aigent Z becomes the constitutional portfolio manager; specialist agents (arbitrage, market-making, sentiment, execution, risk) are the specialists Aigent Z selects among, under explicit authority, with results independently verified before Standing updates.

**Candidate invariants** (proposed, unseeded):
- **F-101 — Separation of Advice and Execution.** Recommendation and execution remain independently attributable.
- **F-102 — Standing-Weighted Agent Selection.** Agent selection considers demonstrated standing, not historical popularity alone.
- **F-103 — Verification Before Standing.** Financial outcomes contribute to standing only after independently verifiable execution.

## 4. Domain 3 — Financial Intelligence

**Constitutional focus: Evidence & Verification.** The underserved domain: not trading questions but intelligence questions technical founders spend enormous time answering — which protocol to integrate, which token to accept, what regulations apply, which grants are available, which chains are active, which investors fit their stage. Agent ecosystem: research, protocol, governance, grant, and regulatory agents.

**Candidate invariants** (proposed, unseeded):
- **F-201 — Source Diversity.** High-impact recommendations should incorporate multiple independent evidence sources.
- **F-202 — Evidence Attribution.** Every recommendation should preserve traceability to supporting evidence.
- **F-203 — Confidence Calibration.** Confidence should reflect evidence quality, not model certainty.

## 5. Domain 4 — Constitutional Financial Integrity (the cross-cutting programme)

Not "Constitutional Financial Agents" (an earlier working title, superseded same-day) — **Constitutional Financial Integrity**, because the focus is how constitutional trust is maintained THROUGH financial interactions, not what agents do within them. This is the programme that studies the constitutional properties of Domains 1–3 themselves.

**The governing principle, refined in dialogue (2026-07-15):**

> Not: "every action should be paid for." But: **every constitutional action should be constitutionally self-sustaining** — carrying, or explicitly referencing, the authority, resources, verification, and settlement required to complete itself, without creating hidden obligations for unrelated participants.

**Candidate invariant** (proposed, unseeded):
- **CFI-001 — Constitutional Self-Sufficiency.** Every constitutional transaction should contain, or explicitly reference, the authority, resources, verification, and settlement required to complete itself without creating hidden obligations for unrelated participants. Micro-settlement, x402, x409, USDC, and traditional banking rails are all candidate IMPLEMENTATIONS of this invariant — the invariant is independent of the settlement rail (see §6).

**Research questions** (constitutional, not implementation-shaped):
- **CFI-Q1** — How can every delegated financial action remain constitutionally attributable?
- **CFI-Q2** — Can every financial interaction become economically self-sustaining without introducing central coordination?
- **CFI-Q3** — Does embedding settlement into delegation increase accountability?
- **CFI-Q4** — Can financial integrity become an emergent property of constitutional architecture rather than external regulation? (Named as the most open and interesting of the four — no answer proposed here.)

## 6. Domain 5 — Constitutional Commerce, repositioned

**What already exists (verified against the codebase, not asserted):** IRL-010A §3.6 already scores this honestly — Q¢ pricing rails, cart/multi-rail payments, and KNYT commerce are **Implemented (early)**; *constitutional* commerce (standing-mediated exchange) is **Proposed**, flagged ⚑. `agentiq-os`'s protocol docs already name x402 as the ecosystem's declared value-exchange standard (payment intent in HTTP headers, settlement logged as a DVN receipt, linked to a persona FIO handle) — infrastructure exists; this charter does not duplicate it.

**What this domain changes is the FRAME, not the infrastructure:**

> Instead of "Constitutional Commerce is a payment protocol" — **Constitutional Commerce is the constitutional integrity layer for economic interactions.** Settlement becomes an implementation detail; integrity (bounded authority, attributable settlement, explicit costs, aligned incentives) is the primitive.

This reframe is why Domain 4 (the invariant layer) and Domain 5 (the operationalization across settlement rails) are named as TWO domains, not merged: Domain 4 asks *what invariant laws govern trustworthy financial interactions?*; Domain 5 asks *how do we operationalize those laws across heterogeneous payment/settlement systems?* — the same Research → Platform → Commerce pattern this charter's §1 names generally. The practical benefit: a settlement adapter (Q¢, x402, a future rail) becomes replaceable without touching the constitutional integrity layer above it — the architectural separation Alethean named as the reason a specific prior settlement-partner outcome ("the Blocksee outcome") "no longer concerns" the programme. **This document has no visibility into what that outcome was** (zero prior reference to "Blocksee" anywhere in this codebase) — it is recorded here only as the operator's own stated reason for confidence in the reframe, not verified or elaborated on.

```
Intent → Standing → Delegation → Verification → Constitutional Integrity → Settlement Adapter
```

## 7. The Horizen pilot — proposed experiment series

**⚠ Horizen has zero prior footprint in this codebase (confirmed by search before drafting, per the CFS-031 §7 discipline this charter inherits). Everything below is a PILOT PROPOSAL, not a scheduled or built programme.**

| Series | Domain | Research question |
|---|---|---|
| 1 | Treasury Operations | Can bounded delegation improve operational treasury management? |
| 2 | Trading Orchestration | Does standing-informed orchestration improve financial agent performance? |
| 3 | Financial Intelligence | Does evidence-aware reasoning reduce Time-to-Value for technical founders? |

Each series would enter the SAME experimental pipeline every other CCE/CIE/CAE/COE experiment already uses (CFS-019 §Phase C2.1/C3) — no parallel research mechanism proposed. Sequencing, staffing, and scheduling are explicitly OUT of this charter's scope (per CRP-001's interface rule: a CRP charters the research question, it does not sequence a Chrysalis deliverable).

## 8. The loop this charter instantiates

> "Demand from Founder Office generates capability gaps. Capability gaps become research questions. Research discovers invariants. Validated invariants become constitutional primitives. Those primitives improve Agent Z. Agent Z improves Founder Office. Founder Office generates new demand. That's the constitutional cybernetic loop." — Alethean, 2026-07-15

This is CFS-031 §4's macro loop, named there as architectural vision with an explicit honest-limits caveat (Founder Office and Horizen are both deferred/unbuilt). This charter is the FIRST attempt to fill that vision with a concrete, scoped worked example — Financial Services, specifically — rather than leaving it abstract. Filling it in does not build it; §9 restates the limit plainly.

## 9. Honest limits

- **None of Domains 1–5 are built.** No treasury service, no trading-orchestration surface, no financial-intelligence agent, no Constitutional Financial Integrity mechanism, no Constitutional Commerce standing-mediated layer exists as of this charter. What exists is named precisely in §5 and §6 (Q¢, multi-rail payments, x402 documentation) — everything else is proposed.
- **No candidate invariant in this charter (F-001–F-203, CFI-001, CFI-Q1–Q4) is seeded into the invariant crystal.** They are vocabulary for a future research and ratification cycle, exactly as CFS-031 §6 treats Signals/Hypotheses. Their "F-nnn"/"CFI-nnn" numbering is a DRAFTING convenience, not the crystal's numbering scheme — a future seeding pass must translate each into `inv.finance.<n>` (or the appropriate namespace), never adopt this shorthand as a second numbering system.
- **The Horizen pilot (§7) is unscheduled.** No experiment in the series has a protocol, a runner, or a date.
- **"The Blocksee outcome"** is recorded verbatim as the operator's stated reasoning (§6) with zero independent verification — this document has no other information about it and does not elaborate on what it was.
- **This charter does not sequence or gate any Chrysalis 2.0 deliverable** (CRP-001's interface rule, inherited in full).

## Ratification record

- [x] **CHARTERED 2026-07-15 by operator direction**, following the CRP-002 precedent (a charter is chartered; invariants within it remain candidates until their own seed-and-ratify pass).
