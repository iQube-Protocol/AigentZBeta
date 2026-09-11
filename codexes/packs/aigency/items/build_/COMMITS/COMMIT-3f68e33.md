# Commit Brief: `3f68e33` — Give CI/Knightsbridge's MoneyPenny embed the same expand-to-metaMe-shell toggle as Horizen

| Field | Value |
|-------|-------|
| SHA | [`3f68e33`](https://github.com/iQube-Protocol/AigentZBeta/commit/3f68e337f3ffe5cde4a20f73e55d0569a3e3cfd7) |
| Author | Claude |
| Date | 2026-09-03T11:34:32Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Give CI/Knightsbridge's MoneyPenny embed the same expand-to-metaMe-shell toggle as Horizen

CI/Knightsbridge's Operate stage (FinancialSovereigntyOperateStage) had no
expand affordance at all — MoneyPennyBridgeEmbed always targeted the
standalone moneypenny-codex cartridge, fixed-focused, with a hand-built
"Close MoneyPenny workspace" / "Continue" header duplicating what the
journey stepper already does.

MoneyPennyBridgeEmbed gains an opt-in `expandable` mode that renders
through the exact same registry descriptor and buildEmbedSurfaceSrc call
Horizen's own Operate-stage override already uses
(JOURNEY_SURFACES['moneypenny-orchestration-focused']) — same breadcrumb,
same "Explore metaMe ↗" / "Focus view" toggle, same metame-codex target.
Expanding now reveals metaMe's real shell for CI/Knightsbridge exactly as
it does for Horizen, never the standalone cartridge. Default false leaves
Prepare's existing fixed-focused financial-profile embed untouched.

FinancialSovereigntyOperateStage's embed-open branch drops its own
Close/Continue header (redundant with the stepper) and passes `expandable`
straight through. The intro screen's own primary "Continue" CTA is
untouched.

Verified live against the running dev server on both CI and Knightsbridge:
the toggle renders, flips label, and the iframe frame set changes on
click, with no leftover Close/Continue text.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

CI/Knightsbridge's Operate stage (FinancialSovereigntyOperateStage) had no
expand affordance at all — MoneyPennyBridgeEmbed always targeted the
standalone moneypenny-codex cartridge, fixed-focused, with a hand-built
"Close MoneyPenny workspace" / "Continue" header duplicating what the
journey stepper already does.

MoneyPennyBridgeEmbed gains an opt-in `expandable` mode that renders
through the exact same registry descriptor and buildEmbedSurfaceSrc call
Horizen's own Operate-stage override already uses
(JOURNEY_SURFACES['moneypenny-orchestration-focused']) — same breadcrumb,
same "Explore metaMe ↗" / "Focus view" toggle, same metame-codex target.
Expanding now reveals metaMe's real shell for CI/Knightsbridge exactly as
it does for Horizen, never the standalone cartridge. Default false leaves
Prepare's existing fixed-focused financial-profile embed untouched.

FinancialSovereigntyOperateStage's embed-open branch drops its own
Close/Continue header (redundant with the stepper) and passes `expandable`
straight through. The intro screen's own primary "Continue" CTA is
untouched.

Verified live against the running dev server on both CI and Knightsbridge:
the toggle renders, flips label, and the iframe frame set changes on
click, with no leftover Close/Continue text.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/journey/FinancialSovereigntyOperateStage.tsx` |
| Modified | `components/journey/MoneyPennyBridgeEmbed.tsx` |
| Modified | `tests/fs-operate-stage.test.ts` |
| Modified | `tests/moneypenny-entry-continuity.test.ts` |
| Modified | `tests/moneypenny-experience-coherence-bridge-embed.test.ts` |

## Stats

 6 files changed, 157 insertions(+), 35 deletions(-)
