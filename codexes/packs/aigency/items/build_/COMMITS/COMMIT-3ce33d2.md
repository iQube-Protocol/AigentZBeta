# Commit Brief: `3ce33d2` — Close SC-04 task/context versioning + complete C-01/C-03 MoneyPenny shell

| Field | Value |
|-------|-------|
| SHA | [`3ce33d2`](https://github.com/iQube-Protocol/AigentZBeta/commit/3ce33d2e5b67cd4048ff4bbab2db94c1eaa6897b) |
| Author | Claude |
| Date | 2026-09-02T13:36:33Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Close SC-04 task/context versioning + complete C-01/C-03 MoneyPenny shell

SC-04: extend SmartTriadCopilotLayer's existing groundContext-at-POST-time
mechanism with one additive, optional onRequestContext callback; add pure
services/moneypenny/contextVersioning.ts (panel+persona+environment+
profileRevision) so MoneyPennyCopilotWorkspace discards any copilot
response whose captured context no longer matches current state before it
can populate state or present an actionable suggestion. Explicit-click
(MS-5) and single-navigation-owner (MS-2) behavior from the prior C-02
slice untouched. 20 tests, 12 exercising the three required scenarios
directly (delayed response after panel change, financial-profile
revision, simulation/live switch).

C-03: five-area navigation (Home/My Money/Plan/Markets/Activity) derived
from the existing MONEYPENNY_CAPABILITY_GROUPS registry, replacing the
retired 14-item MoneyPennyCapabilityRail.tsx (deleted). Same
tryOpenInMountedCartridge seam, same deep links, same panel components —
only the navigation UI changed. CRM placed as a utility link per the
spec's own "not a sixth beginner journey" carve-out, not dropped.

C-01: corrected pane ratio (38%/62%, within the specified 35-40/60-65
ranges) and a narrow-width Conversation/Workspace toggle that keeps both
panes mounted at every width (visibility-only toggle), preserving
conversation history and task/panel state across the switch.

10 new source-shape tests cover the toggle's mount-preservation property
and the area-nav/rail-retirement wiring. 52 MoneyPenny tests total pass.
tsc holds at 677; full suite holds at 49 failed/17 failed files (same
pre-existing failures, zero new).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

SC-04: extend SmartTriadCopilotLayer's existing groundContext-at-POST-time
mechanism with one additive, optional onRequestContext callback; add pure
services/moneypenny/contextVersioning.ts (panel+persona+environment+
profileRevision) so MoneyPennyCopilotWorkspace discards any copilot
response whose captured context no longer matches current state before it
can populate state or present an actionable suggestion. Explicit-click
(MS-5) and single-navigation-owner (MS-2) behavior from the prior C-02
slice untouched. 20 tests, 12 exercising the three required scenarios
directly (delayed response after panel change, financial-profile
revision, simulation/live switch).

C-03: five-area navigation (Home/My Money/Plan/Markets/Activity) derived
from the existing MONEYPENNY_CAPABILITY_GROUPS registry, replacing the
retired 14-item MoneyPennyCapabilityRail.tsx (deleted). Same
tryOpenInMountedCartridge seam, same deep links, same panel components —
only the navigation UI changed. CRM placed as a utility link per the
spec's own "not a sixth beginner journey" carve-out, not dropped.

C-01: corrected pane ratio (38%/62%, within the specified 35-40/60-65
ranges) and a narrow-width Conversation/Workspace toggle that keeps both
panes mounted at every width (visibility-only toggle), preserving
conversation history and task/panel state across the switch.

10 new source-shape tests cover the toggle's mount-preservation property
and the area-nav/rail-retirement wiring. 52 MoneyPenny tests total pass.
tsc holds at 677; full suite holds at 49 failed/17 failed files (same
pre-existing failures, zero new).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/moneypenny/components/MoneyPennyAreaNav.tsx` |
| Deleted | `app/(shell)/moneypenny/components/MoneyPennyCapabilityRail.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyShell.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `codexes/packs/agentiq/updates/2026-09-02_moneypenny-authoritative-three-spec-import-and-reconciliation.md` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |
| Added | `services/moneypenny/contextVersioning.ts` |
| Added | `tests/moneypenny-context-versioning.test.ts` |
| Modified | `tests/moneypenny-copilot-workspace.test.ts` |

## Stats

 10 files changed, 825 insertions(+), 211 deletions(-)
