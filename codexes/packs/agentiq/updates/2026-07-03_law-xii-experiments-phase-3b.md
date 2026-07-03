# Law XII + Flywheel Experiments + Phase 3b Chain Deployment

**Date:** 2026-07-03
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Builds on:** Phase 1 substrate (seeded live — 59 invariants planted), Phases 2–3.

## 1. Law XII — Truth, Standing and Reach (CFS-009 amendment, ratified)

Canon: Law XII + three corollaries (Domains of Applicability, Constitutional Evolution, Constitutional Responsibility) in CFS-009, plus **the canonical paragraph** (also in CFS-000a):

> Information becomes knowledge through reasoning. Reasoning discovers invariants. Validation establishes their standing. Civilization advances by preserving, composing, and extending them.

**Code reflects the constitutional text** (migration `20260703230000_law_xii_truth_standing_reach.sql`):
- `invariants.reach` column (0–100) — the adoption dimension, with backfill splitting adoption out of standing
- `computeStandingScore` now validation-class only (`times_validated`, `times_contradicted`); new `computeReachScore` adoption-class only (`times_referenced`, `times_used`) — orthogonality pinned by canaries
- `epistemic` semantic type ratified (CHECKs + TS union)
- Appendix A/seed: inv.constitutional.**060–062** (proposed as INV-055–057; renumbered — ids taken, append-only rule). Seed is now 62 invariants; **re-run `node scripts/ingest-canonical-invariants.mjs` after applying the migration** to plant them.

## 2. EXP-001 — The First Living KnowledgeQube (`foundation/experiments/exp-001-living-knowledgeqube/`)

Domain: the Constitutional Internet (18-invariant collection). Four renderings from the same collection — canonical article, structured report, narrative story ("The Weight of a Name"), infographic spec — every claim carrying inline `[C-NNN]` grounding markers (explainability by construction). Plus the evaluation protocol: independent-model question bank (12 derivable + 3 hallucination probes), 4-metric rubric (consistency / explainability / hallucination / coherence), optional ungrounded control, and flywheel closure (confirmed answers → `recordConsequence('confirmed')`).

## 3. EXP-002 — Invariant-Carried Video (`foundation/experiments/exp-002-invariant-video/`)

Verified capability envelope: generations ≤12s; stitcher 2–3 clips/pass → **24s in one pass, 48s via two-pass hierarchical stitch** (12+12→24 ×2, then 24+24→48). Briefs: 24s "The Weight of a Name" (2 segments, loss/restoration, same invariants, varied prose, shared continuity block + bridge frame) and 48s "The Constitutional Internet" (4-segment progressive arc: Person → Delegation → Standing → Truth), each with per-segment prompts, invariant maps, production plans, and acceptance checks.

## 4. Phase 3b — the operating model on the chain dispatcher

- `services/intentChains/templates/consequence-operating-model.v1.json` — preflight rpc → disposition branches (`deny`/`ask` terminate; `act` → flywheel; default/escalate → human `approve` step) → flywheel rpc. Validates clean against the chain registry validator (pinned in tests).
- `POST /api/consequence/steps` — chain-facing adapter (auth: `X-Chain-Orchestrator-Token`, per the advancer's server-to-server rpc contract): `phase=preflight` runs the pre-approval pipeline; `phase=flywheel` executes + evolves. Emits the new `consequence_preflight_completed` / `consequence_flywheel_completed` orchestration events with `metadata.chain_id` so the listener advances the chain and folds T1-safe products (disposition, invariant ids, risk score, forecast rationale) into chain context.
- Runner receipts are actor-optional: chain mode passes `actor: null` (chain layer emits its own step receipts; only the T2 alias commitment travels).
- **EXP-002 hook:** dispatch the chain with `intentRef` = the video brief; preflight grounds it in KnowledgeQube 001, approval gates production, the flywheel records the observed outcome against the grounding invariants.

## Tests

30 passing (19 substrate incl. Law XII orthogonality canaries; 11 pipeline incl. template validation + gate pinning).

## Operator actions

1. Supabase SQL editor: apply `supabase/migrations/20260703230000_law_xii_truth_standing_reach.sql`.
2. Re-run the seed to plant 060–062: `git pull && node scripts/ingest-canonical-invariants.mjs`.
3. Set `ORCHESTRATOR_SERVICE_TOKEN` in the deploy environment if not already set (required for chain rpc auth to `/api/consequence/steps`).
4. EXP-001: create the 18-member collection + publish the InvariantQube (steps in the experiment README), then run the evaluation with an independent model.
5. EXP-002: generate segments from the briefs, stitch per the production plans.
