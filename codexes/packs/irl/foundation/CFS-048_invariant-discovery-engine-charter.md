# CFS-048 — Invariant Discovery Engine (IDE) Charter

**Status:** draft — RATIFY-BEFORE-BUILD (operator + Aletheon, 2026-07-20)
**Positions:** upstream of IRE (CFS-037) and IPE. Completes the upstream layer of the Invariant Intelligence architecture.
**Doctrine ratified here:** `inv.reasoning.334–339` (the discovery discipline — canonical). The engine's *efficacy* is a `proposed` hypothesis the experiments test.

---

## 1. The problem (the cold start)

The runtime pipeline — Intent → **IRE** (select relevant invariants) → **IPE** (project into iQubes/runtime) → Execution — carries a hidden assumption: **the invariants already exist.** The tool-calibration experiments (IRV/IPV) proved this holds only where a corpus was already curated: constitutional invariant selection scored ~0.57 vs experts because the polity corpus is rich; a cold domain (medicine) collapsed for lack of anything to compare against. Financial Services enters with ~10–15 baseline invariants — too thin to run experiments over.

**The missing primitive is upstream: how do invariants come into existence for a new domain?**

## 2. Name and stance — Discovery, not Generation

Per the thesis' strongest scientific position — **invariants are discovered, not invented** (`inv.reasoning.001` "Reasoning discovers invariants") — this is the **Invariant Discovery Engine (IDE)**, never a "generation engine." The IDE proposes **candidate** invariants from evidence; they become canonical only through the existing validation harness. Output is candidates, not truths.

## 3. What already exists (reconciliation — compose, don't fork)

The IDE is an **orchestration layer over primitives that already ship** — it is NOT a new engine. The single-invariant lifecycle is fully built in `services/invariants/lifecycle.ts`:

| PRD stage | Reuse the existing primitive |
|---|---|
| Candidate insertion | `discoverInvariant()` — inserts at status `proposed`, canonicalises the statement, detects duplicates, receipts `invariant_discovered` |
| Synthesis / compression | `mergeInvariants()` — the corpus-scale compression of overlapping candidates is exactly this at scale + `findDuplicates` |
| Validation | `validateInvariant()` (consistency/groundedness/form gate) **+ the experiment harness** (EXP-006 IPV, IRV, EXP-003 rediscovery/compression, EXP-001 judge) — the validation methods the PRD lists are already the built experiments |
| Canonical publication | `canonizeInvariant()` / `transitionInvariant()` on the `draft → proposed → validated → canonical` ladder (already enforced) |
| Standing / feedback | `recordConsequence()`, `recomputeStanding()`, `recordUsage()` |
| Canonical registry | `invariants` + `ontology_classes` + `invariant_contexts` tables; `canonical-invariants.seed.json`; the ingest script |
| Structural discovery seam | `services/invariants/perception.ts` — the CFS-035 "Field Extractor" already estimates field activation from raw input; its documented Gen-3 follow-on IS structural discovery |
| Runtime evidence loop | CFS-045 Memory Compilation (`memory_invariants`) already discovers per-persona "invariants that survived reasoning" — the IDE is the **domain-corpus analog**, and runtime memory becomes Stage-1 evidence |
| Resolution / Projection | IRE (`resolution.ts`), IPE (`projectionBridge.ts`), KRE (`knowledgeResolution.ts`), CFO (`engine.ts` field snapshot), CCR (`coordinates.ts`) — unchanged; the IDE feeds them |

**The IDE adds three genuinely new stages upstream of `discoverInvariant`: Evidence Collection, Candidate Extraction, and Synthesis — plus a Candidate Repository with provenance that sits *before* `proposed`.**

## 4. The five-stage pipeline

```
Domain → Evidence Collection → Candidate Extraction → Invariant Synthesis
       → Validation (existing harness) → Canonical Library (existing registry)
```

- **Stage 1 · Evidence Collection** — assemble domain artefacts with provenance metadata. New: `evidence_sources` table + ingestion service. No invariant without evidence (`inv.reasoning.335`).
- **Stage 2 · Candidate Extraction** — N discovery agents independently mine recurring structure ("what rules recur? what is stable across implementations?"). Output: candidate *patterns* with supporting evidence refs. New: extractor agents (compose the Model Router).
- **Stage 3 · Invariant Synthesis (compression)** — merge overlapping patterns into the smallest reusable statement (KYC/AML/CDD/Sanctions/Travel-Rule → "Financial actions require verifiable accountability"; settlement/double-entry/escrow/atomic-swap → "Value must remain conserved through state transitions"). This is the reasoning-compression act (`inv.reasoning.336`), implemented via `mergeInvariants` + an LLM synthesis step, landing candidates as `proposed` via `discoverInvariant`.
- **Stage 4 · Validation** — the **already-built** experiment harness: retrieval improvement, IRV stability, IPV reproducibility, compression measurement, perturbation, unseen-case prediction, cross-model agreement, expert comparison. `validateInvariant` gate + experiment receipts → `proposed → validated`.
- **Stage 5 · Canonical Publication** — `canonizeInvariant` → `validated → canonical`; only then visible to IRE.

