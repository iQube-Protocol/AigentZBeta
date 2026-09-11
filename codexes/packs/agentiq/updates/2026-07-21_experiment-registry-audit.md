# Experiment audit — every experiment now surfaces in Laboratory → Experiments

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** fix + audit
**Trigger:** operator noticed ISR-001 (and EXP-009/010) missing from IRL OS / metaMe IRL → **Laboratory → Experiments**.

## Root cause — two separate registries

The **Laboratory → Experiments** view (`components/composer/InvariantExperimentLab.tsx`) is
driven by **`EXPERIMENT_REGISTRY`** in `types/research.ts` — NOT by the `col_experiments`
markdown collection in `codexes/packs/irl/collections.json`. The Lab has a *completeness
guard* that auto-surfaces any registry member without a hand-built runner under a
"Registered — pending surface" section — but it only iterates `EXPERIMENT_REGISTRY`.

So an experiment with a design doc on disk but **no registry entry** is invisible in the
Lab. Five experiments were in that state: they had docs (and `col_experiments` entries)
but were never added to `EXPERIMENT_REGISTRY`.

## The audit (disk ↔ col_experiments ↔ EXPERIMENT_REGISTRY ↔ Lab)

| Experiment | doc on disk | col_experiments | EXPERIMENT_REGISTRY | Lab (before) | Lab (after) |
|---|---|---|---|---|---|
| EXP-001…006 | ✓ | ✓ | ✓ | ✓ hand-mounted | ✓ |
| EXP-007, EXP-008 | — (design only) | — | ✓ | ✓ design-panel | ✓ |
| **EXP-009** Constitutional Knowledge Evolution | ✓ | ✓ | ✗ | **✗** | ✓ |
| **EXP-010** Representation Gauntlet | ✓ | ✓ | ✗ | **✗** | ✓ |
| IRV-001, IPV-001 | ✓ | ✓ | ✓ | ✓ | ✓ |
| EXP-P1, EXP-P2, EXP-P3 | ✓ | ✓ | ✓ | ✓ | ✓ |
| **CCE-006** Capability Convergence | ✓ | ✓ | ✗ | **✗** | ✓ |
| **CCE-007** Reconciliation Loop | ✓ | ✓ | ✗ | **✗** | ✓ |
| **ISR-001** Invariant Software Reduction | ✓ | ✓ | ✗ | **✗** | ✓ |

(Note: there is no EXP-011 anywhere — the series currently ends at EXP-010 plus the
CCE / IRV / IPV / EXP-P / ISR lines. EXP-007/008 are registered design placeholders with
no doc yet — the inverse case, which is intended.)

## The fix

1. **`types/research.ts` — `EXPERIMENT_REGISTRY`**: added the five missing experiments,
   each with a real hypothesis, `protocolRef` to its on-disk doc, and **verified** governing
   invariant ids (all confirmed present in the seed crystal — no invented ids):
   - EXP-009 (`inv.epistemology.131/132`), EXP-010 (`inv.epistemology.132/133`, `inv.reasoning.085`),
     CCE-006 (`inv.cybernetics.108`, `inv.reasoning.311`), CCE-007 (`inv.cybernetics.108/109`),
     ISR-001 (`inv.reasoning.322/324`).
   - Added four series to `SERIES_REGISTRY`: **CKE** (EXP-009), **RGP** (EXP-010),
     **CCE** (CCE-006/007), **ISE** (ISR-001, the Invariant Software Engineering line).
   - The Lab's completeness guard now auto-surfaces all five under "Registered — pending
     surface" (visible + teed up), so they render in Laboratory → Experiments in **both**
     IRL OS and metaMe IRL.

2. **`tests/constitutional-contracts.test.ts`** — two guards:
   - The registry pin was **stale** (`['EXP-001'..'EXP-004']` while the registry held 13);
     updated to the full, ordered 18-entry list.
   - **New disk-parity canary**: every subdirectory under `experiments/` must map to an
     `EXPERIMENT_REGISTRY` id (derived from the dir prefix, e.g. `exp-p1-… → EXP-P1`).
     This is the reliability guard — a future experiment doc without a registry entry now
     **fails the build** instead of silently vanishing from the Lab.

## Result

Laboratory → Experiments is now a **complete, drift-proof view of every experiment** —
designed, executed, or pending a runner — so the pending/holdings perspective is reliable.
No production behaviour changed beyond the registry contents; ships with the normal dev push
(and appears once the per-commit pack-corpus blob for this build is live).
