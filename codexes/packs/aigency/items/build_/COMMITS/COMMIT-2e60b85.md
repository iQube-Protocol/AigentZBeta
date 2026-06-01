# Commit Brief: `2e60b85` — canvasService.listEntries: surface meta_json.surface stamp via JSON-path

| Field | Value |
|-------|-------|
| SHA | [`2e60b85`](https://github.com/iQube-Protocol/AigentZBeta/commit/2e60b85c0283d09fbea6fdd7186a5359cdc43ee4) |
| Author | Claude |
| Date | 2026-05-31T21:32:31Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
canvasService.listEntries: surface meta_json.surface stamp via JSON-path

Operator-reported: myWorkspace entries don't save / don't appear in
myWorkspace. Root cause is on the read side, not the write.

listEntries() was stripping out meta_json entirely to keep the list
response under Lambda's 6 MB ceiling (the 413 fix for derived
experience entries that carry full article bodies + base64 images).
The FE filter then looks for metaJson.surface to route between
myCanvas (surface !== 'workspace') and myWorkspace
(surface === 'workspace'). With the stamp invisible in the list, every
entry looked unstamped → fell back to canvas → workspace tab showed
nothing while myCanvas accidentally surfaced workspace drafts.

Fix: use Supabase's JSON-path select expression to pull just the
`surface` key out of meta_json as a flat column:

  .select('…, surface:meta_json->>surface')

That's a single tiny string — doesn't drag the bulky imageUrl back
into the list (the 413 reason for the original strip). Reconstruct a
minimum meta_json { surface } from the flat column so the FE filter
sees the stamp without changing its shape. Detail view (getEntry)
still returns the full meta_json so the editor / image renderer keep
working unchanged.

Saves work fine today (createEntry round-trips meta_json correctly,
and the row IS getting stored with the right stamp — confirmed by
the surface column extracting cleanly). The "doesn't save" symptom
was actually "saves but you can't see it on the right tab"; this
unblocks the route.
```

## Body

Operator-reported: myWorkspace entries don't save / don't appear in
myWorkspace. Root cause is on the read side, not the write.

listEntries() was stripping out meta_json entirely to keep the list
response under Lambda's 6 MB ceiling (the 413 fix for derived
experience entries that carry full article bodies + base64 images).
The FE filter then looks for metaJson.surface to route between
myCanvas (surface !== 'workspace') and myWorkspace
(surface === 'workspace'). With the stamp invisible in the list, every
entry looked unstamped → fell back to canvas → workspace tab showed
nothing while myCanvas accidentally surfaced workspace drafts.

Fix: use Supabase's JSON-path select expression to pull just the
`surface` key out of meta_json as a flat column:

  .select('…, surface:meta_json->>surface')

That's a single tiny string — doesn't drag the bulky imageUrl back
into the list (the 413 reason for the original strip). Reconstruct a
minimum meta_json { surface } from the flat column so the FE filter
sees the stamp without changing its shape. Detail view (getEntry)
still returns the full meta_json so the editor / image renderer keep
working unchanged.

Saves work fine today (createEntry round-trips meta_json correctly,
and the row IS getting stored with the right stamp — confirmed by
the surface column extracting cleanly). The "doesn't save" symptom
was actually "saves but you can't see it on the right tab"; this
unblocks the route.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/mycanvas/canvasService.ts` |

## Stats

 1 file changed, 30 insertions(+), 10 deletions(-)