## 5. Three discovery classes (the operator's structural-vs-constitutional insight, +1)

| Class | Looks for | Sources | Seam |
|---|---|---|---|
| **Constitutional** (normative) | obligations, permissions, prohibitions, rights, governance, accountability, authority, compliance | legislation, regulation, compliance manuals, standards, contracts, policy | new constitutional extractor over document evidence |
| **Structural** (descriptive) | conservation, dependency, sequencing, optimisation, stability, feedback, recursion | transaction graphs, execution/process logs, blockchain history, operational data | extend `perception.ts` Field Extractor → observation over data |
| **Experiential** (elicited) | "what mistakes always cause investigations?", "what never changes?" | practitioner elicitation | **synthetic expert ensembles first** (we lack real-expert scale short-term), later tested against real experts — same validation gate |

One normative, one descriptive, one elicited — together they estimate the complete invariant field. Financial Services is the ideal first domain precisely because it is **highly constitutional** (heavy regulation ⇒ dense constitutional invariants) **and** has **rich observable structure** (transaction/settlement data ⇒ structural invariants).

## 6. The self-improving loop (closes the scientific cycle)

```
Evidence → IDE → candidate invariants → Validation → canonical invariants
        → IRE → IPE → Runtime Behaviour → New Evidence ─┐
        └────────────────────────────────────────────────┘  (back into the IDE)
```

Every execution generates evidence that can challenge, refine, or strengthen the library. CFS-045 memory + DVN activity receipts + experiment results are the runtime evidence stream. The runtime does not merely *use* invariants — it *contributes to their discovery* (`inv.reasoning.339`).

## 7. Doctrine ratified now (canonical — how the Institute works)

These are method/governance doctrine (allowed canonical per the epistemic-honesty discipline), appended to the seed as `inv.reasoning.334–339`:

- **334** — Invariants are DISCOVERED from evidence, not generated; the discovery engine proposes candidates, never asserts truth (discovery-not-generation).
- **335** — Evidence-first provenance: no candidate invariant exists without traceable provenance to ≥1 evidence source.
- **336** — Discovery is a reasoning-compression problem: the objective is the smallest reusable explanatory structure across recurring patterns, not document summarisation.
- **337** — A candidate invariant is `proposed` until the validation harness supports it; only validated candidates become `canonical`. Discovery never bypasses validation.
- **338** — Invariants are discovered across three classes — constitutional (normative), structural (descriptive), experiential (elicited) — each subject to the same validation gate.
- **339** — The runtime is a discovery source: every execution produces evidence that can challenge, refine, or strengthen the invariant library (the self-improving loop).

The engine's *efficacy* — "the IDE builds high-quality libraries that improve downstream IRE/IPE" — is an **empirical hypothesis**, held `proposed`, and is exactly what the validation experiments test. It is NOT ratified here.

## 8. Phased build plan (each phase ratify-before-next)

- **Phase 0 (build-ready on ratification):** `evidence_sources` + `discovery_candidates` tables (candidate repo with provenance, sitting *before* `proposed`); one **constitutional** discovery agent over uploaded FS regulatory text; a **Discovery workspace** tab (Evidence Explorer + Candidate Explorer) in the *internal* IRL lab; candidates land via `discoverInvariant` as `proposed`; validation reuses the existing experiment harness. **Financial Services only.**
- **Phase 1:** synthesis/compression stage (`mergeInvariants` at corpus scale + LLM synthesis); provenance manager; validation queue UI.
- **Phase 2:** structural discovery arm (extend `perception.ts` over FS transaction/blockchain data).
- **Phase 3:** experiential arm (synthetic expert ensembles); human-in-the-loop curation (review/merge/edit/reject — never overwriting provenance).
- **Phase 4:** close the self-improving loop (runtime evidence → new candidates), domain-agnostic generalisation.

## 9. Non-goals

Runtime selection (IRE), projection (IPE), execution, and **automatic acceptance of candidates** are out of scope — validation stays a separate, non-bypassable process. The IDE never edits or overwrites provenance.

## 10. Success criteria

Construct high-quality candidate libraries from previously-unseen domains; reproducible discovery with complete provenance + receipts; **measurable improvement in downstream IRE performance** (the falsifiable claim); reduced manual curation effort; a repeatable discovery-to-validation workflow that grows the canonical corpus over time.

---

*Reconciled against: `services/invariants/{lifecycle,perception,resolution,projectionBridge,knowledgeResolution,engine,coordinates}.ts`; CFS-035 (Invariant Engine), CFS-037 (IRE), CFS-045 (Memory Compilation), CRP-003 (Financial Services domain). Ratify-before-build: no engine code lands until Phase 0 is approved.*
