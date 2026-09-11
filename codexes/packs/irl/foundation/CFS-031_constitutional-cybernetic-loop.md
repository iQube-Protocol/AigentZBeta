# CFS-031 — The Constitutional Cybernetic Loop

**Chrysalis Foundation Specification · v1.0 · Status: RATIFIED by operator direction, 2026-07-15.**
Companions: CFS-019 (IRL charter — the research institution this loop's slow half runs through), CFS-015/CFS-023 (Founder Office, Operation Leap — named workstreams this spec connects, largely unbuilt), CFS-029/030 (Capability Pipeline, Reconciliation — the fast loop's mechanism), the constitutional glossary (Constitutional Computing, Standing, Constitutional Coherence, Reconstitution — deepened/added by this spec).

This spec formalizes a synthesis reached in dialogue between the operator and Alethean (2026-07-15), following CCE-006/007 and the CFS-018/019/022 amendments those experiments prompted. Quotations are theirs; the ratification is the operator's.

## 1. Constitutional Computing, redefined

The glossary's existing entry frames Constitutional Computing as Layer II of a three-layer model — "how a system changes under constitutional feedback while remaining constitutional." That definition stands, but this spec deepens it with the mechanism CCE-006/007 made concrete:

> **Constitutional Computing is a cybernetic system in which every action produces evidence that continuously improves both the operating system and the constitution, allowing evolving code to remain aligned with enduring constitutional principles.**

The deepening is not a replacement — it is the same claim, now with a mechanism: evidence, not just feedback in the abstract, is what crosses from computation to constitution, and Standing (§2) is what carries it.

### Two rates of evolution

There are two clocks, deliberately running at different speeds:

| | Fast loop — Computational Evolution | Slow loop — Constitutional Evolution |
|---|---|---|
| Changes | agents, prompts, models, workflows, software | invariants, standing, ratified principles, constitutional amendments |
| Variance | intentionally HIGH — this layer is meant to churn | intentionally LOW — this layer is meant to be conservative |
| Governed by | the Capability Pipeline (CFS-029), Reconciliation (CFS-030) | the IRL's ratification ceremony (CFS-019), the invariant crystal |
| Today's evidence | daily commits, CCE-006/007's PR cycles | 144-seed crystal, Law XIII, CFS-001–030 |

The constitutional layer is not static — it is simply more conservative than code, by design. A system where both layers moved at the same rate would either never stabilize (constitution as fast as code — no durable memory) or never adapt (code as slow as constitution — no capability growth). The two-rate design is what makes CFS-030's reconciliation loop possible: a fast-loop failure (a validation miss) triggers fast-loop correction (dispatch, CI, revalidate) without touching the slow loop at all — most reconciliations never produce a constitutional amendment. Only some accumulate into one (§2).

## 2. Standing as the membrane

Standing is not, and has never been, only a reputation score for a person (Law XII, Appendix A: Standing and Reach are orthogonal — accumulated trust vs. adoption/citation, never conflated). This spec makes explicit what was previously implicit: **Standing is the mechanism by which evidence crosses from the fast loop into the slow loop.**

```
Action → Evidence → Standing → Confidence → Invariant Candidate → Ratification → Constitution
```

Standing accrues to more than persons — it already does, in code that predates this spec: `services/homecoming/delegateStanding.ts` accrues Standing to DELEGATES on production (CFS-023); the invariant crystal's own `standing` field (Appendix A) accrues to INVARIANTS as they move `proposed → validated → canonical`; the Artifact Runtime's `standing` facet (CFS-025's ConstitutionalObject) accrues to ARTIFACTS. This spec names the completed scope: Standing evaluates **people, agents, capabilities, hypotheses, experiments, and research programmes** — everything that can accumulate evidence of holding up under real conditions becomes, through Standing, part of constitutional memory.

**This does not create a new Standing mechanism.** Every accrual path named above already exists, separately, in its own spec. This section names the SHARED shape they all instantiate — the bridge from fast-loop action to slow-loop constitution — so a future accrual path (e.g., Standing for a research hypothesis, §5) can be recognized as the same primitive rather than invented fresh.

## 3. Reconstitution

> "It's like the invariants become code, and code and rules realign themselves, they converge again. It's like they diverge in code creation and they converge again in canonization and standing." — operator, 2026-07-15

**Reconstitution** names the convergence half of the cycle CFS-030 already builds the mechanism for: capability DIVERGES from the constitution when new code is written for a new consequence (the fast loop doing its job); it RECONVERGES when that code's evidence (via Standing) ratifies a principle, and the constitution — now including that principle — reasserts itself over the codebase (a future reconciliation cycle judging against the newly-ratified invariant). The constitution is not a gate the code passes through once; it is the attractor the code keeps being pulled back toward, at the slow loop's pace, indefinitely.

> "Constitutional Computing continuously reconstitutes computation around constitutional invariants." — Alethean, 2026-07-15

This is why the Chrysalis metaphor holds past its first, obvious reading (a system in transition between two stable forms). CFS-030's reconciliation loop is EPISODIC — it runs, converges, and stops for a given pack. Reconstitution is the CONTINUOUS version of the same shape at the platform's scale: capability emerges, is validated, accrues Standing, and — when Standing crosses into ratification — the constitution itself updates, and the next capability is judged against a platform that is no longer quite what it was. The organism does not reach a final form. It is in a persistent state of constitutional metamorphosis — the chrysalis is not a stage between two states; it is the permanent process.

## 4. The macro cybernetic loop — Market ↔ Research

> "It's not simply that research informs products and products inform research… What's emerging here is something closer to a constitutional market for knowledge, where demand, execution, and research continuously regulate one another." — Alethean, 2026-07-15

```
Market Signals
   ↓
Founder Office (intent, capability demand, operator needs)
   ↓
Capability Gaps
   ↓
Horizen Registry (agent discovery, qualification, onboarding)
   ↓
Execution (Bounded Delegation)
   ↓
Verification (Standing, Time-to-Value, outcomes)
   ↓
Invariant Research (hypothesis testing, constitutional analysis)
   ↓
New Constitutional Primitives
   ↓
Platform
   ↓
Market
```

**⚠ THIS DIAGRAM IS ARCHITECTURAL VISION, NOT A BUILT SYSTEM. Read §7 before treating any node as delivered.** Founder Office and Operation Leap are named, scoped workstreams in CFS-015 §Scope and CFS-023's maturity ladder — both explicitly DEFERRED there ("Founder Office pack UI" — CFS-015's own honest-limits list). **Horizen does not exist anywhere in this codebase** — no spec, no service, no route, prior to this document. This section records the SHAPE the operator and Alethean have agreed the loop should eventually take, so that when Founder Office, Horizen, or a Bounded-Delegation verification surface are eventually built, they are built AS NODES OF THIS LOOP rather than as isolated features that later need retrofitting into it (the CS-001 defect class, applied at the architecture-vision scale instead of the code scale).

