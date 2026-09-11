# Commit Brief: `9308a08` — Wire MoneyPenny copilot-to-capsule loop (C-02) + corrected AC-C/B/A crosswalk

| Field | Value |
|-------|-------|
| SHA | [`9308a08`](https://github.com/iQube-Protocol/AigentZBeta/commit/9308a08df13c448a201cdfb44ce5ebad026eda59) |
| Author | Claude |
| Date | 2026-09-02T13:14:31Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Wire MoneyPenny copilot-to-capsule loop (C-02) + corrected AC-C/B/A crosswalk

Reconcile the C1 shared shell against the authoritative Cartridge spec's
C-01/C-02/SC-04/09/10: extend the existing ChipTargetId/SuggestedLayoutHint
registered suggestion system (app/api/codex/chat/route.ts,
SmartTriadCopilotLayer.tsx) with 9 MoneyPenny financial layout identifiers,
give aigent-moneypenny its own layout-tag control block (previously silent),
and wire quickPrompts/onSuggestedLayouts in MoneyPennyCopilotWorkspace.tsx —
a suggestion only lights a dismissible banner (Companion Menu invariant
MS-5: deliberate act over ambient observation); the click navigates through
the same tryOpenInMountedCartridge seam the capability rail already uses
(MS-2: one owner of "which panel is active"). 22 tests pass (9 new).

Append the corrected acceptance-criteria crosswalk (AC-C01-20, AC-B01-20,
AC-A01-20) to the authoritative three-spec reconciliation doc, replacing
this session's earlier ad-hoc A2/B1/C1 labels with honest per-criterion
PASS/PARTIAL/NOT STARTED/BLOCKED/N/A statuses grounded in verified code —
no criterion asserted as browser-verified.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Reconcile the C1 shared shell against the authoritative Cartridge spec's
C-01/C-02/SC-04/09/10: extend the existing ChipTargetId/SuggestedLayoutHint
registered suggestion system (app/api/codex/chat/route.ts,
SmartTriadCopilotLayer.tsx) with 9 MoneyPenny financial layout identifiers,
give aigent-moneypenny its own layout-tag control block (previously silent),
and wire quickPrompts/onSuggestedLayouts in MoneyPennyCopilotWorkspace.tsx —
a suggestion only lights a dismissible banner (Companion Menu invariant
MS-5: deliberate act over ambient observation); the click navigates through
the same tryOpenInMountedCartridge seam the capability rail already uses
(MS-2: one owner of "which panel is active"). 22 tests pass (9 new).

Append the corrected acceptance-criteria crosswalk (AC-C01-20, AC-B01-20,
AC-A01-20) to the authoritative three-spec reconciliation doc, replacing
this session's earlier ad-hoc A2/B1/C1 labels with honest per-criterion
PASS/PARTIAL/NOT STARTED/BLOCKED/N/A statuses grounded in verified code —
no criterion asserted as browser-verified.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-09-02_moneypenny-authoritative-three-spec-import-and-reconciliation.md` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |
| Modified | `tests/moneypenny-copilot-workspace.test.ts` |

## Stats

 5 files changed, 353 insertions(+), 11 deletions(-)
