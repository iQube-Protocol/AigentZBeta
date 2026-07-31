# Commit Brief: `e24ca0b` — Queued badge propagation to BriefCard + VentureCockpit + VentureProgressCard

| Field | Value |
|-------|-------|
| SHA | [`e24ca0b`](https://github.com/iQube-Protocol/AigentZBeta/commit/e24ca0b70f29c76016a9d5d7505f85d3fec2c8b2) |
| Author | Claude |
| Date | 2026-05-26T02:32:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Queued badge propagation to BriefCard + VentureCockpit + VentureProgressCard

Follow-up to the prior NBA Act → Queued fix that only covered the
move-forward hero path. Extends the same prop to every other surface
that renders a NextBestActionCard with an Act button.

- BriefCard + BriefLayout: queuedIntents threaded through, brief's
  "Suggested next moves" list now flips Act → Queued per-row.
- VentureProgressCard: queuedIntents prop added, "Recommended moves"
  list inherits the same behaviour when rendered from the
  WelcomeRightPane stack layout.
- VentureCockpitLayout: reads queuedIntents from RightPaneLayoutProps
  (already present), applies it to the Recommended row.
- WelcomeRightPane: threads queuedIntents into both BriefCard and
  VentureProgressCard. Also wires onActOnNbe on the venture card
  (was previously dropped on the floor in the stack layout — minor
  consistency fix surfaced while threading the prop).

Operator now sees the Queued emerald badge consistently across brief
/ move-forward / venture-progress / cockpit, no matter which surface
they fired the intent from. No remount workaround needed.
```

## Body

Follow-up to the prior NBA Act → Queued fix that only covered the
move-forward hero path. Extends the same prop to every other surface
that renders a NextBestActionCard with an Act button.

- BriefCard + BriefLayout: queuedIntents threaded through, brief's
  "Suggested next moves" list now flips Act → Queued per-row.
- VentureProgressCard: queuedIntents prop added, "Recommended moves"
  list inherits the same behaviour when rendered from the
  WelcomeRightPane stack layout.
- VentureCockpitLayout: reads queuedIntents from RightPaneLayoutProps
  (already present), applies it to the Recommended row.
- WelcomeRightPane: threads queuedIntents into both BriefCard and
  VentureProgressCard. Also wires onActOnNbe on the venture card
  (was previously dropped on the floor in the stack layout — minor
  consistency fix surfaced while threading the prop).

Operator now sees the Queued emerald badge consistently across brief
/ move-forward / venture-progress / cockpit, no matter which surface
they fired the intent from. No remount workaround needed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/cards/BriefCard.tsx` |
| Modified | `components/metame/cards/VentureProgressCard.tsx` |
| Modified | `components/metame/welcome/WelcomeRightPane.tsx` |
| Modified | `components/metame/welcome/layouts/BriefLayout.tsx` |
| Modified | `components/metame/welcome/layouts/VentureCockpitLayout.tsx` |

## Stats

 5 files changed, 20 insertions(+), 1 deletion(-)
