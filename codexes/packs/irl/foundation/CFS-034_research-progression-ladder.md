# CFS-034 — The Research Progression Ladder

**Status:** Ratified (charter)
**Date:** 2026-07-16
**Depends on:** CFS-019 (IRL Charter), CFS-033 (Constitutional Evaluation), the Standing
Charter (`services/standing/standingScore.ts`), the Researcher pathway (Phase 20/21 —
`OperatorArchetype: 'research'`, the `research_copilot` tier).
**Origin:** Aleatheon's "research ladder" proposal, ratified by the operator 2026-07-16
("yes build it") as the recognition structure for the fifth — **epistemic** — value-creation
pathway.

---

## 1. Why a ladder

The Researcher is the platform's **knowledge-production** pathway: the mechanism by which the
platform itself learns, improves, and expands its understanding (CFS-019 Layer I). Unlike the
four production pathways (civic, economic, technical, cultural value), the researcher creates
**epistemic value** — and epistemic value is the near-perfect case for the platform's founding
principle that **standing accrues through action, never through payment**.

The ladder makes that principle legible. It mirrors academia while staying native to the
constitutional model: each rung is a level of **earned recognition** in the constitutional
research corpus, not a purchased feature set.

## 2. The two axes — never conflate them

A researcher's position is the intersection of two independent axes:

| Axis | What it is | How it is obtained | What it gates |
|---|---|---|---|
| **Standing** (earned) | The researcher's recognition level | *Action only* — reproducing results, discovering invariants, improving protocols, identifying flaws, contributing evidence | The **recognition rung** (this ladder) — eligibility to propose, lead, ratify |
| **Tooling** (paid) | Access to the Research Copilot + instruments | The `research_copilot` tier ($29/mo) — its own SKU (CFS-033 §8A, Phase 21) | The **capability surface** — which instruments are switched on |

**Paying never buys a rung.** The `research_copilot` tier unlocks the *tooling* (the Copilot,
protocol authoring, personal experiments). It does not raise the researcher's standing rung —
that is earned by contribution. A free (Explorer) participant can hold a high rung through
reproduction and evidence work; a paying subscriber starts at the bottom rung until they
contribute. This is the constitutional guarantee that keeps the corpus meritocratic.

## 3. The seven rungs

| # | Rung | Primary capability | Standing gate | Governance gate |
|---|---|---|---|---|
| 1 | **Citizen Researcher** | Consume, annotate, reproduce published research | none (any participant) | — |
| 2 | **Research Analyst** | Run experiments, analyse evidence | standing ≥ 25 (qualified) | — |
| 3 | **Research Associate** | Contribute protocols + invariant *proposals* (C2.1 — a human ratifies) | standing ≥ 50 | — |
| 4 | **Research Fellow** | Lead investigations, mentor others | standing ≥ 75 | — |
| 5 | **Principal Investigator** | Own research programmes | standing ≥ 90 | — |
| 6 | **Institute Steward** | Ratify findings, govern the corpus | standing ≥ 90 | Steward tier / IRL admin |
| 7 | **Founder Operator** | Shape the Institute itself | — | Platform admin / Founder Office |

Rungs 1–5 are pure **standing** rungs — earned, open to anyone regardless of subscription.
Rungs 6–7 additionally require a **governance** role (ratification and corpus governance are
constitutional acts reserved to stewards/admins, per CFS-019 and the Access Gates rule). The
standing thresholds reuse the existing Standing score (0–100 composite, `QUALIFY_THRESHOLD = 25`)
— no new scoring is introduced.

## 4. Ratification discipline (unchanged)

Climbing the ladder never grants unilateral canonization. Authoring protocols, invariant
proposals, and experiment designs remain **proposals** (C2.1, CFS-019). Even the Institute
Steward *ratifies* through the constitutional process — the rung grants the *authority to
ratify*, not automatic canonization. Standing is never granted by accrual into `canonical`
(the Phase 18 accrual guard); it is earned per contribution and reviewed.

## 5. Subscription alignment (the commercial reading)

The ladder aligns the subscription structure with **increasing responsibility**, not merely
"more features":

| Commercial stage | Tooling | Typical rungs reachable |
|---|---|---|
| **Explorer** (Free) | Read papers, browse corpus, simple search (IRL OS public instruments) | Citizen Researcher (1) |
| **Researcher** (`research_copilot`, $29) | Research Copilot, protocol authoring, personal experiments, notebook | Analyst → Fellow (2–4), by standing |
| **Steward** (Stewardship tier) | Advanced experiment design, evaluation tooling, replication, collaboration | up to Principal Investigator (5); Institute Steward (6) with the governance role |
| **Founder Office** | Institute governance, canonical ratification, corpus + programme leadership | Founder Operator (7) |

The tooling stage is necessary-not-sufficient: a Researcher-tier subscriber still needs the
earned standing to occupy Analyst/Associate/Fellow. This is the constitutional shape — tiers buy
*instruments*, standing earns *rungs*.

## 6. Implementation

A pure mapping helper computes the rung from the two axes:

```
services/research/researchLadder.ts
  researchLevelFor({ standingScore, hasResearchCopilot, isSteward, isAdmin }) → ResearchLevel
```

It is deterministic, T2-safe (consumes only the standing score + boolean role/tooling flags,
never a personaId), and side-effect-free — IRL surfaces (the Research Copilot, IRL OS) read it
to render a researcher's current rung and their next-rung requirement. It introduces no new
persistence: standing comes from the Standing Charter, tooling from `researchCopilotAccess`
(`research_tier`), governance from the persona's admin/steward flags.

## 7. What this is NOT (scope guard)

- **Not** a new scoring system — it reads the existing Standing composite.
- **Not** a paywall on recognition — rungs 1–5 are free to earn.
- **Not** an auto-canonization path — ratification stays a human constitutional act.
- **Not** a per-rung SKU — the only research SKU is the single `research_copilot` tooling tier.

## 8. Open follow-ons

1. **Rung-earned receipts.** Emit a receipt when a researcher crosses a rung (a DVN-anchorable
   `research_rung_reached` event), so progression is auditable like other standing events.
2. **Programme ownership binding.** Principal Investigator (rung 5) → own IRL programmes
   (CRP-001) as first-class objects; needs a programme-ownership record.
3. **Corpus governance surface.** Institute Steward (rung 6) ratification UI in the internal
   IRL cartridge (admin-gated).
