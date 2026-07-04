# Reasoning Compression: Invariant Intelligence as a Constitutional Architecture for Inference

**Chrysalis Foundation Specification · CFS-008a · v0.1 · Status: paper draft (first evidence)**
Companion to CFS-008 (the research specification, which governs method); this document is the paper itself.
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

---

## Abstract

We present **Invariant Intelligence**, a computational model in which intelligence
systems reason *over* a graph of validated, provenance-bearing invariants rather than
*from scratch* on every request, and report the first production evidence for its
central claim. In a controlled benchmark (EXP-003), a language model initialized with a
validated invariant closure answered a fixed constitutional-design task set with **26.7%
fewer output tokens** (every task individually cheaper), grounded-claim share rising
from **78.4% to 100%**, canon contradictions falling from **2 to 0**, and every answer
traceable to cited invariants. The most significant finding is qualitative: unaided, the
model spontaneously committed exactly the epistemic error — conflating reputation with
truth — that one of the system's constitutional invariants (Law XII: Truth, Standing and
Reach are orthogonal) was ratified to prevent; initialization eliminated the error. This
suggests invariants function not as passive reference material but as **active
constraints on inference**. We state the experimental conclusion carefully:

> **Invariant Intelligence reduces computational effort not by replacing reasoning, but
> by preserving validated reasoning so that it need not be repeatedly rediscovered.**

## 1. The Compression Theory of Intelligence

Human civilization advances not through the accumulation of information but through the
discovery, preservation, and propagation of **invariants** — statements that remain true
across contexts, time, and observers (CFS-000 §1). Children do not re-derive calculus;
scientists do not rediscover Newton each morning. Civilization is, computationally, an
inheritance mechanism for compressed reasoning.

Intelligence, on this theory, is not primarily generation. It is **compression**:

- **Reasoning Compression** — the transformation of raw information, through reasoning,
  into invariants. Reasoning is expensive; its products should be reusable.
- **Experience Compression** — the transformation of lived operational experience
  (successes, failures, receipts, consequences) into invariants future actors inherit.
- **Capability Compression** — the packaging of validated invariants, tools, and
  workflows into composable units that execute without re-deriving their foundations.

The chain this paper measures (CFS-008 §1):

```
Reasoning → Invariant → Knowledge → Inference → Capability → Consequence
```

An LLM inference is ephemeral; a validated invariant is durable. Systems that reason
from scratch pay the full cost of rediscovery on every request, cannot explain their
conclusions, and cannot accumulate. Systems that reason over validated invariants
inherit the compressed expertise of every prior validated reasoning act — with
provenance, confidence, and standing attached.

## 2. Reasoning debt and reasoning capital

We name the quantity EXP-003 measures. **Cold inference carries reasoning debt**: the
un-amortised cost of re-deriving, mid-generation, principles the civilization of the
system has already validated — paid in tokens, in error, and in unexplainable output.
**Initialized inference inherits reasoning capital**: the closure of validated
invariants relevant to the task, loaded before generation begins (knowledge
initialization, CFS-006 §3 / CFS-008 §5). The delta between the two arms is the amount
of reasoning the system no longer has to repeat.

This reframing matters because it predicts the *shape* of the result, not merely its
sign: if initialization worked by adding information, we would expect longer, more
elaborate answers. If it works by retiring reasoning debt, we expect **less output,
better grounded** — fewer claims, each traceable. The latter is what we observe (§6.3).

## 3. The invariant as compression product

An invariant (CFS-001) is a versioned, provenance-bearing statement with:

- a **namespace** (constitutional, reasoning, engineering, experience, capability,
  style, narrative) and an ontology classification (CFS-002);
- **contexts** — domains of applicability; the invariant doesn't change, its context
  does;
- a **confidence** value on an evidentiary ladder (document-verified 1.0 →
  principal-verified 0.85 → agent-verified 0.6 → unknown 0.3);
