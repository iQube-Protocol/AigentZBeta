# Commit Brief: `5132d14` — Add Overview/Ontology/Graph views to Invariant Registry

| Field | Value |
|-------|-------|
| SHA | [`5132d14`](https://github.com/iQube-Protocol/AigentZBeta/commit/5132d14c2ddccf5ae15082e753d4a45fb432bd1d) |
| Author | Claude |
| Date | 2026-07-04T05:23:45Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Overview/Ontology/Graph views to Invariant Registry

The Invariant Registry tab becomes a four-view surface behind one
switcher: the existing Browse list plus three analytical views over
the live substrate. Overview facets Standing/Reach/status by namespace
with distribution histograms and leaderboards (Standing and Reach on
separate axes — Law XII). Ontology renders the CFS-002 class tree with
per-class invariant counts and click-through to a filtered Browse.
Graph is a rooted traversal explorer (CFS-003 §4) rendered as inline
SVG with a depth-radial layout, no graph library. All views run against
existing API surfaces — no new routes, migrations, or seed changes.
Shared enums/colours/loader extracted to invariantViewShared to prevent
palette drift; Dots/Pagination/ViewModeToggle/personaFetch/detail modal
reused verbatim.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The Invariant Registry tab becomes a four-view surface behind one
switcher: the existing Browse list plus three analytical views over
the live substrate. Overview facets Standing/Reach/status by namespace
with distribution histograms and leaderboards (Standing and Reach on
separate axes — Law XII). Ontology renders the CFS-002 class tree with
per-class invariant counts and click-through to a filtered Browse.
Graph is a rooted traversal explorer (CFS-003 §4) rendered as inline
SVG with a depth-radial layout, no graph library. All views run against
existing API surfaces — no new routes, migrations, or seed changes.
Shared enums/colours/loader extracted to invariantViewShared to prevent
palette drift; Dots/Pagination/ViewModeToggle/personaFetch/detail modal
reused verbatim.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/triad/components/codex/tabs/InvariantGraphView.tsx` |
| Added | `app/triad/components/codex/tabs/InvariantOntologyView.tsx` |
| Added | `app/triad/components/codex/tabs/InvariantOverviewView.tsx` |
| Modified | `app/triad/components/codex/tabs/InvariantRegistryTab.tsx` |
| Added | `app/triad/components/codex/tabs/invariantViewShared.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-04_invariant-data-browser-overview-ontology-graph.md` |

## Stats

 7 files changed, 1317 insertions(+), 218 deletions(-)
