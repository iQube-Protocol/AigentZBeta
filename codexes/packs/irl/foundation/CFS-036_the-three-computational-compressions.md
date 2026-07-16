# CFS-036 — The Three Computational Compressions

**Chrysalis Foundation Spec · Doctrine · v1 · Status: canonized 2026-07-18 (operator ratification)**
Institution: **metaMe IRL** (the metaMe Invariant Research Lab; CFS-019).
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`
Sharpens: **CRP-002** (Invariant Intelligence as intent-driven compression), **CFS-008** (Reasoning Compression), **IRL-011** (the computational model).
Canonical invariants: `inv.epistemology.138`–`141`, `inv.reasoning.142` (Appendix A).
Origin: the operator's dialogue with **Austin and Austin's agent**, 2026-07-18 — a challenge that forced the programme to identify its true optimization objective.

> **Why this document exists.** Through an extended external dialogue, the Institute's central claim was sharpened from something that could still be read as "advanced retrieval" or "better prompt/context engineering" into a precise, falsifiable scientific claim with its own optimization objective. This doctrine canonizes that sharpening. It is the definitional spine; **CRP-002** remains the programme that tests it; the runtime (CFS-035 The Invariant Engine) operationalizes it.

---

## 0. The pipeline — where invariants sit

An intelligent system's lifecycle has four stages, routinely conflated:

```
pre-prompt reasoning  →  prompt  →  post-prompt reasoning  →  inference
```

- **Pre-prompt reasoning** — everything that happens before a prompt is assembled. Today the dominant paradigms here are **context engineering** (selecting relevant knowledge) and **prompt engineering** (structuring instructions). We claim a third: **invariant extraction**.
- **The prompt** — the serialized representation that arrives at the model. This is what current model-side work (e.g. Anthropic's) can see and reason about.
- **Post-prompt reasoning / inference** — what the model does with the prompt.

The scientific object of this doctrine lives at the **first** stage. It is *not* about the prompt representation, and *not* about inference. It is about the computation performed before serialization.

---

## 1. The Three Computational Compressions

Every intelligent system performs a compression before inference. **The question is what it compresses.**

### Prompt Engineering — compresses *instructions*
> Given an intent, how should the task be expressed to maximize model performance?
- **Optimization target:** instruction formulation.
- **Output:** a prompt.

### Context Engineering — compresses *knowledge*
> Given an intent, which information should be supplied?
- **Optimization target:** information relevance.
- **Output:** curated knowledge.

### Invariant Intelligence — compresses *reasoning*
> Given an intent, which structural relationships have already been discovered, validated, and therefore never need to be re-derived?
- **Optimization target:** computational reuse.
- **Output:** an invariant substrate.

This is deliberately elevated from *three engineering techniques* to *three computational compressions*, which ties it directly into the Institute's existing compression theory (CFS-008) and exposes why this is **not "better context": the optimization target is different.**

*(Canonical: `inv.epistemology.140`.)*

---

## 2. The Pre-Prompt Reasoning Theorem

> **Prompt engineering optimizes how reasoning is requested. Context engineering optimizes what knowledge is supplied. Invariant Intelligence optimizes which reasoning need not occur again.**

That is the whole field in one sentence. The three are distinct *pre-inference compressions* with distinct *optimization targets* — not three techniques within one discipline.

*(Canonical: `inv.epistemology.138`. Validated, not merely definitional: the optimization claim — that reusing previously validated reasoning is a distinct and, for a class of intents, superior objective — is exactly what the Institute exists to test.)*

---

## 3. The purpose, and the independent variable

> **The purpose of Invariant Intelligence is not to retrieve better knowledge. It is to reduce the amount of reasoning that must be performed at inference time by reusing previously validated structural reasoning.**

This is an extremely precise scientific claim, and it is experimentally falsifiable.

It also fixes the **independent variable** that the Austin dialogue revealed was still unshared:

- The independent variable is **neither prompts nor context**. It is the **reuse of previously validated reasoning through invariant structures**.
- Context engineering asks: *“Given an intent, what information should I provide?”* — it optimizes **information retrieval**.
- Invariant Intelligence asks: *“Given an intent, what reasoning should never need to happen again?”* — it optimizes **computational reuse**.

Everything else in the architecture — including representation and runtime — exists to *support* that more fundamental proposition, not to constitute it.

*(Canonical: `inv.epistemology.141`.)*

---

## 4. What an invariant *is* (tightened)

> **A structural invariant is a persistent representation of previously validated reasoning that remains sufficient across a class of intents and can therefore be reused rather than recomputed.**

Notice what disappeared from the definition:

- not **fact**,
- not **knowledge**,
- not even **truth**.

It is **previously validated reasoning** — the thing the programme has been circling for days. This is the criterion that also grounds IRL Principle 005 (`inv.epistemology.133`): *the value of an invariant lies not in how it was discovered, but in its stability across contexts and its ability to organize future reasoning.*

*(Canonical: `inv.epistemology.139`.)*

---

## 5. The Representation Principle

> **Representations are not invariants. They are manifestations of invariants.** The same structural invariant may be represented as natural language, symbolic logic, a graph, executable code, or a future world-model representation. **The representation is constrained by the computational substrate; the invariant is not.**

This is the paragraph that future-proofs the doctrine against the specific misunderstanding the dialogue surfaced — that because everything ultimately reaches the model as serialized tokens, the two pre-prompt processes must be the same computation. They are not:

- If two different pre-prompt processes serialize to similar text, that does **not** imply they performed the same computation.
- One may have **rediscovered** those relationships from raw knowledge.
- The other may have **assembled previously validated structural invariants**.

The representation is the *transport mechanism*; the scientific question concerns the *process that produced it*.

Two honest observations attach here:

1. **The register-collapse risk.** Reducing everything to alphanumerics is a known limitation of LLMs relative to human cognition — humans do not perceive and reason only through language, which is the gap large world models attempt to address and language models fall flat on. The Representation Principle names this: language is a proxy for reality, not reality. This is important to highlight, but it is a *separate* issue from the compression claim.
2. **The separation this buys us.** The principle cleanly separates three concerns that the dialogue kept conflating: **structural invariance** (the science), **constitutional governance** (how invariants evolve, are trusted, versioned, and become authoritative), and **representation** (how an invariant is manifested for a given substrate).

*(Canonical: `inv.reasoning.142`.)*

---

## 6. Structural vs constitutional invariants — which is the science

The programme separates two invariant classes, and the distinction decides what the runtime is *for*:

- **Structural invariants** are the **scientific** question — the reusable substrate of previously validated reasoning.
- **Constitutional invariants** govern how structural invariants **evolve, are trusted, are versioned, and become authoritative over time**.

The runtime (CFS-035 The Invariant Engine; standing, provenance, ratification, the shadow→authoritative flip) is primarily relevant to the **constitutional** class. **The science does not depend on the runtime; the runtime operationalizes it.** This is why a shadow observation, a flip control, or a receipt is governance machinery — necessary to make the substrate trustworthy and evolvable, but not itself the claim under test.

---

## 7. The DNA analogy — a generative substrate, not a better summary

> Which wild cat left these traces?

One approach compresses all available zoological knowledge into a good summary — lungs, organs, limbs, teeth, hair. Another recovers and sequences **DNA**. Both are compressions. Only one identifies the **substrate that determines the organism**.

The point is *not* that intelligence literally has biological DNA. The point is that **DNA is not simply a better summary of the animal — it is a fundamentally different representation, because it captures the generative substrate from which the organism can be reconstructed** (and beyond physiology: disease patterns, even disposition). Reconstituting an animal from its organs is knowledge compression; reconstituting it from DNA is substrate reasoning, and the two are not the same computation even when they name the same animal.

Our hypothesis is that intelligence may possess something analogous: a **structural substrate more fundamental than topical knowledge**. If such a substrate exists, then reasoning over it is a different computational process from reasoning over compressed summaries, even when both ultimately produce text. Whether that survives experimentation is precisely what the Institute exists to investigate. *(This analogy was first logged as Convergence Log Entry 002; CFS-036 canonizes what it is an analogy* for*.)*

### The magic numbers as a worked example

The platform's own embedded heuristics — `scoreCapsule`'s `+10/+6/+4`, NBE weights, standing coefficients (CFS-035 §1) — are a live, small-scale instance. These are **uncaptured compressed reasoning**: they would **not** be surfaced if you distilled the repo into summaries, because they are not topical knowledge — they are reasoning that was performed once and frozen into a constant. Reducing them to a math (`Invariant → projection → weight/threshold/branch/ordering`) and then measuring *which* variables are invariant across intents and surfaces is a concrete demonstration of the compression this doctrine names.

---

## 8. On experiments — the seminar is not the delay

A closing methodological commitment, because the dialogue exposed it:

The Institute has a well-developed research capability. **Running experiments is cheap for us.** What is expensive is **the understanding of what we are running experiments to prove.** You cannot run an experiment until you understand the hypothesis you are trying to validate or falsify; if two parties test *different* hypotheses under the *same* protocol, even a perfectly executed experiment will not resolve the disagreement.

Therefore: converging on the correct **independent variable** before protocols are frozen is **part of the scientific process, not a delay to it.** We would rather spend another week converging on the hypothesis than months executing experiments that answer the wrong question. Once the independent variable is agreed (§3), protocol design becomes considerably simpler.

---

## Appendix — The external articulation (response to Austin)

Preserved as the canonical external-facing statement of this doctrine (companion to the internal canon above; mirrors the IRL-011 external-response pattern).

> **Austin,**
>
> This exchange has been extremely valuable because it exposed something more fundamental than a disagreement about experimental design: we are still converging on what the *independent variable* actually is. Before we freeze protocols, I'd like to clarify the hypothesis itself.
>
> **Three stages are being conflated.** (1) *Pre-prompt reasoning* — today dominated by context engineering (compressing knowledge) and prompt engineering (structuring instructions); we claim a third category, **invariant extraction**, whose objective is different: identify the minimal structural substrate already established through prior reasoning as sufficient for a class of intents. Context engineering compresses knowledge; prompt engineering compresses instructions; **invariant extraction compresses reasoning** — it reuses reasoning already performed and validated rather than re-deriving the same structural relationships from raw knowledge. (2) *Prompt representation* — everything ultimately reaches the model as serialized tokens; that is not controversial, but our claim is not about the serialization, it is about what happened *before* it. If two pre-prompt processes serialize to similar text, that does not imply they performed the same computation. (3) *Post-prompt inference* — only here does the model reason; the runtime, orchestration, standing, provenance, and governance largely operate around this lifecycle. Our work separates **structural** invariants (the scientific question) from **constitutional** invariants (how structural invariants evolve, are trusted, versioned, and become authoritative). The science does not depend on the runtime; the runtime operationalizes it.
>
> **This isn't "better context."** *Which wild cat left these traces?* One approach compresses all zoological knowledge into a good summary; another recovers and sequences DNA. Both are compressions — only one identifies the substrate that determines the organism. I'm not claiming intelligence has biological DNA; the point is that DNA is not a better summary, it is a fundamentally different representation because it captures the generative substrate from which the organism can be reconstructed. Our hypothesis is that intelligence may possess something analogous: a structural substrate more fundamental than topical knowledge. If it exists, reasoning over it is a different computation from reasoning over summaries, even if both produce text.
>
> **On experiments.** Running experiments is not our bottleneck — the platform supports hypothesis definition, protocol versioning, traceability, receipts, standing, projection, ratification, and replay. The expensive part is ensuring the hypothesis is correctly understood *before* experiments are frozen. If we're testing different hypotheses under the same protocol, even a perfect experiment won't resolve the disagreement. So I don't view these conversations as delaying experimentation — I view them as part of the scientific process. I'd rather spend another week converging on the correct hypothesis than months answering the wrong question.
>
> **The sharpest formulation.** Context engineering asks: *"Given an intent, what information should I provide?"* Invariant Intelligence asks: *"Given an intent, what reasoning should never need to happen again?"* That is a different optimization objective — the first optimizes information retrieval, the second optimizes computational reuse. If that framing survives scrutiny, the independent variable is neither prompts nor context: it is the reuse of previously validated reasoning through invariant structures. Everything else, including representation and runtime, exists to support that proposition.

---

## What this canonization did and did not do

- **Did:** canonize the taxonomy, the theorem, the tightened definition, the purpose statement, and the Representation Principle as `inv.epistemology.138`–`141` + `inv.reasoning.142`; preserve the external articulation; record the dialogue in the Convergence Log (Entry 007).
- **Did not:** claim empirical confirmation. 138 and 141 are *validated* (ratified as the programme's central, falsifiable claims), not *canonical*; their confirmation runs through the EXP-nnn lifecycle (CRP-002). Convergence and canonization of a definition are never a substitute for experimental result (CFS-019; Convergence Log honest limits).
