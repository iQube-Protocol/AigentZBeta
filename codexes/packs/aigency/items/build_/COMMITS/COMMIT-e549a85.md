# Commit Brief: `e549a85` — myWorkspace: separate myworkspace_entries table for strict canvas/workspace demarcation

| Field | Value |
|-------|-------|
| SHA | [`e549a85`](https://github.com/iQube-Protocol/AigentZBeta/commit/e549a8507875dcae26984042d507b9a4ad345d24) |
| Author | Claude |
| Date | 2026-05-31T21:54:59Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
myWorkspace: separate myworkspace_entries table for strict canvas/workspace demarcation

Operator-reported: private workspace items kept surfacing in myCanvas
(not myWorkspace) and the venture iQube / WIP items weren't visible at
all in myWorkspace. Root cause is the cohabitation in mycanvas_entries
with a meta_json.surface discriminator — entries created before the
discriminator existed default to canvas, and the JSON-path filter
can't distinguish "stamped canvas" from "never stamped".

Switch to a dedicated table for clean by-construction separation:

  supabase/migrations/20260530000000_myworkspace_entries.sql (NEW)
    - CREATE TABLE myworkspace_entries (mirror of mycanvas_entries:
      id / persona_id / title / body_md / tags / visibility /
      entry_type / meta_json / timestamps). Same RLS pattern
      (service-role-only). Same indices.
    - Data migration: moves all existing rows from mycanvas_entries
      where meta_json->>'surface' IN ('workspace', 'workbench') OR
      where entry_type='note' AND no surface stamp (legacy default
      that fell to canvas but should be private). experience_origin
      and experience_derived rows STAY in mycanvas_entries since
      those are remix outputs intended for canvas.
    - Idempotent (ON CONFLICT DO NOTHING + DELETE only-moved-ids).
    OPERATOR ACTION: paste into Supabase dev SQL editor once.

  services/myworkspace/workspaceService.ts (NEW)
    - Mirror of canvasService.ts: listEntries / getEntry /
      createEntry / updateEntry / deleteEntry, all pointed at
      myworkspace_entries. Same payload-shrinking strategy on the
      list response.

  app/api/myworkspace/entries/route.ts (NEW)
    - GET (list) + POST (create), same shape as
      /api/mycanvas/entries.

  app/api/myworkspace/entries/[id]/route.ts (NEW)
    - GET (detail) + PATCH (update) + DELETE, same shape as
      /api/mycanvas/entries/[id].

  app/triad/components/codex/tabs/MyCanvasTab.tsx
    - entriesApiBase computed from surface prop:
      canvas → /api/mycanvas/entries; workspace → /api/myworkspace/entries
    - 5 fetch callsites (list / detail / create / patch / delete)
      now use entriesApiBase. The leaky meta_json.surface discriminator
      is no longer load-bearing — entries can't surface in the wrong
      tab regardless of how they were stamped.
    - Canvas-only side endpoints (invite, publish-to-pulse) kept
      hardcoded at /api/mycanvas — workspace entries are private by
      design and don't get those affordances.

myCanvas should now show ONLY the entries that survived the migration
(canvas-stamped + experience_origin/_derived). myWorkspace should show
the moved private rows + every new workspace entry. Venture iQube
uploads + active intents still render from the
MyWorkspaceTab composite dashboard (workbench-ledger + uploads list)
unchanged.

Once the deploy + the SQL migration run, the layout will match the
operator's mental model: myCanvas = creative + publishable content;
myWorkspace = private work artifacts; myLedger = DVN receipts
cross-surface.
```

## Body

Operator-reported: private workspace items kept surfacing in myCanvas
(not myWorkspace) and the venture iQube / WIP items weren't visible at
all in myWorkspace. Root cause is the cohabitation in mycanvas_entries
with a meta_json.surface discriminator — entries created before the
discriminator existed default to canvas, and the JSON-path filter
can't distinguish "stamped canvas" from "never stamped".

Switch to a dedicated table for clean by-construction separation:

  supabase/migrations/20260530000000_myworkspace_entries.sql (NEW)
    - CREATE TABLE myworkspace_entries (mirror of mycanvas_entries:
      id / persona_id / title / body_md / tags / visibility /
      entry_type / meta_json / timestamps). Same RLS pattern
      (service-role-only). Same indices.
    - Data migration: moves all existing rows from mycanvas_entries
      where meta_json->>'surface' IN ('workspace', 'workbench') OR
      where entry_type='note' AND no surface stamp (legacy default
      that fell to canvas but should be private). experience_origin
      and experience_derived rows STAY in mycanvas_entries since
      those are remix outputs intended for canvas.
    - Idempotent (ON CONFLICT DO NOTHING + DELETE only-moved-ids).
    OPERATOR ACTION: paste into Supabase dev SQL editor once.

  services/myworkspace/workspaceService.ts (NEW)
    - Mirror of canvasService.ts: listEntries / getEntry /
      createEntry / updateEntry / deleteEntry, all pointed at
      myworkspace_entries. Same payload-shrinking strategy on the
      list response.

  app/api/myworkspace/entries/route.ts (NEW)
    - GET (list) + POST (create), same shape as
      /api/mycanvas/entries.

  app/api/myworkspace/entries/[id]/route.ts (NEW)
    - GET (detail) + PATCH (update) + DELETE, same shape as
      /api/mycanvas/entries/[id].

  app/triad/components/codex/tabs/MyCanvasTab.tsx
    - entriesApiBase computed from surface prop:
      canvas → /api/mycanvas/entries; workspace → /api/myworkspace/entries
    - 5 fetch callsites (list / detail / create / patch / delete)
      now use entriesApiBase. The leaky meta_json.surface discriminator
      is no longer load-bearing — entries can't surface in the wrong
      tab regardless of how they were stamped.
    - Canvas-only side endpoints (invite, publish-to-pulse) kept
      hardcoded at /api/mycanvas — workspace entries are private by
      design and don't get those affordances.

myCanvas should now show ONLY the entries that survived the migration
(canvas-stamped + experience_origin/_derived). myWorkspace should show
the moved private rows + every new workspace entry. Venture iQube
uploads + active intents still render from the
MyWorkspaceTab composite dashboard (workbench-ledger + uploads list)
unchanged.

Once the deploy + the SQL migration run, the layout will match the
operator's mental model: myCanvas = creative + publishable content;
myWorkspace = private work artifacts; myLedger = DVN receipts
cross-surface.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/myworkspace/entries/[id]/route.ts` |
| Added | `app/api/myworkspace/entries/route.ts` |
| Modified | `app/triad/components/codex/tabs/MyCanvasTab.tsx` |
| Added | `services/myworkspace/workspaceService.ts` |
| Added | `supabase/migrations/20260530000000_myworkspace_entries.sql` |

## Stats

 5 files changed, 401 insertions(+), 5 deletions(-)