The loop's already-BUILT segment is narrow but real: `Invariant Research` (CFS-019) → `New Constitutional Primitives` (CFS-001–031, the invariant crystal) → `Platform` (every spec's built increments) is the one arc CCE-006/007 demonstrate operating, and only within the Dev Command Center's own capability-development scope — not yet at the Founder Office/Market scale this diagram describes.

## 5. Three sources of hypotheses, one pipeline

The Capability Pipeline's stage-proposal system (CFS-019 §Phase C2.1: `experiment_proposal`, `protocol_draft`, `finding`, `publication_draft`) already provides ONE mechanism through which a hypothesis becomes a ratified experiment. This spec names three DISTINCT SOURCES that can feed that one mechanism — a taxonomy, not a new pipeline:

- **Market-led** — Founder Operators declare intents; recurring patterns become visible capability gaps; research asks why the bottleneck recurs. (Depends on Founder Office existing at the scale §4 describes — today, aspirational.)
- **Constitutional-led** — the Institute proposes a hypothesis directly from theory (e.g., "Standing is a better trust primitive than identity") and designs an experiment to test it. This is what EXP-001 through CCE-007 have all been, to date — the ONLY source currently exercised.
- **Community-led** — participants submit hypotheses; standing accrues around ideas from outside the Institute or a single Founder Operator's demand. (Depends on a community-facing submission surface that does not yet exist.)

**All three converge on the same experimental pipeline** (design → protocol → run → analyze → publish, CFS-019 §Phase C3) — a genuine design strength worth ratifying even though two of the three sources have no feeding mechanism built yet. When a Founder-Office or community intake surface is eventually built, it should emit into the EXISTING proposal system (`experiment_proposal`), not a parallel one.

## 6. Signals vs. Hypotheses — a proposed conceptual distinction

> Signal: "Many Founder Operators need financial agents." (an observation)
> Hypothesis: "Standing-informed agent selection reduces Time-to-Value for financial workflows." (an explanation)

```
Signals → Hypotheses → Experiments → Evidence → Invariants → Constitution → Platform → (new Signals)
```

**Status: conceptual vocabulary, proposed here — NOT yet a seeded invariant.** Adding `Signal` and `Hypothesis` as first-class terms with governing invariants (an `inv.epistemology.13x` pair, following the Law XIII / IRL Principle 004 pattern) is a follow-on ratification requiring the SAME seed-and-ratify ceremony every other invariant addition in this codebase requires (`canonical-invariants.seed.json` + operator SQL ingestion + explicit canonization) — it is named here as vocabulary the glossary now defines (see companion glossary amendment), not silently added to the crystal.

## 7. Honest limits — what this spec does NOT claim

- **§4's macro loop is a design target.** Founder Office, Operation Leap, and Horizen are named and positioned; none of the three is built to the scale this spec describes. Horizen specifically has zero prior footprint in this codebase — treat every mention of it, here and in future conversation, as a PROPOSED capability-supply concept until a spec or a route exists.
- **§5's three-source taxonomy has one exercised source.** Constitutional-led hypotheses (EXP-001 through CCE-007) are the only source with a real feeding mechanism today. Market-led and community-led are named futures, not built intake paths.
- **§6's Signal/Hypothesis distinction is vocabulary, not an invariant.** No `inv.epistemology.13x` exists yet for it. Using the terms in conversation or documentation is fine; claiming they GATE anything (the way a ratified invariant gates composition, CFS-013) would be false until a seed-and-ratify pass happens.
- **§2's Standing-as-membrane is a naming of existing, separate mechanisms — not a new unified Standing service.** No code changes with this spec. A future increment that wants ONE Standing accrual surface across delegates/invariants/artifacts/hypotheses is implied as desirable by this section, but not built or even designed here.
- **The two-rate model (§1) is a description of what CFS-029/030 + the IRL ratification cadence already do, made explicit — not a new governance mechanism.** No new gate, no new receipt type, no new code.

## Ratification record

- [x] **RATIFIED 2026-07-15 by operator direction**: "Some points from Alethean and I for reference and ratification." The deepened Constitutional Computing definition (§1), Standing-as-membrane (§2), and Reconstitution (§3) are ratified as CANONICAL DOCTRINE, effective immediately, alongside the glossary amendment. §4 (macro loop) and §5 (three hypothesis sources) are ratified as ARCHITECTURAL VISION — a design target future specs should build toward, explicitly not yet delivered. §6 (Signals/Hypotheses) is ratified as VOCABULARY, pending its own future invariant-seeding ceremony.
