# Commit Brief: `b582f2a` — my-space restructure: myArtifacts tabGroup with three sub-tabs

| Field | Value |
|-------|-------|
| SHA | [`b582f2a`](https://github.com/iQube-Protocol/AigentZBeta/commit/b582f2a9651df7987406857c41f25c135ae58bec) |
| Author | Claude |
| Date | 2026-05-31T19:46:35Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
my-space restructure: myArtifacts tabGroup with three sub-tabs

Operator-driven three-way split of the 'my' space:
  myCanvas    — public-publishable experiences (unchanged)
  myWorkspace — NEW. Private work artifacts (docs, reports, tools,
                workflows, briefs). Separate kind value so work-artifact
                entries never leak into the public canvas list.
  myLedger    — NEW. The ledger-on-top-of-workbench content that lived
                inside myWorkbench moves to its own tab. WorkbenchLedger
                + CohortMetricsCard render here without the in-progress
                drafts crowding them.

All three sit under a new `myartifacts` tabGroup chip (replacing the
existing `mycanvas` group entry), per the operator's preference for one
top-level chip with three sub-tabs rather than three separate top-level
tabs.

Changes:

  data/codex-configs.ts
    - tabGroups: 'mycanvas' chip → 'myartifacts' chip (label
      "myArtifacts", same PenSquare icon, same activation gate)
    - tabs: existing 'myworkbench' tab replaced with two new tabs
      'myworkspace' (MyWorkspaceTab) + 'myledger' (MyLedgerTab),
      both grouped under 'myartifacts'. 'mycanvas' tab regrouped
      under 'myartifacts'.

  app/triad/components/codex/tabs/MyCanvasTab.tsx
    - MyCanvasSurface union: 'canvas' | 'workspace' | 'workbench'
      ('workbench' kept as legacy alias for back-compat with stamped
      metaJson.surface='workbench' rows from before the split).
    - filteredEntries treats 'workspace' and 'workbench' as the same
      private-entries set so existing stamped rows surface under the
      new tab without a data migration.
    - Header label renders 'myWorkspace' / 'myWorkbench' / 'myCanvas'
      based on surface.
    - Default new-entry title picks "Untitled workspace draft" for
      surface='workspace', preserves legacy "Untitled workbench draft"
      for the legacy alias.

  app/triad/components/codex/tabs/MyWorkspaceTab.tsx (NEW)
    - Thin wrapper: <MyCanvasTab surface="workspace" />. Mirrors the
      old MyWorkbenchTab wrapper pattern but skips the ledger headers
      since those moved to MyLedgerTab.

  app/triad/components/codex/tabs/MyLedgerTab.tsx (NEW)
    - Renders WorkbenchLedger + CohortMetricsCard only. No drafts list.

  app/triad/components/codex/TabRenderer.tsx
    - Registers MyWorkspaceTab + MyLedgerTab in the componentRegistry.

Deferred to a follow-up:
  - Stamped-row migration: rewrite metaJson.surface='workbench' rows
    to 'workspace' so the legacy alias can be retired.
  - MyWorkbenchTab.tsx component file retained for any in-flight
    references; can be deleted in the follow-up once the migration
    runs and no codex-configs reference 'MyWorkbenchTab' anymore.
  - Seed: myCanvas remix-from-template affordance pointing at the
    Qriptopian Agents of Change 15-min reading sprint
    (exp_1773512145689_1vnt1jcnt) — operator-requested but out of
    scope for this commit; needs the publish-template plumbing.
```

## Body

Operator-driven three-way split of the 'my' space:
  myCanvas    — public-publishable experiences (unchanged)
  myWorkspace — NEW. Private work artifacts (docs, reports, tools,
                workflows, briefs). Separate kind value so work-artifact
                entries never leak into the public canvas list.
  myLedger    — NEW. The ledger-on-top-of-workbench content that lived
                inside myWorkbench moves to its own tab. WorkbenchLedger
                + CohortMetricsCard render here without the in-progress
                drafts crowding them.

All three sit under a new `myartifacts` tabGroup chip (replacing the
existing `mycanvas` group entry), per the operator's preference for one
top-level chip with three sub-tabs rather than three separate top-level
tabs.

Changes:

  data/codex-configs.ts
    - tabGroups: 'mycanvas' chip → 'myartifacts' chip (label
      "myArtifacts", same PenSquare icon, same activation gate)
    - tabs: existing 'myworkbench' tab replaced with two new tabs
      'myworkspace' (MyWorkspaceTab) + 'myledger' (MyLedgerTab),
      both grouped under 'myartifacts'. 'mycanvas' tab regrouped
      under 'myartifacts'.

  app/triad/components/codex/tabs/MyCanvasTab.tsx
    - MyCanvasSurface union: 'canvas' | 'workspace' | 'workbench'
      ('workbench' kept as legacy alias for back-compat with stamped
      metaJson.surface='workbench' rows from before the split).
    - filteredEntries treats 'workspace' and 'workbench' as the same
      private-entries set so existing stamped rows surface under the
      new tab without a data migration.
    - Header label renders 'myWorkspace' / 'myWorkbench' / 'myCanvas'
      based on surface.
    - Default new-entry title picks "Untitled workspace draft" for
      surface='workspace', preserves legacy "Untitled workbench draft"
      for the legacy alias.

  app/triad/components/codex/tabs/MyWorkspaceTab.tsx (NEW)
    - Thin wrapper: <MyCanvasTab surface="workspace" />. Mirrors the
      old MyWorkbenchTab wrapper pattern but skips the ledger headers
      since those moved to MyLedgerTab.

  app/triad/components/codex/tabs/MyLedgerTab.tsx (NEW)
    - Renders WorkbenchLedger + CohortMetricsCard only. No drafts list.

  app/triad/components/codex/TabRenderer.tsx
    - Registers MyWorkspaceTab + MyLedgerTab in the componentRegistry.

Deferred to a follow-up:
  - Stamped-row migration: rewrite metaJson.surface='workbench' rows
    to 'workspace' so the legacy alias can be retired.
  - MyWorkbenchTab.tsx component file retained for any in-flight
    references; can be deleted in the follow-up once the migration
    runs and no codex-configs reference 'MyWorkbenchTab' anymore.
  - Seed: myCanvas remix-from-template affordance pointing at the
    Qriptopian Agents of Change 15-min reading sprint
    (exp_1773512145689_1vnt1jcnt) — operator-requested but out of
    scope for this commit; needs the publish-template plumbing.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Modified | `app/triad/components/codex/tabs/MyCanvasTab.tsx` |
| Added | `app/triad/components/codex/tabs/MyLedgerTab.tsx` |
| Added | `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` |
| Modified | `data/codex-configs.ts` |

## Stats

 5 files changed, 157 insertions(+), 17 deletions(-)
