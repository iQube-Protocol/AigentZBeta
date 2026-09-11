# Commit Brief: `418a4f0` — Correct MoneyPenny experience coherence: one nav row, restrained Home, role selector

| Field | Value |
|-------|-------|
| SHA | [`418a4f0`](https://github.com/iQube-Protocol/AigentZBeta/commit/418a4f0181e3e3a7abd5776880d93d422ada9a16) |
| Author | Claude |
| Date | 2026-09-03T02:28:58Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Correct MoneyPenny experience coherence: one nav row, restrained Home, role selector

- Collapse MONEYPENNY_CARTRIDGE from 14 tabs to one registered tab (singleTabMode),
  eliminating the outer HFT/Connect/Service/Administer bar + 14-tab sub-header;
  legacy ?tab= slugs still resolve via a new MoneyPennyNavigationContext that
  replaces the broken tryOpenInMountedCartridge in-app navigation.
- Rebuild MoneyPennyOverviewPanel (Home) around 3 primary actions (Understand my
  money / Make a plan / Explore investing) with remaining capabilities behind
  closed-by-default <details> groups, instead of the full capability registry
  as cards.
- Remove the oversized "Financial Services Runtime Agents" banner + always-on
  connection-light strip; diagnostics preserved behind a closed disclosure.
- Retire the duplicate right-pane MoneyPennyChat panel; move CRM under Activity.
- Fix CI/Knightsbridge Prepare + Operate to embed the real MoneyPenny workspace
  in an iframe (MoneyPennyBridgeEmbed) instead of window.location.assign;
  suppress the outer JourneyCopilotHost while embedded (journey:host-copilot-
  suppress event + registry-declared suppressHostCopilot) to kill Horizen's
  dual-copilot defect.
- Add the MoneyPenny role selector (Advisor/Architect/Runtime), wired into
  groundContext.providerMode and SC-04 context-versioning's role field so a
  role change correctly invalidates stale in-flight responses; selection is
  local-only and cannot change identity, delegation, or sim/live state.
- Update pinned tests for the above + add dedicated coherence/bridge-embed/
  role-selector proof tests. Full regression: tsc holds at established
  baseline (677), vitest 48 failed/15 failed files matches the pre-existing
  known-flaky baseline by name (unrelated to this change).

Deploy trigger folded into this commit per CLAUDE.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

- Collapse MONEYPENNY_CARTRIDGE from 14 tabs to one registered tab (singleTabMode),
  eliminating the outer HFT/Connect/Service/Administer bar + 14-tab sub-header;
  legacy ?tab= slugs still resolve via a new MoneyPennyNavigationContext that
  replaces the broken tryOpenInMountedCartridge in-app navigation.
- Rebuild MoneyPennyOverviewPanel (Home) around 3 primary actions (Understand my
  money / Make a plan / Explore investing) with remaining capabilities behind
  closed-by-default <details> groups, instead of the full capability registry
  as cards.
- Remove the oversized "Financial Services Runtime Agents" banner + always-on
  connection-light strip; diagnostics preserved behind a closed disclosure.
- Retire the duplicate right-pane MoneyPennyChat panel; move CRM under Activity.
- Fix CI/Knightsbridge Prepare + Operate to embed the real MoneyPenny workspace
  in an iframe (MoneyPennyBridgeEmbed) instead of window.location.assign;
  suppress the outer JourneyCopilotHost while embedded (journey:host-copilot-
  suppress event + registry-declared suppressHostCopilot) to kill Horizen's
  dual-copilot defect.
- Add the MoneyPenny role selector (Advisor/Architect/Runtime), wired into
  groundContext.providerMode and SC-04 context-versioning's role field so a
  role change correctly invalidates stale in-flight responses; selection is
  local-only and cannot change identity, delegation, or sim/live state.
- Update pinned tests for the above + add dedicated coherence/bridge-embed/
  role-selector proof tests. Full regression: tsc holds at established
  baseline (677), vitest 48 failed/15 failed files matches the pre-existing
  known-flaky baseline by name (unrelated to this change).

Deploy trigger folded into this commit per CLAUDE.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyAreaNav.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyOverviewPanel.tsx` |
| Added | `app/(shell)/moneypenny/components/MoneyPennyRoleSelector.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyShell.tsx` |
| Added | `app/(shell)/moneypenny/components/moneyPennyNavigation.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `components/journey/FinancialSovereigntyOperateStage.tsx` |
| Modified | `components/journey/FinancialSovereigntyPrepareCrossStage.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Added | `components/journey/MoneyPennyBridgeEmbed.tsx` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `services/moneypenny/contextVersioning.ts` |
| Modified | `tests/fs-operate-embed-viewport-parity.test.ts` |
| Modified | `tests/fs-operate-stage.test.ts` |
| Modified | `tests/moneypenny-agentme-entry.test.ts` |
| Modified | `tests/moneypenny-b2-prepare.test.ts` |
| Modified | `tests/moneypenny-c15-educational-video.test.ts` |
| Modified | `tests/moneypenny-capability-navigation.test.ts` |
| Modified | `tests/moneypenny-context-versioning.test.ts` |
| Modified | `tests/moneypenny-copilot-workspace.test.ts` |
| Modified | `tests/moneypenny-entry-continuity.test.ts` |
| Added | `tests/moneypenny-experience-coherence-bridge-embed.test.ts` |
| Added | `tests/moneypenny-experience-coherence-navigation.test.ts` |
| Modified | `tests/moneypenny-financial-profile.test.ts` |
| Modified | `tests/moneypenny-fullscreen-takeover.test.ts` |
| Modified | `tests/moneypenny-risk-envelope.test.ts` |

## Stats

 30 files changed, 1358 insertions(+), 565 deletions(-)
