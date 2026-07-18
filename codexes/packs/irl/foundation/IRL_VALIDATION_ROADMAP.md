# IRL Validation Roadmap v1

**Date:** 2026-07-17 · **Status:** active frame for the experimental programme

The Institute has crossed a threshold. With **321 canonical/proposed invariants** across constitutional, economic, governance, experience, embodiment, and reasoning domains, and a live instrument (IRL OS + AgentiQ OS) capable of running controlled experiments against them, the bottleneck is no longer *"how do we explain this?"* but *"which experiments best isolate the claims?"* The papers are no longer the product — they are the documentation of an experimental engine.

This roadmap keeps the experiments **orthogonal by hypothesis class** so that no single experiment is asked to answer multiple questions at once — the recurring source of confusion the programme has now outgrown.

---

## The governing discipline: every experiment declares its hypothesis class

No experiment may silently become a proof of another class's claim. Each pre-registration protocol declares exactly one:

| Hypothesis Class | Answers | Audience | Success ≠ |
|---|---|---|---|
| **Comparative** | Does the approach outperform an equal-budget alternative under external controls? | Investors, engineers, reviewers | …a proof of the substrate |
| **Structural** | Can the claimed structure be discovered/validated/reused *independently of prompt & context engineering*? | The Institute (science) | …a benchmark win over a frontier model |
| **Capability** | What becomes *practical* that wasn't, once reasoning is reusable? | Investors, operators | …a validation of the substrate (it *assumes* it) |
| **Governance** | Do the constitutional lifecycle/gates behave as specified? | Operators, compliance | …a capability demo |
| **Operational** | Does the instrument itself measure faithfully (harness integrity)? | The lab | …a result about the object under test |
| **Replication** | Does an independent party reproduce a prior result from the published bundle? | Everyone | …a new claim |

*A Comparative experiment cannot accidentally become a proof of Structural Invariance. A Structural experiment does not need to beat GPT-5 to be valuable. A Capability experiment does not need to validate the substrate — it demonstrates what the validated substrate enables.*

---

## Stage 0 — validate the instrument first (IRV-001 · IPV-001)

Before any science, the newly-introduced **IRE** (Invariant Resolution Engine) and **IPE** (Invariant Projection Engine) get an engineering shake-down — flight-testing the aircraft before inviting observers aboard. This is hypothesis-class **Operational**: it scores the *engines*, not LLM task performance, and its results are calibration, not claims.

- **IRV-001 — Invariant Resolution Validation** (`experiments/irv-001-invariant-resolution-validation/`): does the IRE resolve a sensible, **stable, reproducible** governing-invariant field? Measured against a **Synthetic Expert Baseline (SEB)** — LLM expert personas that independently name a task's load-bearing properties (never using the word "invariant"), consensus-aggregated, then mapped against the IRE field for coverage / compression / novelty. **The SEB is explicitly NOT a Delphi study** (correlated models, not independent humans); it is engineering calibration, human validators a later upgrade.
- **IPV-001 — Invariant Projection Validation** (`experiments/ipv-001-invariant-projection-validation/`): are the IPE's projections exactly **reproducible** across repeated runs on the frozen substrate?

This decomposes the whole pipeline so **every transition is measurable**:
```
Experience → Synthetic Expert Extraction → IRE → IPE → Runtime → LLM
                       └──── IRV-001 ────┘ └IPV┘
```
Runner: `scripts/run-instrument-validation.mjs` (public `/api/public/irl/resolve` for IRE/IPE, one provider key for the personas + judge). Both are **runnable now** — they need no external sign-off. Passing Stage 0 lets us honestly tell an external reviewer *"the engineering validation completed before the science began"*, and — if a later science result surprises — distinguishes an immature engine from a real finding.

## The three programmes (running now)

### Programme A — External Comparative Validation · **EXP-P1** (Austin protocol)
**Class:** Comparative. **Owner:** external protocol (Austin Ambrozi / Autonomi Solutions), joint sign-off.
**Question:** Does invariant representation + runtime provide measurable benefit beyond conventional context engineering, at equal token budget, under externally specified controls?
The disciplined, pre-registered, hash-committed four-arm gauntlet (Cold / Expert-Prose / Flattened-Invariants / Full-Runtime) + generative-sufficiency probe + mutation probe. Value is **external credibility** regardless of outcome, precisely because the protocol is externally specified and its interpretations are signed before data exists. Run substantially as specified.
*Explicitly does NOT test IRL's primary structural hypothesis — its own §1 says so.*

### Programme B — Structural Invariance Validation · **EXP-P2** (IRL companion)
**Class:** Structural. **Owner:** the Institute.
**Question:** Can structural invariants be discovered, composed, and reused as a reasoning substrate **independently of prompt engineering and context engineering**?
Where the science lives: raw-corpus → invariant extraction, invariant-field formation, minimal sufficiency, reasoning ablation, projection (K*), structural convergence, causal-vs-correlated properties. **No Austin comparison — this is science, not benchmarking.** The one control it must not miss (EXP-P1 §14): the invariant substrate must be extracted from the *same corpus* the raw arm uses, or the comparison silently becomes corpus-vs-corpus. This is the programme that tests **`inv.reasoning.323`** (intelligence as a property of fields, not models).

