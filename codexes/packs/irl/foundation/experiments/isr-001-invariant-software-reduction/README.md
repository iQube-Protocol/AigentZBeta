# ISR-001 — Invariant Software Reduction

**Chrysalis Foundation · Invariant Software Engineering research line · Experiment 1 · Status: DESIGN — pre-registration draft v0.1**
**Hypothesis class:** Structural / Capability applied to *software itself* (see `foundation/IRL_VALIDATION_ROADMAP.md` and the sibling `foundation/experiments/exp-p2-structural-invariance/README.md`).
**Constitutional anchor:** `foundation/CFS-033_constitutional-evaluation.md`; `foundation/CFS-037_invariant-resolution-engine.md` (Arm C), `foundation/CFS-039_invariant-projection-engine.md` (Arm D), `foundation/CFS-035_the-invariant-engine.md`. Tests the *proposed* hypotheses ISR-H1–H3 below; leans on `inv.reasoning.322` (value scales with relationships, not count — proposed), `inv.reasoning.323` (intelligence is a property of structured fields — proposed), `inv.reasoning.330` (an invariant is a transferable reasoning primitive — canonical), `inv.reasoning.324` (structural performance is provenance-independent — canonical).
**Owner:** The Invariant Research Lab. **This opens a new research line ("Invariant Software Engineering") — it is science about software, not a refactoring ticket.** Companion charter: `RESEARCH-LINE_invariant-software-engineering.md` (this directory).

## Designation note

ISR-001 is the **first experiment of a distinct research line**. Where EXP-P1/P2/P3 ask whether an invariant *field* carries reasoning capacity, ISR-001 asks whether an existing **software capability** has a *minimum sufficient causal structure* that can be derived from explicit invariants and re-projected while preserving what matters. It runs under the same rigour as the sibling experiments (pre-registration, hashed bundle, blind adjudication where a judgement is involved, variance bands, a signed interpretation table) but its object is code, its arms are build strategies, and its metrics are compression-and-preservation, not derivation accuracy. It is **not** a benchmark against any external optimiser and **not** a licence to reduce the live application (see §Risks & guardrails).

---

## Phase Zero — the observation that motivates the experiment (not the experiment)

The originating observation is a completed piece of production engineering: the **Amplify SSR bundle pruning** recorded in `codexes/packs/agentiq/updates/2026-07-21_pack-corpus-remote-store.md`. The AigentZBeta app repeatedly re-tipped Amplify Hosting's hard **230,686,720-byte (220 MiB) SSR compute-bundle ceiling**; the fix moved the ~5 MB, ever-growing pack-corpus markdown out of the traced Lambda bundle to a remote store (Supabase Storage + Autonomys AutoDrive), rewired every `.md` reader through a `packCorpusStore` seam, and stopped tracing `codexes/packs/**/*.md`. Earlier rounds pruned native binaries, swept source maps, and excluded `playwright-core`.

**Phase Zero is the informal case, not the formal experiment.** It reduced a real capability under a real ceiling and preserved behaviour (search still runs full-content, in-memory; the registry read path was provably untouched because it never read `.md` bodies). But it did so by *engineering intuition and conventional techniques* — dependency exclusion, tracing config, a body/metadata split — with **no explicit invariant model** of what the bundle's behaviour causally depended on. It is Arm B (conventional optimisation) run once, informally, on the whole app. ISR-001 formalises the question Phase Zero raised without answering: *did we remove exactly what was causally inessential, and could an invariant-guided reduction have gone further while proving preservation rather than asserting it?*

The lesson ISR-001 carries forward from Phase Zero (and from CS-001, the duplicate-capability defect class): reductions that are not derived from an explicit invariant set preserve behaviour **by luck and vigilance**, not **by construction**. The whole point of this experiment is to make preservation a derived property.

---

## The research question (verbatim, from Aletheon)

> "Can an existing software capability be reduced to a minimum sufficient causal implementation, derived from explicit invariants, while preserving required behaviour, governance/constitutional properties, and maintainability/evolvability?"

## Hypotheses (all `proposed` — epistemic honesty discipline)

