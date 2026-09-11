# Commit Brief: `170c0e0` — C1: MoneyPenny copilot-left/chips-right shell, reusing SmartTriadCopilotLayer

| Field | Value |
|-------|-------|
| SHA | [`170c0e0`](https://github.com/iQube-Protocol/AigentZBeta/commit/170c0e0fd4fa74ff33b2b68eea9330ef5a0fc909) |
| Author | Claude |
| Date | 2026-09-02T12:38:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
C1: MoneyPenny copilot-left/chips-right shell, reusing SmartTriadCopilotLayer

New MoneyPennyCopilotWorkspace wraps the EXISTING MoneyPennyShell
(capability rail + panel content) as its right pane, with
SmartTriadCopilotLayer (variant="panel") as a persistent left pane — the
SAME shared component DevOn (DevCommandCenterTab.tsx) and Agent Me
(AigentMeWelcomeSplitTab.tsx) already use for their split-pane pattern,
confirmed by direct investigation rather than assumed from
CodexCopilotLayer.tsx's absence of MoneyPenny wiring (that component is
a separate, cartridge-wide floating chat bubble, unrelated to the
DevOn/Agent-Me split-pane).

MoneyPennyPanelTab.tsx — the ONE dispatcher every moneypenny-codex entry
point already routes through — now wraps every panel in this workspace
instead of bare MoneyPennyShell. Every existing buildCodexUrl('moneypenny',
{tab}) deep link keeps resolving to the same panel component unchanged;
none of the 14 existing panels were touched. The fs-operate stage's "Open
MoneyPenny" link (FinancialSovereigntyOperateStage.tsx) needed no change
either — it already routes through this same dispatcher, so financial-
profile preparation and the Operate destination land in the identical
workspace by construction.

groundContext carries a financial-profile summary (fetched via the SAME
GET /api/moneypenny/financial-profile route FinancialProfilePanel.tsx
itself reads) whenever that capsule is active, refetched on mount and on
tab focus, so a message sent after editing/computing a profile carries
the fresh state to the copilot.

Browser acceptance (open MoneyPenny -> converse -> edit financial profile
-> see updated context) is explicitly NOT verified — this sandbox has no
live Supabase credentials, per this session's standing constraint.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

New MoneyPennyCopilotWorkspace wraps the EXISTING MoneyPennyShell
(capability rail + panel content) as its right pane, with
SmartTriadCopilotLayer (variant="panel") as a persistent left pane — the
SAME shared component DevOn (DevCommandCenterTab.tsx) and Agent Me
(AigentMeWelcomeSplitTab.tsx) already use for their split-pane pattern,
confirmed by direct investigation rather than assumed from
CodexCopilotLayer.tsx's absence of MoneyPenny wiring (that component is
a separate, cartridge-wide floating chat bubble, unrelated to the
DevOn/Agent-Me split-pane).

MoneyPennyPanelTab.tsx — the ONE dispatcher every moneypenny-codex entry
point already routes through — now wraps every panel in this workspace
instead of bare MoneyPennyShell. Every existing buildCodexUrl('moneypenny',
{tab}) deep link keeps resolving to the same panel component unchanged;
none of the 14 existing panels were touched. The fs-operate stage's "Open
MoneyPenny" link (FinancialSovereigntyOperateStage.tsx) needed no change
either — it already routes through this same dispatcher, so financial-
profile preparation and the Operate destination land in the identical
workspace by construction.

groundContext carries a financial-profile summary (fetched via the SAME
GET /api/moneypenny/financial-profile route FinancialProfilePanel.tsx
itself reads) whenever that capsule is active, refetched on mount and on
tab focus, so a message sent after editing/computing a profile carries
the fresh state to the copilot.

Browser acceptance (open MoneyPenny -> converse -> edit financial profile
-> see updated context) is explicitly NOT verified — this sandbox has no
live Supabase credentials, per this session's standing constraint.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Added | `tests/moneypenny-copilot-workspace.test.ts` |

## Stats

 3 files changed, 252 insertions(+), 11 deletions(-)
