# Commit Brief: `30c0148` — Render invariant Standing/Reach dots in positive hues, not the R/T ramp

| Field | Value |
|-------|-------|
| SHA | [`30c0148`](https://github.com/iQube-Protocol/AigentZBeta/commit/30c0148b9f9154bc76add549cd2d50ec45949f91) |
| Author | Claude |
| Date | 2026-07-04T09:36:42Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Render invariant Standing/Reach dots in positive hues, not the R/T ramp

Operator direction after the first flywheel Standing landed: the reused
reliability/trust colour ramp painted low values red, but a low-Standing
invariant is YOUNG (first evidence earned), not unhealthy — earned
evidence must never render as an alarm colour. Standing dots are now
constant emerald and Reach constant cyan (distinct hues keep the Law XII
axes visually separate; magnitude is carried by lit-dot count, not
colour) via the Dots colorClass escape hatch, across Browse grid/table,
the detail modal, and the Overview bars/histograms (previously purple
for standing — unified).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator direction after the first flywheel Standing landed: the reused
reliability/trust colour ramp painted low values red, but a low-Standing
invariant is YOUNG (first evidence earned), not unhealthy — earned
evidence must never render as an alarm colour. Standing dots are now
constant emerald and Reach constant cyan (distinct hues keep the Law XII
axes visually separate; magnitude is carried by lit-dot count, not
colour) via the Dots colorClass escape hatch, across Browse grid/table,
the detail modal, and the Overview bars/histograms (previously purple
for standing — unified).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/InvariantDetailModal.tsx` |
| Modified | `app/triad/components/codex/tabs/InvariantOverviewView.tsx` |
| Modified | `app/triad/components/codex/tabs/InvariantRegistryTab.tsx` |

## Stats

 3 files changed, 12 insertions(+), 9 deletions(-)