Per the Institute's hard rule (CLAUDE.md "Hypothesis vs Canon"; `appendix-a_canonical-invariants.md`), every empirical claim ISR-001 exists to test enters and remains **`proposed`** until the experiment produces supporting evidence. None of these may be written into the canon as `canonical`.

- **ISR-H1 (minimum sufficient causal structure exists).** *`proposed`* — A software capability has a **minimum sufficient causal structure**: a subset of its code and dependencies that genuinely *causes* its required behaviour, below which behaviour collapses. (The software analogue of `inv.reasoning.322` — the value/behaviour rides a small causal core, not the bulk.)
- **ISR-H2 (invariants make the core derivable).** *`proposed`* — That causal core can be **derived from an explicit invariant set** for the capability (behavioural + constitutional + structural + evolution invariants), rather than found only by trial-and-error pruning. (The software analogue of `inv.reasoning.323`: structure, once made explicit, is what carries the capability.)
- **ISR-H3 (invariant-guided reduction dominates conventional reduction on preservation-weighted compression).** *`proposed`* — An invariant-guided reduction (Arm C) and an invariant-projected rebuild (Arm D) achieve **higher preservation-weighted compression** (Effective Invariant Compression, §Metrics) than conventional optimisation (Arm B) at equal or better behavioural preservation. Falsified if Arm B ≈ Arm C/D on Effective Invariant Compression.

**Null discipline (Principle 004 / CFS-033):** any of these coming out null is a *finding*, published as such. In particular, **Arm C/D ≈ Arm B on Effective Invariant Compression** would falsify ISR-H3 at current tooling maturity and reprice the "invariant software engineering" thesis to "conventional optimisation is already near the causal floor for this capability class." Pre-committed here, before data.

---

## The four invariant classes the reduction must preserve

These four classes are the **preservation contract**. A reduced form is only admissible if it holds all four; a single violated invariant should tank the composite score (hence the product form in BPS, §Metrics).

| # | Class | What it is | How it is captured for the target capability |
|---|---|---|---|
| 1 | **Behavioural invariants** | The capability's observable input→output contract. | The capability's existing test suite + a frozen golden-I/O set (the behavioural oracle). Every passing assertion is a behavioural invariant. |
| 2 | **Constitutional invariants** | Governance, identity-tier, access-gate, and receipt/provenance properties the capability must not break. | The constitutional canaries that already guard the capability's surface (e.g. T0/T1/T2 identifier discipline, access-gate presence, receipt honesty) + any relevant ratified invariants from the corpus. For a chosen *non-transactional* target, this class is deliberately light — which is the whole point of the low-risk scoping. |
| 3 | **Structural invariants** | The **minimum causal structure** — the dependencies and code paths that genuinely *cause* the behaviour (as opposed to those merely present). | The discovered causal cone: static import/callgraph reachability intersected with dynamic coverage under the behavioural oracle, expressed as an explicit dependency set. This is the object ISR-H1 claims exists. |
| 4 | **Evolution invariants** | The reduced form remains **as easy (or easier) to change/extend** as the original. | A pre-registered set of *change scenarios* (add a field, swap a provider, extend an output profile) scored for effort/blast-radius on the original vs each arm. Evolvability preserved ⇔ the reduced form does not make these scenarios harder. |

The corpus's own reflex applies: `inv.reasoning.008` (*proposed*) — "an invariant does not change with its domain; its context does" — is the reason a behavioural/constitutional invariant of the capability must survive every arm unchanged, even as the implementation context (bundle size, dependency set, code shape) changes around it.

---

## The four experimental arms

All four arms target the **same bounded capability** (§Candidate selection), start from the **same frozen baseline commit**, and are scored against the **same frozen preservation contract** (the four invariant classes above, hash-committed before any arm is built).

