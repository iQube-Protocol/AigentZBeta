# Commit Brief: `757561a` — Restore native MoneyPenny tab hierarchy, move role selector to copilot header, compact capability carousel, fix viewport height

| Field | Value |
|-------|-------|
| SHA | [`757561a`](https://github.com/iQube-Protocol/AigentZBeta/commit/757561af4a20548447d8eebb2bfab8d87a2166ba) |
| Author | Claude |
| Date | 2026-09-03T04:59:50Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Restore native MoneyPenny tab hierarchy, move role selector to copilot header, compact capability carousel, fix viewport height

Supersedes the earlier single-tab MoneyPenny collapse per operator
correction: the five areas (Home/My Money/Plan/Markets/Activity) are now
real native CodexTabs under a "MoneyPenny" tabGroup (mirroring Agent Me's
own tabGroup pattern), with an adminOnly Admin tab as an honest, non-
fabricated placeholder (audited against git history: no MoneyPenny admin
capability has ever existed). The Advisor/Architect/Runtime role selector
moves from the right pane into the left copilot header, replacing the
redundant "Financial Services Runtime" subtitle. The capability strip
collapses into one non-wrapping, horizontally scrollable carousel per
area, with Connection diagnostics folded in as its final button and an
expandable detail region below instead of a standalone accordion.

Fixes the "thin composer strip" viewport defect: MoneyPennyCopilotWorkspace
no longer hardcodes h-[calc(100vh-96px)] (which resolves against the wrong
viewport inside a nested bridge/journey iframe) — now h-full, cascading
correctly through CodexPanelDynamic's verified flex-1/min-h-0 ancestor
chain in both the standalone route and nested embeds.

Two real bugs found via live Playwright testing against the running dev
server, both fixed:
- React doesn't remount MoneyPennyPanelTab on a native area-tab switch
  (all five area tabs share one component registry entry, so switching
  areas is a props-only update) — activePanel's useState lazy initializer
  never re-ran, so the panel content silently kept showing whichever area
  mounted first. Fixed with a lastAreaRef + effect that re-resolves
  activePanel whenever area actually changes.
- The legacy-deep-link self-heal effect and CodexPanelDynamic's ancestor
  cartridge-presence registration effect commit in the same React flush,
  child-before-parent — so on a fresh page load (e.g. Horizen's own
  ?tab=service-orchestration expand link), the self-heal ran before the
  cartridge had registered, and tryOpenInMountedCartridge silently no-op'd.
  Deferred the call past the commit via setTimeout(0).

Bridge/journey embeds (CI, Knightsbridge) move from focusedNavDepth 0 to 1
so the area sub-header stays navigable inside the embed, matching the
knyts-bridge-buy-store precedent. Live-verified: all five areas render
correct default content and preserve conversation state across switches;
cross-area navigation from Home's three primary cards lands on the exact
intended panel; the depth-1 embed and viewport fix hold under a real
nested iframe at the bridge stage's own width, including the mobile
Conversation/Workspace pane toggle; tablet/portrait/mobile-narrow
breakpoints show no page-wide horizontal overflow and a non-wrapping,
scrollable capability carousel down to 375px.

Full MoneyPenny-scoped vitest suite (23 files/397 tests) and the full
repo suite pass with no new failures against the established baseline
(679 tsc errors — unchanged .next/build-cache noise; 48 failed/9463
passed, 15 failed files, all pre-existing and unrelated).

Not verified in this pass (named per the operator's own requirement
rather than marked complete): the full authenticated CI/Knightsbridge
journey run (sign-in, stage progression) and Horizen's focused/expanded
views — verified instead via the exact iframe URL/mechanism those stages
construct, served from a real same-origin host to satisfy the embed CSP;
and the Admin tab's admin-visible case, since no admin-authenticated
persona was reachable in this sandbox (its adminOnly gate and non-admin
absence were both confirmed).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Supersedes the earlier single-tab MoneyPenny collapse per operator
correction: the five areas (Home/My Money/Plan/Markets/Activity) are now
real native CodexTabs under a "MoneyPenny" tabGroup (mirroring Agent Me's
own tabGroup pattern), with an adminOnly Admin tab as an honest, non-
fabricated placeholder (audited against git history: no MoneyPenny admin
capability has ever existed). The Advisor/Architect/Runtime role selector
moves from the right pane into the left copilot header, replacing the
redundant "Financial Services Runtime" subtitle. The capability strip
collapses into one non-wrapping, horizontally scrollable carousel per
area, with Connection diagnostics folded in as its final button and an
expandable detail region below instead of a standalone accordion.

Fixes the "thin composer strip" viewport defect: MoneyPennyCopilotWorkspace
no longer hardcodes h-[calc(100vh-96px)] (which resolves against the wrong
viewport inside a nested bridge/journey iframe) — now h-full, cascading
correctly through CodexPanelDynamic's verified flex-1/min-h-0 ancestor
chain in both the standalone route and nested embeds.

Two real bugs found via live Playwright testing against the running dev
server, both fixed:
- React doesn't remount MoneyPennyPanelTab on a native area-tab switch
  (all five area tabs share one component registry entry, so switching
  areas is a props-only update) — activePanel's useState lazy initializer
  never re-ran, so the panel content silently kept showing whichever area
  mounted first. Fixed with a lastAreaRef + effect that re-resolves
  activePanel whenever area actually changes.
- The legacy-deep-link self-heal effect and CodexPanelDynamic's ancestor
  cartridge-presence registration effect commit in the same React flush,
  child-before-parent — so on a fresh page load (e.g. Horizen's own
  ?tab=service-orchestration expand link), the self-heal ran before the
  cartridge had registered, and tryOpenInMountedCartridge silently no-op'd.
  Deferred the call past the commit via setTimeout(0).

Bridge/journey embeds (CI, Knightsbridge) move from focusedNavDepth 0 to 1
so the area sub-header stays navigable inside the embed, matching the
knyts-bridge-buy-store precedent. Live-verified: all five areas render
correct default content and preserve conversation state across switches;
cross-area navigation from Home's three primary cards lands on the exact
intended panel; the depth-1 embed and viewport fix hold under a real
nested iframe at the bridge stage's own width, including the mobile
Conversation/Workspace pane toggle; tablet/portrait/mobile-narrow
breakpoints show no page-wide horizontal overflow and a non-wrapping,
scrollable capability carousel down to 375px.

Full MoneyPenny-scoped vitest suite (23 files/397 tests) and the full
repo suite pass with no new failures against the established baseline
(679 tsc errors — unchanged .next/build-cache noise; 48 failed/9463
passed, 15 failed files, all pre-existing and unrelated).

Not verified in this pass (named per the operator's own requirement
rather than marked complete): the full authenticated CI/Knightsbridge
journey run (sign-in, stage progression) and Horizen's focused/expanded
views — verified instead via the exact iframe URL/mechanism those stages
construct, served from a real same-origin host to satisfy the embed CSP;
and the Admin tab's admin-visible case, since no admin-authenticated
persona was reachable in this sandbox (its adminOnly gate and non-admin
absence were both confirmed).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/moneypenny/components/MoneyPennyAdminTab.tsx` |
| Deleted | `app/(shell)/moneypenny/components/MoneyPennyAreaNav.tsx` |
| Added | `app/(shell)/moneypenny/components/MoneyPennyCapabilityCarousel.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Deleted | `app/(shell)/moneypenny/components/MoneyPennyRoleSelector.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyShell.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneyPennyNavigation.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `app/components/wallet/MoneyPennyWalletRuntime.tsx` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `components/journey/FinancialSovereigntyOperateStage.tsx` |
| Modified | `components/journey/FinancialSovereigntyPrepareCrossStage.tsx` |
| Modified | `components/journey/MoneyPennyBridgeEmbed.tsx` |
| Added | `components/smarttriad/copilot/MoneyPennyRoleSelector.tsx` |
| Modified | `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` |
| Modified | `data/codex-configs.ts` |
| Modified | `tests/fs-operate-embed-viewport-parity.test.ts` |
| Modified | `tests/fs-operate-stage.test.ts` |
| Modified | `tests/moneypenny-b2-prepare.test.ts` |
| Modified | `tests/moneypenny-capability-navigation.test.ts` |
| Modified | `tests/moneypenny-copilot-workspace.test.ts` |
| Modified | `tests/moneypenny-entry-continuity.test.ts` |
| Modified | `tests/moneypenny-experience-coherence-bridge-embed.test.ts` |
| Modified | `tests/moneypenny-experience-coherence-navigation.test.ts` |
| Modified | `tests/moneypenny-financial-profile.test.ts` |
| Modified | `tests/moneypenny-risk-envelope.test.ts` |
| Modified | `tests/moneypenny-standalone-route-compat-mapping.test.ts` |

## Stats

 28 files changed, 1123 insertions(+), 562 deletions(-)
