# Commit Brief: `ae78135` — Label simulated MoneyPenny data honestly and fix slate house style

| Field | Value |
|-------|-------|
| SHA | [`ae78135`](https://github.com/iQube-Protocol/AigentZBeta/commit/ae7813502ecf20a9811f7e7d393a129d422dffd7) |
| Author | Claude |
| Date | 2026-09-01T11:01:57Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Label simulated MoneyPenny data honestly and fix slate house style

SPEC-MPY-002 §7 truthfulness rule: HFTConsole's Math.random()-driven
quotes/executions/P&L and PortfolioAnalytics's hardcoded static figures
were rendered with no indication they aren't live financial truth. Adds a
shared SimulationNotice badge (reused, not per-panel hand-rolled) and
applies it to both surfaces; replacing the underlying mock data with real
canonical sources is tracked as open MPY2-4/MPY2-5 work in the MPY2-0
donor harvest audit, not attempted here.

Also corrects both files' white-hairline styling (bg-white/5,
ring-white/10, border-white/NN, text-white/NN) to the CLAUDE.md-mandated
translucent-slate house style (border-slate-800, bg-slate-900/40,
text-slate-300/400/100) — the white-hairline pattern is explicitly the
deprecated residual, not the style guide.
```

## Body

SPEC-MPY-002 §7 truthfulness rule: HFTConsole's Math.random()-driven
quotes/executions/P&L and PortfolioAnalytics's hardcoded static figures
were rendered with no indication they aren't live financial truth. Adds a
shared SimulationNotice badge (reused, not per-panel hand-rolled) and
applies it to both surfaces; replacing the underlying mock data with real
canonical sources is tracked as open MPY2-4/MPY2-5 work in the MPY2-0
donor harvest audit, not attempted here.

Also corrects both files' white-hairline styling (bg-white/5,
ring-white/10, border-white/NN, text-white/NN) to the CLAUDE.md-mandated
translucent-slate house style (border-slate-800, bg-slate-900/40,
text-slate-300/400/100) — the white-hairline pattern is explicitly the
deprecated residual, not the style guide.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/moneypenny/components/HFTConsole.tsx` |
| Modified | `app/(shell)/moneypenny/components/PortfolioAnalytics.tsx` |
| Added | `app/(shell)/moneypenny/components/SimulationNotice.tsx` |

## Stats

 3 files changed, 92 insertions(+), 47 deletions(-)
