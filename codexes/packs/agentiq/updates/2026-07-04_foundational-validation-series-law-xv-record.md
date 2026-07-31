# The Foundational Validation Series runs + Law XV — day record

**Date:** 2026-07-04 (second arc of the day, following the Phase 4/5 closure docs)
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Prior docs:** `2026-07-04_phase-4-runtime-adoption-grounding-return-arc.md`,
`2026-07-04_phase-5-measurement-cfs010-record.md`, `2026-07-04_cfs007-seam-knowledge-init-exp003.md`.

This doc records the experimental + constitutional arc that followed: the first two
Foundational Validation Series confirmations, one law, one constitutional principle,
one metric, and the first bug ever caught by the platform's own constitutional
validator.

## Experiments

### EXP-003 — Rediscovery Savings: run 1 CONFIRMED
venice/llama-3.3-70b, temp 0, 5 tasks, EXP-001's 18-invariant closure. 26.7% fewer
output tokens (every task individually cheaper), grounded share 78.4%→100%, canon
contradictions 2→0, 28 traceable citations vs 0. **Both cold contradictions occurred on
the reputation-vs-truth task — the exact conflation Law XII forecloses, rediscovered
unaided and eliminated by initialization.** Provider fallback (openai/venice) added to
the harness after an Anthropic credit block. Results:
`experiments/exp-003-rediscovery-savings/results-2026-07-04.json`.

### EXP-001 — Semantic Preservation: run 1 CONFIRMED (human-adjudicated)
New harness `scripts/evaluate-exp001.mjs` executes the evaluation protocol end-to-end
(~25 calls; string-aware JSON repair added after OSS-judge malformed output).
Adjudicated: consistency 1.83 (≥1.8), explainability 1.95 (≥1.6), artifact-attributable
hallucinations 0, coherence 2.00, constitutional restraint 15/15. Both machine flags
localized to the story artifact and dissolved under adjudication (one judge false
positive on the story's own C-020 sentence; one judge retrieval failure against the
story's C-021/C-022 line — scored against the run's consistency, not the artifacts).
14 of 18 invariants earned validation events; C-021/C-022 held back (rerun with a
stronger judge), C-024/C-059 need question-bank coverage (run 2). Results:
`experiments/exp-001-living-knowledgeqube/evaluation-results-2026-07-04.json`.

### EXP-002 — Temporal Preservation: composition + coherence half VALIDATED
The runner produced 4 distinct grounded segment prompts live (style identical,
narrative sequential), CCS 93.3 PASS — and the narrative warning was **a real defect,
caught by CFS-014 on its first production use**: the v1 proportional mapping dropped
the TERMINAL beat when beats > segments (5-beat arc over 4 segments never resolved).
Fixed same day (endpoint-anchored mapping; CFS-012 §4 amended per its own tuning rule;
canary updated). Final render blocked on Venice video credits — operator completes
tomorrow, expecting CCS 100.

## Constitution

- **Law XV — Compositional Fields** (CFS-009): every constitutional experience is the
  multiplicative composition of independently verifiable invariant fields; fields are
  locally independent, globally dependent; class-purity corollary (the Continuity
  Block's four families dissolve as classes are ratified — CFS-011 backlog). XV names
  the object, XIV the judgment. Discovered by the implementation teaching the theory.
- **Constitutional Evolution principle** (CFS-009, above the numbered laws):
  constitutional evolution occurs when the system detects a coherent pattern no
  individual field reveals and humans ratify it. First instance: Law XV itself —
  revealed by CFS-014, ratified same day. The validator did not legislate; it revealed.
- **CFS-006a §7 — the compositional grounding of consequence engineering:**
  consequences are emergent properties of interactions between fields; the 13-stage
  pipeline is the application layer over field composition (stages + pinned tests
  unchanged). The discipline restated: composing fields whose interaction reliably
  produces desirable consequences — architecture, not forecasting. The Registry stores
  stable fields; the recursion is what "a living constitution" means literally.
- **Constitutional restraint** (CFS-008 §2): fifth measure — the proportion of
  out-of-collection probes correctly returning NOT DERIVABLE; what the system *refuses
  to invent*. Run 1: 100%. Harness computes it natively from run 2.
- **CFS-008a** — the paper draft (v0.1): abstract → related work, the reasoning-debt /
  reasoning-capital terminology, the series diagram, compiled-not-authored, and the
  pipeline-is-the-constitution reading. Two series legs marked confirmed.
- **Seeds 072–077** ingested (89 total): Law XV trio + Constitutional Evolution +
  consequence-emergence + the consequence-engineering definition.

## New surfaces

- `POST /api/invariants/[id]/consequence` — admin-gated evolution events via
  `recordConsequence` (the manual evidence-entry point; used for EXP-001 flywheel
  closure via the documented console snippet).
- `scripts/evaluate-exp001.mjs` — the EXP-001 evaluation harness (provider-selectable,
  independence-defaulted to non-Anthropic judges).
- Law XV code canaries — no-field-is-inert tests pinning multiplicative composition.

## Open (operator-paced)

1. Verify the 14 flywheel validation events landed (Registry → Invariants → sort by
   Standing: the 14 at ≈16.7; or `/api/invariants/measurement`).
2. EXP-002 final render after Venice top-up (expect narrative 100 / CCS 100 post-fix).
3. EXP-001 run 2: stronger judge (gpt-4o-mini+), Q16/Q17 covering C-024/C-059.
4. Cross-model EXP-003 replication (openai; anthropic when credits allow).
5. Chapter-one write-up of the series once EXP-002's render lands.
