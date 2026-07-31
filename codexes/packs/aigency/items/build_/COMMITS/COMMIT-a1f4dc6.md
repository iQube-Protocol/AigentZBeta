# Commit Brief: `a1f4dc6` — separate VentureQube Lite from Pro ventures in portfolio mode

| Field | Value |
|-------|-------|
| SHA | [`a1f4dc6`](https://github.com/iQube-Protocol/AigentZBeta/commit/a1f4dc6e0c1252a1b6ba3621de38147be96c837d) |
| Author | Claude |
| Date | 2026-06-24T21:32:00Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
separate VentureQube Lite from Pro ventures in portfolio mode

Fixes the conflation where editing VentureQube Lite in aigentMe mutated
the first Pro venture: VentureLightChip / VentureLightWizard bound to
ventures[0], so with three Pro ventures in the Founder Office, editing
"Lite" overwrote the first one (metaKnyt).

Dual-utilization per operatorMode:
- VentureLightChip now detects portfolio mode (operatingModel.operatorMode
  === 'portfolio-operator' OR ventureCount > 1) and opens the Operating
  Brief (VenturePortfolioWizard mode="operating") — the portfolio
  orchestration layer that reads/writes operatingModel and never touches a
  venture_qubes row. Operator mode (single seed venture) is unchanged.
- VentureLightWizard no longer silently binds to ventures[0]: it auto-edits
  only when EXACTLY one venture exists; with multiple it stays in create
  mode and shows a note pointing to the Operating Brief, so it can never
  overwrite a Pro venture.
- /api/venture/portfolio GET now returns canPortfolio so the chip can wire
  access correctly.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

Fixes the conflation where editing VentureQube Lite in aigentMe mutated
the first Pro venture: VentureLightChip / VentureLightWizard bound to
ventures[0], so with three Pro ventures in the Founder Office, editing
"Lite" overwrote the first one (metaKnyt).

Dual-utilization per operatorMode:
- VentureLightChip now detects portfolio mode (operatingModel.operatorMode
  === 'portfolio-operator' OR ventureCount > 1) and opens the Operating
  Brief (VenturePortfolioWizard mode="operating") — the portfolio
  orchestration layer that reads/writes operatingModel and never touches a
  venture_qubes row. Operator mode (single seed venture) is unchanged.
- VentureLightWizard no longer silently binds to ventures[0]: it auto-edits
  only when EXACTLY one venture exists; with multiple it stays in create
  mode and shows a note pointing to the Operating Brief, so it can never
  overwrite a Pro venture.
- /api/venture/portfolio GET now returns canPortfolio so the chip can wire
  access correctly.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/venture/portfolio/route.ts` |
| Modified | `components/metame/setup/VentureLightWizard.tsx` |
| Modified | `components/metame/welcome/VentureLightChip.tsx` |

## Stats

 3 files changed, 105 insertions(+), 20 deletions(-)
