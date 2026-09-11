# Commit Brief: `de5aee7` — gate-c: add VentureReportBriefLayout + VentureReintroductionBriefLayout + deliberation routing

| Field | Value |
|-------|-------|
| SHA | [`de5aee7`](https://github.com/iQube-Protocol/AigentZBeta/commit/de5aee773d3b205514824f508b0c4f1e39a8baf5) |
| Author | Claude |
| Date | 2026-08-17T18:02:31Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
gate-c: add VentureReportBriefLayout + VentureReintroductionBriefLayout + deliberation routing

- Create VentureReportBriefLayout.tsx: dedicated right-pane layout for venture report deliberation, rendering purpose, period, disclosure, scope, completeness indicator, and evidence summary
- Create VentureReintroductionBriefLayout.tsx: extends venture-report layout with reintroduction-specific fields (audience, goal, lastInteraction, priorUnderstandingSource)
- Register both layouts in layout registry (venture-report-brief, venture-reintroduction-brief) for getLayout() resolution
- Wire deliberation routing into AigentMeWelcomeSplitTab: intercept venture-report/venture-reintroduction artifacts before standard dispatch, initialize DeliberationBrief, mount appropriate layout
- Add deliberationBrief state and props to layout pipeline
- Add compositionPolicy and deliberationSeam imports for requiresDeliberation() check
- Typecheck passes; no new compilation errors in deliberation code
```

## Body

- Create VentureReportBriefLayout.tsx: dedicated right-pane layout for venture report deliberation, rendering purpose, period, disclosure, scope, completeness indicator, and evidence summary
- Create VentureReintroductionBriefLayout.tsx: extends venture-report layout with reintroduction-specific fields (audience, goal, lastInteraction, priorUnderstandingSource)
- Register both layouts in layout registry (venture-report-brief, venture-reintroduction-brief) for getLayout() resolution
- Wire deliberation routing into AigentMeWelcomeSplitTab: intercept venture-report/venture-reintroduction artifacts before standard dispatch, initialize DeliberationBrief, mount appropriate layout
- Add deliberationBrief state and props to layout pipeline
- Add compositionPolicy and deliberationSeam imports for requiresDeliberation() check
- Typecheck passes; no new compilation errors in deliberation code

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Added | `components/metame/welcome/layouts/VentureReintroductionBriefLayout.tsx` |
| Added | `components/metame/welcome/layouts/VentureReportBriefLayout.tsx` |
| Modified | `components/metame/welcome/layouts/registry.ts` |
| Modified | `components/metame/welcome/layouts/types.ts` |
| Added | `services/deliberativeArtifact/compositionPolicy.ts` |
| Added | `services/deliberativeArtifact/deliberationSeam.ts` |
| Added | `types/deliberativeArtifact.ts` |

## Stats

 8 files changed, 1483 insertions(+), 12 deletions(-)
