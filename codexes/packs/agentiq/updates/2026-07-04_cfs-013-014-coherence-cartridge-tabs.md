# CFS-013 (Composition Laws) + CFS-014 / Law XIV (Constitutional Coherence) + Cartridge Visibility

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Builds on:** Law XIII + CFS-011/012 + video fix (same day).

## 1. CFS-013 — Invariant Composition Laws

The ontology defines operators, not just nouns: every invariant class obeys its own algebra of composition. Ratified table: semantic → **distributive** (round-robin) · narrative → **sequential** (proportional monotonic) · style → **global** (constant) · experience → **contextual** · reasoning → **causal** (dependency traversal) · engineering → **normative**. The completed trilogy: **Ontology defines meaning · Graph defines relationships · Composition defines computation** — ontology without composition is taxonomy; graph without composition is topology.

Constitutional requirement (future-proofing): future invariant classes shall define their composition law before canonical status — the Open/Closed Principle applied constitutionally (runtime closed, ontology open). **Code reflection:** `COMPOSITION_LAWS: Record<InvariantNamespace, CompositionLaw>` in `types/invariants.ts` — exhaustive over the namespace type, so a new class cannot compile without declaring its algebra. The brief generator is named for what it is: the first back-end of the **Invariant Compiler** (`Graph → Composition Laws → Target Medium → Artifact`).

## 2. CFS-014 + Law XIV — the Constitutional Coherence Engine

The fourth execution layer: independently composed invariant classes may each be perfect while the whole drifts — the failure lives in the *interaction*, not in any invariant. Coherence is a field over the complete experience, not a sum of layers. Knowledge composes locally; experiences succeed globally through coherence. What gets rendered is not knowledge but **experience** — which is why the runtime was always called an experience runtime.

**v1 implementation (`services/coherence/`)**, wired at the Composition → Rendering seam of the first compiled medium:
- `validateVideoBriefCoherence(brief)` — pure, synchronous, no I/O: semantic (guardrail integrity = error; coverage = score + warning), narrative (monotonicity/anchoring per CFS-012 §4; reorder = error), style (continuity-block carriage on template-composed prompts; LLM-composed prose left honestly unevaluated rather than false-negative matched).
- Experience + reasoning validators return `evaluated: false, score: null` with recommendations — **a stub that says "unevaluated" is constitutional honesty; a hardcoded 100 would be a Law XII violation** (score without validation). CCS = weighted mean over evaluated dimensions only; null when nothing is evaluatable.
- Fail-closed `pass` gate (any error-severity violation) per CFS-014 §7.
- `/api/video/invariant-brief` now returns `coherence` alongside the brief; the runner page renders the CCS strip (per-dimension scores, PASS/FAIL, violations) before the Generate step.
- Law XIV added to CFS-009; Law XIII gains the amendment note elevating the Constitutional Subject Model diagram as the canonical ordering (the Standing/Identity branches never collapse — that non-collapse is what makes anonymous constitutional participation possible). CFS-000 §6 updated to the quaternary (Ontology/Graph/Composition/Coherence). Seeded as invariants 068–071.

9 new coherence canaries (50 passing total).

## 3. Front-end visibility — root cause + fix

**Why nothing was visible in the cartridges:** the hand-curated AgentiQ and Polity Core cartridges (`data/codex-configs.ts`) surface pack collections only through explicitly wired `AgentiqCartridgeTab` tabs. All session docs were registered in the packs' `collections.json` but no tabs pointed at the new collections. Fixed:

- **Polity Core cartridge** → new **"Invariant Intelligence"** tab (order 0.5, right after Constitution) → the FCR at `constitutional-records/invariant-intelligence.md`.
- **AgentiQ cartridge** (memory group) → new **"Foundation"** tab (CFS-000..014 + Appendix A) and **"Experiments"** tab (EXP-001/002), after Updates.

## Where everything lives in the front end (post-deploy)

| Surface | What you see |
|---|---|
| Polity Core cartridge → **Invariant Intelligence** tab | The Foundational Constitutional Record |
| AgentiQ cartridge → **Foundation** tab | The full CFS bundle + Appendix A |
| AgentiQ cartridge → **Experiments** tab | EXP-001 artifacts + EXP-002 briefs |
| AgentiQ cartridge → **Updates** tab | All session records |
| `/admin/studio/invariant-video` | Live experiment runner: collection pickers → brief + CCS strip → real SkillVideoPlayer |
| APIs (personaFetch) | `/api/invariants`, `/api/invariants/graph`, `/api/invariants/collections`, `/api/ontology`, `/api/registry/invariant-qube`, `/api/consequence/run`, `/api/video/invariant-brief` |
| myLedger / receipts | invariant_* / knowledge_* / consequence_* receipts as they occur (DVN-anchored where applicable) |

**Not yet built (the visible gap that remains):** a browsing UI over the live invariant DATA — the 83 seeded invariants with their standing/reach/status, the ontology tree, the graph. Today that data is API-only. An "Invariant Registry" tab (list + filters by namespace/status, standing/reach columns, detail view with contexts + edges) is the natural next front-end build.

## Operator actions

1. No new migrations in this batch (CFS-013/014 are constitutional + code-level; the namespace migrations shipped earlier today).
2. Re-run the seed for invariants 068–071: `git pull && node scripts/ingest-canonical-invariants.mjs`.
3. After the dev deploy: Polity Core → Invariant Intelligence tab; AgentiQ → Foundation + Experiments tabs.
