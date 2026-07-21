# Commit Brief: `c2f7076` — Build CCRL Phase E counterfactual slice: pure what-if projection over the invariant field (pre-ratification decision support)

| Field | Value |
|-------|-------|
| SHA | [`c2f7076`](https://github.com/iQube-Protocol/AigentZBeta/commit/c2f7076132f6194148130a0d5a36a4735e816788) |
| Author | Claude |
| Date | 2026-07-07T07:05:09Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build CCRL Phase E counterfactual slice: pure what-if projection over the invariant field (pre-ratification decision support)

Closes the deferral footnoted in the Invariant Field Explorer's first slice
(CFS-019 §5 item 6). A researcher poses a hypothetical — a proposed finding
canonizing with proposed edges (add-node), or removing an existing edge
(remove-edge) — and SEES the projected consequence field BEFORE anything is
ratified: the propose→see-consequences→ratify loop made operable
(inv.cybernetics.111 — the system may propose its own evolution; the operator
ratifies it).

PURE projection, ZERO writes:
- services/consequence/counterfactual.ts (new, isomorphic): projectCounterfactual
  computes baseline/projected/delta field counts, coherence flip, forced-escalation
  change, and a deterministic plain-language readout from edges+invariants inputs.
  Mirrors the substrate rules — coherence keys on contradicts-edge presence
  (knowledgeCuration); escalation on a reachable contradiction OR a constrains
  edge bounding a canonical invariant (forecastConsequences §5).
- POST /api/research/invariant-field: persona-gated, T2-safe, READ-ONLY. Fetches
  the real neighbourhood with read functions only, reuses forecastConsequences
  for the live baseline context, does the delta in the pure helper. No
  insert/update/delete/upsert anywhere in the new code.
- InvariantFieldExplorerTab: "Counterfactual (what-if)" panel under the
  neighbourhood view — mode toggle, target/edge-type pickers (add-node) or an
  edge picker from the shown neighbourhood (remove-edge), before→after field
  with colour-coded deltas (more enables emerald, new contradicts rose) and the
  honest readout. Framed "Projection only — nothing is written."
- Canaries in tests/constitutional-contracts.test.ts: determinism,
  contradicts-flips-coherence+escalation, remove-edge lowers the count, no-op =
  zero delta, canonical-constrains escalation.
- Records: CFS-019 §8 Phase E line + CFS-015 progress paragraph.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Closes the deferral footnoted in the Invariant Field Explorer's first slice
(CFS-019 §5 item 6). A researcher poses a hypothetical — a proposed finding
canonizing with proposed edges (add-node), or removing an existing edge
(remove-edge) — and SEES the projected consequence field BEFORE anything is
ratified: the propose→see-consequences→ratify loop made operable
(inv.cybernetics.111 — the system may propose its own evolution; the operator
ratifies it).

PURE projection, ZERO writes:
- services/consequence/counterfactual.ts (new, isomorphic): projectCounterfactual
  computes baseline/projected/delta field counts, coherence flip, forced-escalation
  change, and a deterministic plain-language readout from edges+invariants inputs.
  Mirrors the substrate rules — coherence keys on contradicts-edge presence
  (knowledgeCuration); escalation on a reachable contradiction OR a constrains
  edge bounding a canonical invariant (forecastConsequences §5).
- POST /api/research/invariant-field: persona-gated, T2-safe, READ-ONLY. Fetches
  the real neighbourhood with read functions only, reuses forecastConsequences
  for the live baseline context, does the delta in the pure helper. No
  insert/update/delete/upsert anywhere in the new code.
- InvariantFieldExplorerTab: "Counterfactual (what-if)" panel under the
  neighbourhood view — mode toggle, target/edge-type pickers (add-node) or an
  edge picker from the shown neighbourhood (remove-edge), before→after field
  with colour-coded deltas (more enables emerald, new contradicts rose) and the
  honest readout. Framed "Projection only — nothing is written."
- Canaries in tests/constitutional-contracts.test.ts: determinism,
  contradicts-flips-coherence+escalation, remove-edge lowers the count, no-op =
  zero delta, canonical-constrains escalation.
- Records: CFS-019 §8 Phase E line + CFS-015 progress paragraph.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/research/invariant-field/route.ts` |
| Modified | `codexes/packs/ccrl/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Modified | `codexes/packs/ccrl/foundation/CFS-019_ccrl-charter.md` |
| Modified | `components/composer/InvariantFieldExplorerTab.tsx` |
| Added | `services/consequence/counterfactual.ts` |
| Modified | `tests/constitutional-contracts.test.ts` |

## Stats

 6 files changed, 763 insertions(+), 5 deletions(-)