### Programme C — Capability Validation · **EXP-P3**
**Class:** Capability. **Owner:** the Institute (demonstrations, using live IRL OS + AgentiQ OS).
**Question:** What new capabilities become *practical* because reasoning has become reusable structural invariants?
Demonstrations, not proofs: consequence engineering, forecasting, finance, software engineering, legal reasoning, scientific discovery. The point shifts from *"does it work?"* to *"what becomes possible that wasn't previously practical?"* — the evidence investors remember.

---

## The phased roadmap

```
Phase 0 — Foundations                         [COMPLETE]
  ontology · constitutional model · invariant formalism ·
  runtime · corpus (321) · instrumentation (registry, standing,
  projection, graph, shadow mode, authoritative flip, health,
  persisted observations)
        │
        ▼
Stage 0 — Instrument Validation               [NOW]   IRV-001 · IPV-001
  validate the IRE + IPE ENGINES before they carry any science
  (calibrate the telescope before observing) — engineering, not
  scientific: stability · reproducibility · sensible slices ·
  no pathologies. IRV-001 uses a Synthetic Expert Baseline (SEB,
  NOT a Delphi study). Clears the instrument for Phase 1+.
        │
        ▼
Phase 1 — External Validation                 [NEXT]  Programme A · EXP-P1
        │  run Austin's protocol · publish either way
        ▼
Phase 2 — Structural Validation               [NOW/NEXT]  Programme B · EXP-P2
        │  discover/validate the substrate itself
        ▼
Phase 3 — Capability Validation               [SOON]  Programme C · EXP-P3
        │  demonstrate what the substrate enables
        ▼
Replication      independent parties re-run from the published bundle
        │
        ▼
Publication      pre-registered, dual-run, hash-committed evidence
```

**Sequencing discipline (Aletheon):** run **one** strongest experiment per class rather than five overlapping ones. Three experiments, three questions, three kinds of evidence — a cleaner narrative than five that overlap.

---

## The relationship with external reviewers

Austin has become an **independent protocol designer** — enormously valuable, and a distinct role from hypothesis authorship. The division:

- **The Institute owns the hypotheses** (what is being claimed and tested).
- **External reviewers harden the validation methodology** (design experiments a sceptical third party would accept).

You do not want an external reviewer designing your science; you do want them designing experiments whose controls a sceptic cannot dismiss. EXP-P1 is exactly that — bank it as the credibility asset. EXP-P2 is the Institute's own.

---

## Independent execution — the replication contract (Austin's requested capability)

Austin's agent asked for the ability to **re-run any arm and the judge without IRL mediation**. The programme treats this as a first-class requirement (EXP-P1 §11, §13; CFS-033 distributed replication). The contract:

1. **Fetch the frozen inputs, no credentials:** the crystal snapshot + the fixed Arm-C slice + the pre-registration bundle are published read-only through the **IRL OS public routes** (`/api/public/irl/invariants`, `/api/public/irl/invariant-field`, and the published bundle URL) — anonymous-safe, T2-only, no persona token. The external party fetches the identical bytes IRL used.
2. **Run the judge with their own config:** the evaluation harness accepts an external `--judge-config <file>.json` (hash-committed at freeze); either party runs the full output set independently and the two score files are **hash-compared** (divergence beyond rounding → joint harness inspection *before* results are read — instrument integrity first, per Principle 004).
3. **Verify against the hash-committed bundle:** every published artifact (prompts, outputs, judge scores, selection logs, mutation artifacts, analysis scripts) is hash-consistent with the pre-registration bundle; any party can recompute the hashes. Nothing is quotable externally except against the published dataset.
4. **Honest labelling:** if independent re-run is not technically supported for any component, that component's results are labelled *internally executed* in all reporting — never presented as independently verified.

The IRL OS cartridge is the delivery surface: its **Constitutional Evaluation** tab is the external front door (the pre-registration protocols + bundle hashes), **Records & Findings** publishes results hash-consistent with the bundle, and the public Invariant Registry + Field Explorer let the external party inspect the exact substrate an arm grounded against.

---

## The deeper claim this programme is uncovering

The scientific novelty is not ultimately *"we have better context"* or even *"we have reasoning compression."* It is **`inv.reasoning.323`**: intelligence is a property of structured invariant fields and the transformations between them, and models are one mechanism for traversing those fields — not the field itself. That is a far larger hypothesis than anything about prompt or context engineering, and — for the first time — it is empirically testable, because there is now both a sufficiently rich invariant corpus and an instrument capable of running controlled experiments against it. EXP-P2 is where that test begins.

## Related canon
- `inv.reasoning.322` — value scales with relationships, not count (the library→field shift).
- `inv.reasoning.323` — intelligence is a property of fields, not models (the central hypothesis, proposed/under-test).
- `inv.reasoning.310–321` — the Knowledge Compression genesis (`GENESIS_knowledge-compression.md`).
- CRP-002 — the Three Computational Compressions.
- CFS-033 — Constitutional Evaluation (the experimental operating system: pluggable, receipted, versioned evaluation + distributed replication).
- CFS-035 — the Invariant Engine.
