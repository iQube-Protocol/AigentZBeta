# Commit Brief: `46d4eeb` — improve chain panel legibility: copy, doc approval decoupling, timeline ordering

| Field | Value |
|-------|-------|
| SHA | [`46d4eeb`](https://github.com/iQube-Protocol/AigentZBeta/commit/46d4eeb4de65d72c664b96b42beca7c439d39057) |
| Author | Claude |
| Date | 2026-06-05T20:28:31Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
improve chain panel legibility: copy, doc approval decoupling, timeline ordering

- Decouple doc approval from intent close: ArtifactApproveButton now fires
  intent-advance(approve) not complete, keeping intent open for follow-on
  actions. Shows "Doc approved" badge post-click; "Mark complete" in the
  chain header remains the explicit terminal action.
- Friendly status labels: "awaiting_approval" → "awaiting your review",
  "in_progress" → "in progress" across chain header status chip.
- Updated ACTION_LABELS: "Intent queued" → "Follow-on action queued",
  "Specialist consulted" → "Specialist analysis complete", "Artifact
  created" → "Doc created".
- Specialist response toggle: "Show specialist response" → "Show [Name]'s
  further recommendations" / "Hide recommendations" with sub-hint
  "Select recommendations to queue as follow-on actions".
- Recommendations section header: "Follow-on actions — select to queue".
- artifact_created row hint: explains to open the doc, approve it, and
  that the intent stays open for follow-on actions.
- Chain badge labels: "draft ready" → "awaiting review", "consulted" →
  "analysis complete", "invoked" → "specialist working".
- Secondary sort in merged timeline by TYPE_ORDER so artifact_created
  always surfaces before intent_queued chips (natural linear flow:
  analysis → doc → follow-on actions).
```

## Body

- Decouple doc approval from intent close: ArtifactApproveButton now fires
  intent-advance(approve) not complete, keeping intent open for follow-on
  actions. Shows "Doc approved" badge post-click; "Mark complete" in the
  chain header remains the explicit terminal action.
- Friendly status labels: "awaiting_approval" → "awaiting your review",
  "in_progress" → "in progress" across chain header status chip.
- Updated ACTION_LABELS: "Intent queued" → "Follow-on action queued",
  "Specialist consulted" → "Specialist analysis complete", "Artifact
  created" → "Doc created".
- Specialist response toggle: "Show specialist response" → "Show [Name]'s
  further recommendations" / "Hide recommendations" with sub-hint
  "Select recommendations to queue as follow-on actions".
- Recommendations section header: "Follow-on actions — select to queue".
- artifact_created row hint: explains to open the doc, approve it, and
  that the intent stays open for follow-on actions.
- Chain badge labels: "draft ready" → "awaiting review", "consulted" →
  "analysis complete", "invoked" → "specialist working".
- Secondary sort in merged timeline by TYPE_ORDER so artifact_created
  always surfaces before intent_queued chips (natural linear flow:
  analysis → doc → follow-on actions).

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/workbench/IntentChainPanel.tsx` |

## Stats

 1 file changed, 107 insertions(+), 39 deletions(-)