| Arm | What it is | How it is produced | Engine it leans on |
|---|---|---|---|
| **A — Existing implementation** | The baseline, as-is. The capability exactly as it ships at the frozen commit. | No change. Measured to establish the size/complexity denominator and to confirm the behavioural oracle passes at 100% on the untouched code. | None — this is the control. |
| **B — Conventional optimisation** | Reduction by standard technique with **no invariant model**: tree-shaking, dead-code elimination, dependency pruning, lazy-loading, body/metadata splits. The formalised, single-capability version of Phase Zero. | Apply conventional optimisers + hand-pruning guided only by static tooling and the test suite going green. No explicit causal invariant set is derived first. | None (deliberately) — this is the invariant-free baseline that ISCR isolates the invariant contribution *against*. |
| **C — Flattened software invariants** | Reduction **guided by an explicit, discovered invariant set** for the capability. The four invariant classes are made explicit first, then the implementation is flattened to the minimum structure that still satisfies them. | (1) **Discover** the capability's invariants via the Discovery/Resolution path: resolve the governing constitutional field for the capability's intent (`POST /api/public/irl/resolve`, CFS-037/IRE) and enumerate its behavioural + structural invariants from tests + the causal cone. (2) **Flatten** the existing code to the intersection of "reachable under the behavioural oracle" and "required by a resolved invariant" — removing what no invariant justifies. The original code is *reduced in place*, not rebuilt. | **IRE / Invariant Resolution** (CFS-037) — resolves *which* invariants govern the capability; the reduction is then the code those invariants demand. Validated instrument: `irv-001-invariant-resolution-validation`. |
| **D — Invariant-projected implementation** | A **from-scratch minimal causal build**: re-project the capability from its invariant set via the projection path, ignoring the original code's structure entirely. | Take the same resolved invariant set as Arm C and **project** it into a fresh implementation (the projector turns a field into behaviour/artifact). The original source is *not* consulted during the build — only its invariant set is. The projected build must then pass the identical behavioural oracle + constitutional canaries. | **IPE / Invariant Projection** (CFS-039/CFS-035) — projects a resolved field into an implementation; grounded artifact production via the AR/CPS seams (`runArtifact`, the CVR-003 grounding path referenced in EXP-P3 D3). Validated instrument path: `ipv-001-invariant-projection-validation`. |

**The load-bearing control (inherited from EXP-P2 §18):** Arms C and D must derive their invariant set from the **same frozen capability + the same behavioural oracle** that Arm A/B are measured against — never from a hand-authored spec written for the reduction, and never from a richer external source. Otherwise the comparison silently becomes *spec-vs-code* instead of *reduction-strategy-vs-reduction-strategy* of one fixed capability. This control is non-negotiable: it is what makes ISR-001 a software-*reduction* experiment rather than a rewrite experiment.

---

## Metrics

Every metric is computed per arm (B, C, D) relative to the Arm A baseline, on the **same frozen capability**, with the four-class preservation contract hash-committed before any arm is built.

### 1. Compression

Size/complexity reduction of the arm vs Arm A. Reported as a family, not a single number, because "size" is multi-dimensional for software:

- **Bundle bytes** — the arm's contribution to the traced SSR/compute bundle (the Phase-Zero currency; the metric the 220 MiB ceiling is denominated in).
- **Dependency count** — distinct third-party packages in the capability's dependency cone.
- **Source complexity** — LOC + cyclomatic complexity of the capability's own modules.
- **Causal-cone size** — nodes in the reachable-under-oracle dependency graph.

`Compression_x = 1 − (metric_x / metric_A)` per dimension; the headline compression is the bundle-bytes figure (Phase-Zero parity), the rest reported alongside.

### 2. Behavioural Preservation Score (BPS = B × C × R × E)

A **product** of four preservation factors, each in `[0,1]`. The product form is deliberate: a single violated invariant class drives its factor toward 0 and **tanks the composite**, so an arm cannot "buy" behavioural compression by sacrificing a constitutional property.

