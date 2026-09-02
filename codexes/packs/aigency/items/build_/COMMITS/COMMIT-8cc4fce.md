# Commit Brief: `8cc4fce` — C1: MoneyPenny copilot-left/chips-right shell [merge spec/moneypenny-mpy2-3]

| Field | Value |
|-------|-------|
| SHA | [`8cc4fce`](https://github.com/iQube-Protocol/AigentZBeta/commit/8cc4fce7be8c14034d21fc07927c7b103a9b3ffc) |
| Author | Claude |
| Date | 2026-09-02T12:38:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
C1: MoneyPenny copilot-left/chips-right shell [merge spec/moneypenny-mpy2-3]

Four squashed-for-deploy commits from spec/moneypenny-mpy2-3, regression-
tested together against current dev:

1. Import moneypenny/moneypenny001's real docs into docs/specs/moneypenny/
   (no document titled "handoff spec" exists in any of the three donor
   repos — confirmed by direct search; imported the closest real
   artifacts instead, kept separate, never fabricated an A/B/C mapping).
2. Decouple public-exposure from series='bridge': storage/register's
   skipEncryption now requires an explicit makePublic:true a caller sets
   deliberately, never a bare namespace-string match (extracted into an
   independently-tested shouldSkipEncryption helper).
3. A2 completion: infographic now publishes AND renders through the real
   bridge reader (knyts_bridge_editorial_config.infographic_url, additive
   migration, two-tier read keeps video/poster/copy working pre-migration)
   — previously bookkeeping-only. Also fixes a real bug: the placements
   route's slot validator never accepted 'infographic' at all.
4. C1: new MoneyPennyCopilotWorkspace reuses SmartTriadCopilotLayer (the
   SAME persistent-copilot component DevOn/Agent Me use, confirmed by
   direct investigation) as a left pane alongside the EXISTING
   MoneyPennyShell (rail+panel) as the right pane. MoneyPennyPanelTab.tsx
   — the one dispatcher every entry point already uses — now wraps every
   panel in it; zero broken links, financial-profile prep and the
   fs-operate "Open MoneyPenny" link land in the same workspace by
   construction. Browser acceptance explicitly NOT verified (no live
   Supabase credentials in this sandbox).

Full detail in the four individual commit messages on
spec/moneypenny-mpy2-3 (5eca8bcb0, 277f44e90, 5418f383e, 170c0e0fd).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Four squashed-for-deploy commits from spec/moneypenny-mpy2-3, regression-
tested together against current dev:

1. Import moneypenny/moneypenny001's real docs into docs/specs/moneypenny/
   (no document titled "handoff spec" exists in any of the three donor
   repos — confirmed by direct search; imported the closest real
   artifacts instead, kept separate, never fabricated an A/B/C mapping).
2. Decouple public-exposure from series='bridge': storage/register's
   skipEncryption now requires an explicit makePublic:true a caller sets
   deliberately, never a bare namespace-string match (extracted into an
   independently-tested shouldSkipEncryption helper).
3. A2 completion: infographic now publishes AND renders through the real
   bridge reader (knyts_bridge_editorial_config.infographic_url, additive
   migration, two-tier read keeps video/poster/copy working pre-migration)
   — previously bookkeeping-only. Also fixes a real bug: the placements
   route's slot validator never accepted 'infographic' at all.
4. C1: new MoneyPennyCopilotWorkspace reuses SmartTriadCopilotLayer (the
   SAME persistent-copilot component DevOn/Agent Me use, confirmed by
   direct investigation) as a left pane alongside the EXISTING
   MoneyPennyShell (rail+panel) as the right pane. MoneyPennyPanelTab.tsx
   — the one dispatcher every entry point already uses — now wraps every
   panel in it; zero broken links, financial-profile prep and the
   fs-operate "Open MoneyPenny" link land in the same workspace by
   construction. Browser acceptance explicitly NOT verified (no live
   Supabase credentials in this sandbox).

Full detail in the four individual commit messages on
spec/moneypenny-mpy2-3 (5eca8bcb0, 277f44e90, 5418f383e, 170c0e0fd).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Added | `tests/moneypenny-copilot-workspace.test.ts` |

## Stats

 4 files changed, 253 insertions(+), 12 deletions(-)