- two **orthogonal accumulators**, per Law XII: **Standing** (validation-class:
  times validated vs. contradicted by observed consequence — constitutional confidence)
  and **Reach** (adoption-class: times referenced and used — never interpreted as a
  measure of truth);
- a lifecycle (`draft → proposed → validated → canonical`, with supersession instead of
  deletion — constitutional memory is append-only).

Three levels compose (CFS-001 §1): the **invariant** (atomic), the **collection**
(curated set), and the **InvariantQube** (published, versioned package of compressed
expertise with a composition manifest and weakest-link aggregate confidence). Knowledge
is not a pile of documents; it is a graph of compressions: twelve edge types
(`derives_from`, `supports`, `constrains`, `contradicts`, …) make explainability a
*retrieval* operation — the answer to "why?" is the provenance trail that already exists
(CFS-008 §3).

## 4. Reasoning / inference separation

Law VII requires the system always to know which of the two it is doing. Reasoning —
transforming information into candidate invariants — is expensive and
provenance-recorded. Inference — applying validated invariants to a task — is cheap,
explainable, and composable. The architectural expression of this separation is
**knowledge initialization**: at session or intent start, the runtime loads the
dependency closure of context-relevant canonical invariants into the working context,
cacheable per (context, class-set, canon version), because canonical objects change only
by supersession. Session capacity is then spent on the *novel* parts of the problem.

## 5. The production apparatus

Unlike benchmark-only proposals, every measure in this paper is instrumented in a
production system (the AgentiQ platform), which supplies:

- the **Invariant Service** — the sole runtime authority over the substrate (store,
  graph traversal, lifecycle, grounding slices, knowledge initialization);
- the **Consequence Operating Model** (CFS-006a) — a 13-stage pipeline in which
  knowledge curation, consequence forecasting, and a disposition gate
  (`ask | act | wait | escalate | deny`) run over the invariant graph, with a guardian
  veto that escalates on reachable constitutional constraints;
- the **consequence flywheel** — every executed plan feeds its observed outcome back:
  confirmation/contradiction adjusts confidence and Standing (validation axis), and
  usage recording accrues Reach (adoption axis), each strictly on its own accumulator;
- **receipt-spine instrumentation** — every grounded act (specialist consultations,
  pipeline stages, executions) records the invariant ids it was grounded in
  (`invariants_used`), making reuse count a production query rather than a benchmark
  artifact.

## 6. The Foundational Validation Series

Three experiments validate three orthogonal properties of the same computational
primitive. We label them the **Foundational Validation Series** — together they form
the programme's first chapter (subsequent experiments explore scale, domains, and model
families, not new property classes):

```
                    Invariant Collection
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
Semantic Fidelity   Temporal Fidelity   Computational Efficiency
     EXP-001             EXP-002              EXP-003
```

| Experiment | Property | Question | Status |
|---|---|---|---|
| **EXP-001** | Semantic preservation | Can one invariant collection render faithfully across modalities (article, report, story, infographic, video)? | **Run 1 complete + human-adjudicated — confirmed on all four measures** |
| **EXP-002** | Temporal preservation | Can invariants sustain coherent, style- and narrative-constrained productions across time (multi-segment video)? | Composition pipeline shipped; production run pending |
| **EXP-003** | Rediscovery savings | Do invariants reduce reasoning cost while improving epistemic fidelity? | **Run 1 complete — hypothesis confirmed on all four measures** |

### 6.0 EXP-001 results (run 1, 2026-07-04 — independent judge: llama-3.3-70b)