- **B — Behavioural preservation** = fraction of the behavioural oracle (test assertions + golden-I/O set) that still passes on the arm. A hard-required subset (the capability's contract core) must be 1.0 or the arm is **inadmissible** (B := 0).
- **C — Constitutional preservation** = fraction of constitutional canaries (identity-tier discipline, access-gate presence, receipt/provenance honesty) that still hold. Any violation of a paramount canary ⇒ C := 0 (inadmissible).
- **R — Robustness preservation** = the arm's behavioural pass-rate under a pre-registered **perturbation battery** (malformed inputs, boundary values, empty/oversized payloads, dependency-unavailable degradation) relative to Arm A's pass-rate on the same battery. Measures that the reduction did not remove defensive behaviour the contract implicitly relied on.
- **E — Evolvability preservation** = a `[0,1]` score over the pre-registered change scenarios: for each scenario, `1` if the arm makes the change no harder than Arm A (equal or smaller blast-radius / effort), scaled down for scenarios the reduction made harder. Blind-adjudicated where effort is judgemental (`evaluate-exp001.mjs --judge-config`, dual-run + hash-compared, per the sibling discipline).

`BPS = B × C × R × E`. BPS = 1 means the arm preserved everything the contract names; BPS = 0 means it violated at least one hard invariant.

### 3. ISCR — Invariant-Sufficient Compression Ratio

How much of an arm's achieved compression is **attributable to invariant-guided reduction**, isolating the Arm C/D contribution over the invariant-free Arm B. Definition:

```
ISCR_x = max(0, (Compression_x − Compression_B)) / Compression_x        for x ∈ {C, D}, when Compression_x > 0
```

ISCR ∈ `[0,1]`: the fraction of arm x's compression that Arm B (conventional, invariant-free) did **not** already achieve. ISCR ≈ 0 means invariants added nothing over conventional optimisation (evidence against ISR-H3); ISCR → 1 means the compression is overwhelmingly invariant-attributable. (Bundle-bytes compression is the canonical dimension for ISCR; report the dependency-count and causal-cone ISCR alongside.)

### 4. Effective Invariant Compression (the headline composite)

```
Effective Invariant Compression_x = ISCR_x × BPS_x
```

Compression that is both **invariant-attributable** (ISCR) and **actually preserves what matters** (BPS). This is the single figure ISR-H3 is scored on: an arm that compresses aggressively but breaks an invariant scores near 0 (BPS collapses); an arm that compresses only as far as conventional tooling already does scores near 0 (ISCR collapses). The thesis wins only when compression is simultaneously invariant-driven **and** preservation-safe.

### 5. Operational preservation

Build/deploy/runtime health of the arm, pass/fail with evidence: the arm **builds**, **deploys** (or is provably deployable — fits under the relevant size ceiling, the Phase-Zero constraint), and exhibits **runtime health** (no new errors/regressions on the capability's live surface in a shadow observation, CFS-017 discipline). An arm that improves Effective Invariant Compression but fails operational preservation is reported as *not yet shippable*, never as a win.

### 6. Robustness (behaviour under perturbation)

Reported both as the R factor inside BPS and as a standalone curve: the arm's behavioural pass-rate across the graded perturbation battery vs Arm A. A reduction that holds on the golden set but degrades faster under perturbation has removed load-bearing defensive structure — a structural-invariant violation that BPS's R factor is designed to catch.

**Statistics:** where a metric involves a judgement (E, and any usefulness scoring), use the sibling discipline — k reps, medians + bootstrap 95% CIs, blind dual-run judge with hash-compare, and the same signal threshold (non-overlapping CIs **and** a pre-agreed minimum median delta). Mechanical metrics (bytes, dep-count, LOC, pass-rates) are exact and reported verbatim with the frozen bundle.

---

## Candidate selection — the bounded, non-transactional target

**Operator guardrail (non-negotiable):** do **not** attempt to reduce the whole metaMe application. Isolate the experiment around **one bounded cartridge or workflow with good existing tests and LOW systemic risk** — a non-transactional IRL OS cartridge workflow, a canonical-plate workflow, or an internal reporting capability is safer than Passport, standing, or payments.

### AVOID list (explicitly out of scope for ISR-001)

- **Polity Passport** and any personhood/verification flow.
- **Standing / delegation** (`services/standing/*`, bounded-delegation, `DelegatedAuthority`).
- **Payments / QriptoCENT / MoneyPenny** and any fund-moving path.
- **The identity spine** (`services/identity/getActivePersona.ts`, `evaluateAccess.ts`, the T0/T1/T2 contract) — a break here compounds through every gate downstream.
- **The DVN pipeline** (`services/dvn/activityReceiptDvnPipeline.ts`, `services/ops/icAgent.ts`) — critical provenance infrastructure.

Anything on this list carries money, identity, or on-chain provenance on its critical path; a reduction defect there is a security or provenance incident, not a research null.

### Recommended primary candidate — the Canonical Plate manifest workflow

**`services/artifact/canonicalPlates.ts` + `services/artifact/publicationRegistry.ts` (+ the `constitutionalPublishingSystem.ts` type surface), canaried by `tests/canonical-plates.test.ts`.**

Why it is the strongest first target:
- **Good existing tests.** `tests/canonical-plates.test.ts` is a tight, deterministic canary that pins the seven plates, their CP-001..CP-007 ordering, the signature set, the composition model, and `buildPlateManifest`/`platesForPublication`/`signaturePlates`. It is a ready-made behavioural oracle.
- **Pure and self-contained dependency cone.** `canonicalPlates.ts` imports only a *type* from `constitutionalPublishingSystem`; `publicationRegistry.ts` imports only from those two siblings. No import of the identity spine, no DB, no network, no money, no receipts. The causal cone is small and fully static — ideal for cleanly measuring structural-invariant discovery (ISR-H1) without confounds.
- **No money/identity/receipts on the critical path.** The workflow encodes a *visual ontology* and composes publications from plates; a reduction defect changes which diagram a document cites, not who owns what or what moves. Constitutional-invariant load is genuinely light (the C factor is dominated by the plate-ordering/composition canary, not by access gates).
- **Non-transactional, deterministic, side-effect-free.** Every function is a pure mapping — the cleanest possible arena for Arm D (project the seven-plate ontology + composition rules from their invariants and check the projected build reproduces the canary byte-for-byte).
- **Real Phase-Zero lineage.** Plate/publication code is exactly the kind of corpus-adjacent, ever-growing artifact surface the Amplify pruning wrestled with — so a bundle-bytes compression result here is directly commensurable with Phase Zero.

### Alternate candidates

1. **The Findings Report composer** — `services/research/findingsReportComposer.ts` (pure `composeFindingsReport`) + `services/research/reportComposition.ts` (`buildFindingsGrounding`), canaried by `tests/findings-report-composer.test.ts` and `tests/report-composition.test.ts`. An **internal reporting capability** (exactly the operator-named safe class): deterministic composition of the research findings narrative in canonical series order, imports only `@/types/research` in its pure core, no money/identity. Slightly larger and with an impure DB-touching gather/persist tail (kept out of scope — reduce only the pure composition core). Strong second choice.
2. **The IRL research-overview projection** — `buildResearchOverview` (`services/research/publicReads.ts`), read by both `/api/research/overview` and the public `/api/public/irl/research-overview`. A **non-transactional IRL OS reporting workflow**: it projects the experiment/series registry with lifecycle *derived* from the canonical record. Persona-gated but T2-safe by construction. Good third choice; its read/projection shape makes the causal cone slightly larger than the plate workflow's.

### Selection rationale summary

Rank by the intersection of (good tests) × (self-contained causal cone) × (no money/identity/receipts on the critical path) × (deterministic/pure). The **Canonical Plate manifest workflow** wins on all four with the smallest, purest cone; the **Findings Report composer** and **research-overview projection** are the internal-reporting alternates the operator's guidance names, held in reserve if the plate workflow proves too small to exhibit a measurable compression floor (a legitimate scale caveat, §Honest limits).

---

## Experimental protocol

1. **Freeze.** Pick the target (recommended: the Canonical Plate manifest workflow) at a fixed commit. Freeze and hash-commit: the source of the capability's own modules, the behavioural oracle (its test file + a golden-I/O set), the constitutional canary set, the perturbation battery, and the change-scenario set (evolution invariants). This bundle is the preservation contract; it is sealed before any arm is built (EXP-009 freeze-field discipline).
2. **Discover the invariant set (Arms C/D input).** Resolve the capability's governing field via the IRE (`POST /api/public/irl/resolve`) and enumerate the four invariant classes from the frozen oracle + the statically+dynamically measured causal cone. Run the discovery ≥2× independently (Independence Protocol) and record convergence — an internal check that the invariant set is *discovered*, not authored. Hash-commit the invariant set.
3. **Build the arms.** A = untouched (confirm oracle 100% pass). B = conventional optimisation, no invariant model. C = flatten the original code to the invariant-justified causal core (IRE-guided). D = project a fresh build from the invariant set (IPE/`runArtifact`-grounded), original source not consulted.
4. **Score.** Run the frozen oracle + canaries + perturbation battery against each arm; compute Compression (all dimensions), BPS = B×C×R×E, ISCR, Effective Invariant Compression, operational preservation, and the robustness curve. k reps for judgemental factors; medians + bootstrap CIs; blind dual-run judge for E.
5. **Adjudicate against the signed interpretation table** (below), then publish.

### What "success" looks like

- **ISR-H1 supported** if a causal core exists whose removal-below-threshold collapses the behavioural oracle (a compression floor, the software K*), and that floor sits materially below the Arm-A footprint.
- **ISR-H2 supported** if Arms C/D's invariant-derived reductions reach at/near that floor *by derivation* (with BPS = 1), not by trial-and-error.
- **ISR-H3 supported** if Arm C and/or D beat Arm B on **Effective Invariant Compression** with non-overlapping CIs and ≥ the pre-agreed median delta, at BPS ≥ Arm B's.
- **Headline win:** an arm that ships (operational preservation pass) with higher Effective Invariant Compression than conventional optimisation and BPS = 1 — compression that provably preserved every invariant class.

### Falsification conditions (pre-committed)

- **ISR-H3 falsified** if Arm B ≈ Arm C/D on Effective Invariant Compression (invariants add nothing over conventional optimisation for this capability class at current tooling maturity). Published as a null; the thesis reprices to "conventional optimisation is already near the causal floor here."
- **ISR-H1 falsified** if no compression floor is found — behaviour degrades smoothly with any removal, with no identifiable sufficient core (no minimum causal structure at this capability's scale).
- **Any arm** that reaches high Compression only by dropping BPS is not a partial win — the product form makes it a **preservation failure**, reported as such.
- **Scale null:** the plate workflow proving too small to exhibit a measurable floor is a *scale-bounded* null (re-run on a Findings/overview alternate), not a refutation of the thesis.

---

## Relationship to the sibling experiments and the engines

- **To EXP-P2 (Structural Invariance) — the closest conceptual sibling.** EXP-P2 asks whether an invariant *field extracted from a knowledge corpus* carries reasoning capacity the raw corpus does not. ISR-001 asks the **software-substrate analogue**: whether an invariant set extracted from a *software capability* captures its minimum causal structure well enough that a reduction/re-projection preserves behaviour. EXP-P2's K* (minimal-sufficiency floor, B2) is the direct analogue of ISR-001's software compression floor; EXP-P2's structural-role ablation (B3 — reasoning rides structure, not bulk) is the analogue of ISR-001's robustness/causal-cone result (behaviour rides the causal core, not the code bulk). A supported ISR-H1 is EXP-P2's `inv.reasoning.322`/`.323` claims instantiated on code rather than knowledge. Neither result may be cited as evidence for the other — they are separate objects under one thesis.
- **To the Discovery / Resolution / Projection trilogy.** ISR-001 is a *consumer* and *validator-in-use* of the engine stack. Arm C leans on the **Invariant Resolution Engine** (CFS-037) to resolve *which* invariants govern the capability; Arm D leans on the **Invariant Projection Engine** (CFS-039, the renamed CFS-035) to *project* the resolved set into a fresh implementation. Their instruments were validated first — `irv-001-invariant-resolution-validation` (IRE stability) and `ipv-001-invariant-projection-validation` (IPE reproducibility) — exactly so a surprising ISR-001 result can be attributed to the science, not an immature engine (the Stage-0-before-science discipline). ISR-001 respects the "IPE never resolves" contract (CFS-039 §3): Arm D projects the field Arm C's resolution produced; it does not re-resolve.
- **To CFS-034 (the Research Progression Ladder).** ISR-001 is the first rung of the Invariant Software Engineering line's laddering: an instrument-in-use demonstration that produces evidence (Analyst/Associate-grade contribution) which, if it supports ISR-H1–H3, is proposed upward through the ratification process — never auto-canonised (§Governance in the research-line charter).

---

## Risks & guardrails

- **Do not reduce the whole app.** ISR-001 is scoped to ONE bounded, non-transactional capability. The AVOID list (Passport, standing/delegation, payments/QriptoCENT/MoneyPenny, the identity spine, the DVN pipeline) is out of scope for the entire Invariant Software Reduction line's first phase, not just this experiment. A reduction defect on any of those is a security/provenance incident.
- **The frozen files are read, not written.** ISR-001 is a docs-first charter. When it is *run*, Arms B/C/D are built in an isolated experiment workspace against a frozen copy of the target — the live production modules are never mutated by the experiment. Reductions are proposed, evidenced, and only then (separately, under normal review) considered for adoption.
- **Constitutional canaries are hard gates, not soft scores.** For any target, the C factor treats a paramount-canary violation as inadmissible (C := 0). Even on a deliberately light-constitutional target like the plate workflow, the plate-ordering/composition canary and any T2-safety property must survive every arm.
- **Preservation must be derived, not asserted (the CS-001 lesson).** The experiment's value is precisely in *proving* preservation via the four-class contract rather than trusting that green tests imply safety — the failure mode Phase Zero and CS-001 both illustrate.
- **Scale honesty.** A null on a very small target is scale-bounded; state it as such and re-run on a larger alternate before drawing a thesis-level conclusion.

---

## Result-submission path (CFS-042)

ISR-001 results publish through the **same canonical, receipted pipeline** as every other experiment. Phase 1 (internally executed) publishes via the admin door `POST /api/experiments/results`; Phase 2 (passport-delegated external submission) publishes via `POST /api/experiments/results/external` under a Polity Passport + bounded `DelegatedAuthority` + an authorized x409 Constitutional Agreement, `origin:'external'`, honestly labelled `independently submitted` vs `internally executed` (CFS-042 §2, §7). **Prerequisites (resolved 2026-07-21):** (a) the `experiment_results` DB CHECK — the accurate gate — was widened to accept `ISR-[0-9]{3}` (migration `20260721010000_experiment_results_allow_isr_cce.sql`; the internal admin route is shape-gated by regex, NOT an enumerated allow-list, so no route change was needed there); (b) `PublishableExperiment` (`services/experiments/publishResult.ts`) + `EXTERNAL_EXPERIMENTS` (the CFS-042 delegated door) now include `ISR-001` so the Threshold's `submit_review` can publish an ISR-001 result. Verification stays trustless: anyone recomputes sha256 over the verbatim results JSON and compares to the anchored hash; external origin changes *who wrote it*, not *how it is verified*.

---

## Reuse / build surface

- **Reuse (built):** `POST /api/public/irl/resolve` (IRE resolution, Arm C), the `runArtifact`/CVR-003 grounding path (Arm D projection), `evaluate-exp001.mjs --judge-config` (blind dual-run judge for the E factor + usefulness), the `experiment_results` + DVN publication path, the EXP-009 freeze fields, the validated instruments (`irv-001`, `ipv-001`). The target's own test file is the behavioural oracle (e.g. `tests/canonical-plates.test.ts`).
- **Build (new, composes on the above):** a **causal-cone extractor** (static import/callgraph ∩ dynamic coverage under the oracle → the structural-invariant set); the **golden-I/O freezer** for the target capability; the **perturbation-battery** runner (R factor); the **change-scenario** harness (E factor); the **compression meter** (bundle-bytes / dep-count / LOC-complexity / cone-size per arm); and the **BPS / ISCR / Effective-Invariant-Compression** scoring module + the shared bootstrap-CI stats module (also used by EXP-P1/P2).

---

## Interpretation table (signed before any run)

| Outcome | Agreed interpretation |
|---|---|
| Arm C/D **> Arm B on Effective Invariant Compression**, BPS = 1, operational pass | **ISR-H3 supported at current scale.** Invariant-guided reduction achieves preservation-safe compression conventional optimisation does not. First evidence for Invariant Software Engineering. |
| A compression **floor (software K\*)** found, materially below Arm A, reached by derivation (Arms C/D) | **ISR-H1 + ISR-H2 supported.** Software has a minimum sufficient causal structure derivable from its invariants — the line's founding claims instantiated on code. |
| Arm B ≈ Arm C/D on Effective Invariant Compression | **ISR-H3 falsified at current scale.** Conventional optimisation is already near the causal floor for this capability class; invariants add no *compression* value here (they may still add *provenance* value — report separately). Published as a null. |
| High Compression but BPS < 1 on any arm | **Preservation failure, not a win.** The product form flags it; the reduction removed a load-bearing invariant. Names *which* class broke (B/C/R/E). |
| Arm D reproduces the frozen oracle byte-consistently from invariants alone | **Projection sufficiency** — the invariant set fully captured the capability (strong ISR-H2 evidence; the software analogue of IPV reproducibility). |
| No floor found (smooth degradation) | **ISR-H1 not supported at this target's scale** — no identifiable sufficient core. Re-run on a larger alternate before repricing the thesis. |

---

## Honest limits

- **Nothing here is built.** This is a design / pre-registration charter (the ratification gate). The engines Arms C/D lean on are themselves DRAFT/validated-as-instruments, not production-authoritative — a surprising result must be diagnosed as engine-vs-science (the reason `irv-001`/`ipv-001` ran first).
- **Scale caveat.** The recommended target is deliberately tiny (a pure, seven-node ontology workflow) to make the causal cone clean; it may be *too* small to exhibit a measurable compression floor. A null there is scale-bounded — re-run on the Findings/overview alternate. The purity that makes it a clean arena also caps how much there is to compress.
- **Extraction dependence.** Arms C/D depend on the documented discovery procedure; the procedure is itself an experimental artifact and must be published + hash-committed, or ISR-H2 is unfalsifiable (the EXP-P2 B1 discipline).
- **Same-capability control is the whole experiment.** Any leak of an out-of-band spec into Arms C/D voids the comparison (it becomes rewrite-from-spec, not reduce-from-invariants). Attest and audit.
- **Not a benchmark.** ISR-001 does not compare against any external optimiser or framework; an off-the-shelf bundler beating all arms on raw bytes is irrelevant to the *preservation-weighted* question.
- **Adoption is separate.** A winning arm is *evidence*, not a merge. Adopting a reduced form into production is a separate, normally-reviewed change under the repo's discipline — never a side effect of the experiment.

---

## Ratification record

- [x] **DESIGN drafted 2026-07-21** by operator direction (Aletheon's Invariant Software Reduction question; Phase Zero = the Amplify SSR pruning, `agentiq/updates/2026-07-21_pack-corpus-remote-store.md`). **Operator-ratified 2026-07-21.**
- [x] Target selected + frozen (Canonical Plate manifest workflow); behavioural oracle + constitutional canary + perturbation + change-scenario sets sealed and hashed — see `STAGE-0_freeze-and-invariant-discovery.md` (bundle `b3f7e135…` at commit `03f4610e`).
- [x] Invariant set discovered + hash-committed; four-class preservation contract signed — pass 1 (`STAGE-0_…`) + **independent blind pass 2 converged** (`STAGE-0b_discovery-convergence.md`, 2026-07-21). Pass 2 sharpened the structural core (`kind` fully inert; `id` inert-but-oracle-pinned) and caught a stale oracle assertion — the oracle was corrected (pin the max+1 rule) and the bundle re-frozen (`7f8d0843…`).
- [ ] Arms A/B/C/D built in an isolated workspace; scoring module + bootstrap-CI stats built.
- [ ] Predictions locked; interpretation table signed; pre-registration bundle hashed + published.
- [ ] `EXPERIMENTS` allow-list + `publishResult` union widened to include `ISR-001` (CFS-042 §8 prerequisite).
- [ ] Runs executed; results published hash-consistent with the bundle (Phase 1 admin door, or Phase 2 passport-delegated per CFS-042).
