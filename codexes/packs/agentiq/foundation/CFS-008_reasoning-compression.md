# CFS-008 — Reasoning Compression

**Chrysalis Foundation Specification · v0.1 · Status: draft · Research specification**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Implementation guidance and the basis for the academic paper. Defines the full chain and its epistemics. (Note: within the operating model the corresponding *stage* is named **Knowledge Compression** — by its product; this research spec keeps the process name because its subject is the reasoning itself.)

---

## 1. The chain

```
Reasoning → Invariant → Knowledge → Inference → Capability → Consequence
```

- **Reasoning** — the expensive act: transforming information into candidate invariants. Performed by humans, agents, or hybrid; always provenance-recorded.
- **Invariant** — the compression product: a statement that survives validation (CFS-001).
- **Knowledge** — the accumulated, structured graph of validated invariants (CFS-003). Knowledge is not a pile of documents; it is a graph of compressions.
- **Inference** — cheap application: reasoning *over* knowledge rather than *from scratch*. Law VII: separate reasoning from inference — the system must always know which of the two it is doing.
- **Capability** — knowledge composed with tools/agents into executable form (CapabilityQube).
- **Consequence** — capability exercised in the world; observed, receipted, and fed back (CFS-006a).

## 2. Compression ratio as the core metric

The research question: how much reasoning cost does a validated invariant amortise? Proposed measures:

- **Rediscovery savings** — tokens/steps an agent spends solving a problem cold vs. initialized with the relevant invariant closure
- **Reuse count** — times an invariant appears in reasoning paths of successful executions
- **Consequence accuracy** — forecast-vs-observed deltas for plans grounded in the invariant (the Knowledge Evolution signal, CFS-006a)

The platform's receipt spine makes these measurable in production, not just in benchmarks — every execution already emits `toolsUsed`, `iqubesUsed`, `agentsInvoked`, and outcome receipts.

## 3. Explainability

Every conclusion grounded in the graph can emit its **reasoning path** (CFS-003 §4): the `derives_from`/`supports`/`explains` chain from evidence to conclusion. Explainability is therefore a *retrieval* operation, not a post-hoc rationalisation — the answer to "why?" is the provenance trail that already exists. Dispositions (`ask|act|wait|escalate|deny`) cite the invariants and forecasts that produced them.

## 4. Reasoning provenance

The provenance record of a reasoning act (held by the Invariant Service, CFS-003a §2.8):

- inputs (documents, receipts, prior invariants — by ref)
- method (`human | llm | derivation | hybrid`), model/version where applicable
- the candidate produced, its validation verdicts, and its subsequent evolution history

Provenance is append-only and survives supersession — a superseded invariant's provenance explains *why we once believed it*, which is itself knowledge.

## 5. Knowledge initialization

The practical payoff. At intent start, the runtime loads the dependency closure of context-relevant canonical invariants (CFS-006 §3) — the system begins already knowing what the platform has validated. Initialization replaces re-derivation; session context is spent on the novel parts of the problem. Cacheable per (context, class-set, canon version).

## 6. Paper skeleton

1. The Compression Theory of Intelligence (CFS-000 §1)
2. The invariant as compression product; the three levels
3. The graph as knowledge; contexts as domains of applicability
4. Reasoning/inference separation and its measurable consequences
5. The consequence flywheel: standing as epistemic feedback
6. Production evidence from the AgentiQ substrate (receipts, forecasts, evolution deltas)
7. Related work: knowledge graphs, ontologies, memory architectures, amortised inference — and where invariant intelligence differs (constitutional validation, standing-weighted confidence, consequence feedback)

*The paper draft realizing this skeleton is CFS-008a
(`CFS-008a_reasoning-compression-paper.md`), v0.1 as of 2026-07-04.*

## 7. First experimental evidence — amendment, 2026-07-04

EXP-003 (rediscovery savings) run 1 confirmed the hypothesis on all four measures:
26.7% fewer output tokens with every task individually cheaper, grounded-claim share
78.4% → 100%, canon contradictions 2 → 0, and 28 traceable citations vs 0
(`experiments/exp-003-rediscovery-savings/`). Three additions are ratified into this
spec from that result:

**7.1 The Foundational Validation Series.** EXP-001/002/003 are formally one series —
three orthogonal validations of the same computational model, not isolated demos:
EXP-001 *semantic preservation* (across modalities), EXP-002 *temporal preservation*
(across time), EXP-003 *rediscovery savings* (reasoning cost + epistemic fidelity).

**7.2 Terminology: reasoning debt / reasoning capital.** Cold inference carries
**reasoning debt** — the un-amortised cost of re-deriving already-validated principles,
paid in tokens, error, and unexplainable output. Initialized inference inherits
**reasoning capital** — the validated closure loaded before generation. The delta is the
reasoning the system no longer repeats. Canonical invariants are thereby **pre-paid
reasoning**, and EXP-003's Law XII finding (the cold arm spontaneously committed exactly
the reputation→truth conflation Law XII forecloses; the closure eliminated it) shows
they act as **active constraints on inference**, not passive reference.

**7.3 The experimental conclusion** (stated carefully; supported by run 1, subject to
cross-model replication):

> **Invariant Intelligence reduces computational effort not by replacing reasoning, but
> by preserving validated reasoning so that it need not be repeatedly rediscovered.**