Four text artifacts + a combined pass, 15 questions including three adversarial
hallucination probes. Adjudicated scores: consistency 1.83 (target ≥ 1.8),
explainability 1.95 (≥ 1.6), artifact-attributable hallucinations 0 (= 0), coherence
2.00 (= 2.0), and **constitutional restraint 15/15 (100%)** — every probe-answer pair
across every document correctly returned NOT DERIVABLE. Restraint is a distinct
property from hallucination (false assertions vs. constitutional discipline): the
artifacts did not merely preserve what the collection says — they *refused to invent*
what it does not. Every derivable question produced the same substantive answer across
every rendering — semantic preservation at or near ceiling. The two
machine-raised hallucination flags both dissolved under human adjudication in
instructive ways: one was the judge misreading the story's own correctly-marked
narrative sentence as an extra-canonical claim (false positive); the other was a judge
*retrieval failure* — the story renders the expected invariants precisely, the judge
missed the line and derived a canon-contradicting answer, which we scored honestly
*against the run's consistency* (2 → 0 on that question) rather than against the
artifacts. Fourteen of eighteen invariants earned validation events; two were held back
pending a stronger judge and two await question-bank coverage
(`experiments/exp-001-living-knowledgeqube/README.md#results`).

### 6.1 EXP-003 design

Five fixed constitutional-design tasks (delegation, reputation-vs-truth, permanent
mandate, truthful-harm responsibility, repealed-rule memory), each answerable from a
fixed 18-invariant collection ("The Constitutional Internet", constitutional namespace).
Two arms, same model, temperature 0: **cold** (task only) and **initialized** (task +
the invariant closure with citation markers). An independent judge pass decomposes every
answer into claims and scores each CONSISTENT / CONTRADICTING / OUTSIDE the collection.
Run 1: open-source `llama-3.3-70b` (Venice), 2026-07-04. Raw data:
`experiments/exp-003-rediscovery-savings/results-2026-07-04.json`.

### 6.2 Results

| Aggregate | Cold | Initialized |
|---|---|---|
| Output tokens (rediscovery cost) | 2,554 | **1,873 (−26.7%)** |
| Tasks individually cheaper | — | **5 of 5** |
| Grounded-claim share | 78.4% | **100%** |
| Claims outside the canon | 6 | **0** |
| Canon contradictions | 2 | **0** |
| Distinct invariant citations | 0 | **28** |

### 6.3 The three findings

**Finding 1 — rediscovery savings are real and uniform.** Every task was cheaper
initialized; none regressed. The saving is not explained by truncation: initialized
answers were complete and judged *more* consistent, not less.

**Finding 2 — compression produces fewer, better-grounded claims.** Total claims fell
(37 → 29) while grounded share rose to 100%. Optimization systems typically produce
*more*; this produced *less, better*. That is the signature of debt retirement rather
than information addition (§2): the initialized model did not elaborate on the canon —
it stopped re-deriving it.

**Finding 3 — the invariant behaved as an active constraint on inference.** Both cold
contradictions occurred on the reputation-vs-truth task: unaided, the model conflated
reputation weight with truth-weight — **precisely the epistemic error Law XII (Truth,
Standing and Reach are orthogonal) was ratified to prevent**. The benchmark was not
constructed to favour this outcome; the model rediscovered, on its own, the failure mode
the invariant exists to foreclose, and the closure eliminated it. Without the invariant
the model drifted; with it, the drift disappeared. Invariants are not passive knowledge;
they are constitutional guardrails on the reasoning process itself.

### 6.4 Experimental conclusion

> **Invariant Intelligence reduces computational effort not by replacing reasoning, but
> by preserving validated reasoning so that it need not be repeatedly rediscovered.**

## 7. Discussion: a constitutional architecture for inference

The standard question in the field is "can we make models smarter?" The Foundational
Validation Series suggests a different question: **can we give every model a
constitutional foundation that prevents it from repeatedly making the same epistemic
mistakes?** EXP-003's first evidence says yes — and cheaper, not more expensively.

On this reading, Invariant Intelligence is more than a knowledge architecture. The
constitution here is not governing people, nor even agents; it is governing **the
reasoning process itself**. Canonical invariants act as *pre-paid reasoning*: the
distinction between Truth, Standing, and Reach was reasoned once, validated, ratified —
and every subsequent inference inherits it instead of re-deriving (or failing to
re-derive) it. This is the mechanism by which civilizations accumulate; EXP-003 measures
it operating inside a machine.

