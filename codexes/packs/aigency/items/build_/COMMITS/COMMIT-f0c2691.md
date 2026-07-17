# Commit Brief: `f0c2691` — add Graph perspective to the Constitutional Observatory (CFS-035 §12)

| Field | Value |
|-------|-------|
| SHA | [`f0c2691`](https://github.com/iQube-Protocol/AigentZBeta/commit/f0c2691e6d4bf55226139587aebc08884e03c36e) |
| Author | Claude |
| Date | 2026-07-16T18:20:05Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add Graph perspective to the Constitutional Observatory (CFS-035 §12)

The invariant field as a node-link graph — invariants as nodes (size ∝
standing, colour = namespace), their relationships as edges.

- /api/invariants/graph: add a ?view=field whole-field mode (top-N by standing
  + edges among them), extending the existing root-traversal endpoint rather
  than forking a new one. T1-safe, bounded (80 nodes) so the render stays light.
- FieldView: fifth 'Graph' perspective, lazy-loaded on first open. Self-contained
  SVG node-link layout (namespace-clustered rings, deterministic, no external
  lib), click-to-inspect statement, namespace legend.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The invariant field as a node-link graph — invariants as nodes (size ∝
standing, colour = namespace), their relationships as edges.

- /api/invariants/graph: add a ?view=field whole-field mode (top-N by standing
  + edges among them), extending the existing root-traversal endpoint rather
  than forking a new one. T1-safe, bounded (80 nodes) so the render stays light.
- FieldView: fifth 'Graph' perspective, lazy-loaded on first open. Self-contained
  SVG node-link layout (namespace-clustered rings, deterministic, no external
  lib), click-to-inspect statement, namespace legend.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/invariants/graph/route.ts` |
| Modified | `components/registry/FieldView.tsx` |

## Stats

 2 files changed, 240 insertions(+), 3 deletions(-)
