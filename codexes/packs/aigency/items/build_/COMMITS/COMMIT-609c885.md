# Commit Brief: `609c885` — MyWorkspaceTab: 5-item sub-menu nav matching standard cartridge pattern

| Field | Value |
|-------|-------|
| SHA | [`609c885`](https://github.com/iQube-Protocol/AigentZBeta/commit/609c885d6cdb7f7720402589ce70787cebc4d4a6) |
| Author | Claude |
| Date | 2026-05-31T22:32:06Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
MyWorkspaceTab: 5-item sub-menu nav matching standard cartridge pattern

Operator-driven layout fix. The collapsible-sections layout was a
bespoke pattern that didn't match how other cartridges handle internal
nav. Replace with a standard horizontal sub-menu bar — one action
button followed by four content tabs — that mirrors how every other
cartridge in the platform handles internal subdivision.

Sub-menu (left → right):
  + New             — quick action. Switches to Working Drafts and
                      MyCanvasTab's own "+ New" plumbing takes over.
  Active Intents    — workbench-ledger pills (queued / awaiting /
                      completed). Paginated 20/page.
  Working Drafts    — embeds MyCanvasTab(surface='workspace') which
                      now talks to /api/myworkspace/entries
                      exclusively. Renders unchanged inside the panel.
  Uploads           — persona_uploads filtered to use_kind in
                      (venture_iqube, iqube_payload, workbench).
                      Paginated 20/page. Count badge on the tab chip.
  Cohorts           — RESTORED CohortMetricsCard. Operator-requested:
                      "we can restore the cohort intel we had in
                      place before… can be surfaced in that tab". This
                      was dropped when myLedger pivoted to receipt
                      view; it now has a proper home.

Pagination uses a small Pager component (ChevronLeft / page N of M /
ChevronRight) at the bottom of each long list. Active panel only
renders when its tab is selected — avoids fetching uploads /
intents data the operator hasn't asked for yet.

Tab styling matches CodexPanelDynamic's primary tab chip treatment
(rounded-lg, ring-1 violet-500/30 when active, hover:bg-white/4 idle)
so the visual rhythm is consistent with the codex tab nav above it.

Working Drafts panel keeps the full MyCanvasTab chrome (header + "+
New" button + entries list + editor) since that's already the canonical
draft authoring UI. + New on the workspace nav is a shortcut to land
on that tab so the operator doesn't have to dig.
```

## Body

Operator-driven layout fix. The collapsible-sections layout was a
bespoke pattern that didn't match how other cartridges handle internal
nav. Replace with a standard horizontal sub-menu bar — one action
button followed by four content tabs — that mirrors how every other
cartridge in the platform handles internal subdivision.

Sub-menu (left → right):
  + New             — quick action. Switches to Working Drafts and
                      MyCanvasTab's own "+ New" plumbing takes over.
  Active Intents    — workbench-ledger pills (queued / awaiting /
                      completed). Paginated 20/page.
  Working Drafts    — embeds MyCanvasTab(surface='workspace') which
                      now talks to /api/myworkspace/entries
                      exclusively. Renders unchanged inside the panel.
  Uploads           — persona_uploads filtered to use_kind in
                      (venture_iqube, iqube_payload, workbench).
                      Paginated 20/page. Count badge on the tab chip.
  Cohorts           — RESTORED CohortMetricsCard. Operator-requested:
                      "we can restore the cohort intel we had in
                      place before… can be surfaced in that tab". This
                      was dropped when myLedger pivoted to receipt
                      view; it now has a proper home.

Pagination uses a small Pager component (ChevronLeft / page N of M /
ChevronRight) at the bottom of each long list. Active panel only
renders when its tab is selected — avoids fetching uploads /
intents data the operator hasn't asked for yet.

Tab styling matches CodexPanelDynamic's primary tab chip treatment
(rounded-lg, ring-1 violet-500/30 when active, hover:bg-white/4 idle)
so the visual rhythm is consistent with the codex tab nav above it.

Working Drafts panel keeps the full MyCanvasTab chrome (header + "+
New" button + entries list + editor) since that's already the canonical
draft authoring UI. + New on the workspace nav is a shortcut to land
on that tab so the operator doesn't have to dig.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` |

## Stats

 1 file changed, 177 insertions(+), 123 deletions(-)