**Compiled, not authored.** EXP-001 sharpens what an invariant collection *is*. The
five renderings were not independently authored works that happen to agree; they were
**independently compiled** from the same executable specification, and the evaluation
verified compilation fidelity the way a test suite verifies a build. Semantic
preservation across modalities is, on this reading, the property one would demand of a
compiler target — and the collection delivered it at ceiling.

**The evaluation pipeline is itself the constitutional model.** EXP-001's method —
LLM rendering → independent judge → human constitutional ratifier → canonical Standing —
reproduces the platform's own governance chain (proposed → evaluated → ratified →
standing-bearing). The human scorer in the protocol is not *correcting* the model; they
are *ratifying constitutional interpretation*, exactly as Law XI assigns semantics to
humans. The run's two adjudicated flags demonstrate the mechanism working, not failing:
a first-run perfect score would warrant suspicion, while 13-of-15 clean plus two
human-ratified interpretations is what a functioning constitutional epistemology looks
like. The experiments do not ask the model to be trusted — they require it to be
grounded, evaluated, and, where necessary, ratified.

## 8. Limitations (stated per Law XII)

- **One model, one run, five tasks.** Run 1 used a single open-source model
  (`llama-3.3-70b`) at temperature 0. The deltas are within-model — the correct test of
  the hypothesis — but constants (26.7%) are properties of this task set on this model,
  not universals.
- **Model-judged decomposition.** Claim counts and consistency verdicts come from an
  LLM judge; contradiction counts are more robust than exact claim totals.
- **The collection was authored by the platform's own constitutional process.** The
  Law XII rediscovery is strong evidence *because* the failure arose unprompted in the
  cold arm; still, task-collection affinity is by design and generalization across
  domains is untested.
- **EXP-002's full production run is pending** — the series stands at two confirmed
  legs (EXP-001 semantic preservation, EXP-003 rediscovery savings) plus one in flight,
  not three completed. EXP-001's judge (an OSS model) produced one retrieval failure
  that human adjudication caught; stronger judges are queued for run 2.
- A confirmed hypothesis validates the *initialization mechanism*; it does not by
  itself ratify any individual invariant. Standing accrues per-invariant through the
  consequence flywheel, never through benchmark aggregates.

## 9. Future work

1. **Cross-model replication** (`claude-sonnet-4-6`, `gpt-4o-mini`) — separate
   experiment instances, never merged rows.
2. **Cross-domain task sets** (engineering-namespace invariants against code-design
   tasks) to test generalization beyond the constitutional domain.
3. **EXP-002's production run** (the composition pipeline is deployed) and EXP-001
   run 2 (Q16/Q17 covering C-024/C-059; a stronger judge), completing the series.
4. **Production reuse curves** — with `invariants_used` on the receipt spine and Reach
   accruing through runtime citation, the reuse count of CFS-008 §2 becomes a
   longitudinal production measurement, not a benchmark.
5. **Consequence-accuracy curves** — forecast-vs-observed deltas from the flywheel as
   the third compression metric matures with usage.

## 10. Related work

Knowledge graphs and ontologies structure facts but typically lack constitutional
validation, standing-weighted confidence, and a consequence feedback loop. Retrieval-
augmented generation grounds output in documents, but documents are not compressions —
they carry no validation status, no orthogonal truth/adoption accounting, and no
composition algebra. Memory architectures for agents persist episodic traces rather than
validated invariants. Amortised inference shares the economic intuition — pay once,
reuse many times — but amortises *computation*, not *validated reasoning with
provenance*. Constitutional AI constrains model behaviour with principles at training
time; Invariant Intelligence differs in that its constitution is a living, versioned,
consequence-validated substrate applied at inference time, whose every statement carries
provenance, confidence, standing, and reach — and whose failures are corrected by
supersession, not retraining.

---

*Draft v0.1 · 2026-07-04. Evidence base: EXP-003 run 1 (results-2026-07-04.json).
Revisions to this paper follow the constitutional pattern: supersession with provenance,
never silent edits.*
