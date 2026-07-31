# Commit Brief: `14e609c` — Phase 2 B.2 (2/2): ActiveWorkDetailLayout (per-intent surface with Cancel/Handoff/Resume actions) + ActivityChip becomes clickable; recentActivity enriched server-side with canResume/canHandOff/canCancel/specialist/nextActionHint derived from intent status; action endpoints expected at /api/assistant/intents/[id]/{cancel,handoff,resume} — 404 surfaced as backlog note rather than failure

| Field | Value |
|-------|-------|
| SHA | [`14e609c`](https://github.com/iQube-Protocol/AigentZBeta/commit/14e609c68164bebd2b9ff85ce303f7dc59d9eabe) |
| Author | Claude |
| Date | 2026-05-24T04:52:37Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Phase 2 B.2 (2/2): ActiveWorkDetailLayout (per-intent surface with Cancel/Handoff/Resume actions) + ActivityChip becomes clickable; recentActivity enriched server-side with canResume/canHandOff/canCancel/specialist/nextActionHint derived from intent status; action endpoints expected at /api/assistant/intents/[id]/{cancel,handoff,resume} — 404 surfaced as backlog note rather than failure
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/cards/VentureProgressCard.tsx` |
| Added | `components/metame/welcome/layouts/ActiveWorkDetailLayout.tsx` |
| Modified | `components/metame/welcome/layouts/VentureCockpitLayout.tsx` |
| Modified | `components/metame/welcome/layouts/registry.ts` |
| Modified | `components/metame/welcome/layouts/types.ts` |
| Modified | `services/orchestration/ventureProgressBuilder.ts` |

## Stats

 8 files changed, 371 insertions(+), 21 deletions(-)
