# Commit Brief: `e717187` — Fix MoneyPenny Home cross-area nav; add specialist cards; rename Aigent Factor

| Field | Value |
|-------|-------|
| SHA | [`e717187`](https://github.com/iQube-Protocol/AigentZBeta/commit/e71718781e8dcca1c043951ca2ba098652d9ad31) |
| Author | Claude |
| Date | 2026-09-05T09:09:02Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix MoneyPenny Home cross-area nav; add specialist cards; rename Aigent Factor

Root cause: MoneyPennyPanelTab's cross-area navigate() looked up a
hardcoded cartridge id ('moneypenny-codex') in the global
CartridgePresenceRegistry. That id only matched the real registered
entry for the standalone mount; every other host (metaMe's
metame-codex, reached via the FS Bridge) registers under its own
outer codex id, so the lookup silently missed and nearly every
cross-area Home card (all but the two same-area "just ask
MoneyPenny" items) no-op'd. Confirmed by a real render+click test
before any fix: the identical click reliably worked against a
'moneypenny-codex'-registered host and reliably failed against
'metame-codex'.

Fix: new CodexHostNavigationContext gives MoneyPennyPanelTab the
mounted host's own setActiveTab directly (provided by
CodexPanelDynamic during its own render, no id to get wrong, no
effect-ordering race). tryOpenInMountedCartridge remains only as a
defensive fallback for a mount outside any CodexPanelDynamic tree. A
failed cross-area navigation now surfaces a visible, dismissible
error banner instead of silently doing nothing.

Adds a collapsed "Specialists" section to Home (Aigent Factor, Aegis,
Aigent Nakamoto, Aigent Know1), sourced from the existing
REGISTRABLE_AGENTS descriptor, each navigating with a typed intent
{panel, specialistId} that the destination panel consumes exactly
once via the same one-shot sessionStorage idiom the existing
cross-area panel handoff already uses.

Renames Factor's canonical display name to "Aigent Factor" at its one
source of truth (REGISTRABLE_AGENTS) since bare "Factor" reads as
generic UI copy; every downstream projection (Agent Card, aigentQube
legibility source, specialist response labels, Candidate Intake copy)
now reads or matches that same value. Service Orchestration needed no
code change — it already projected displayName from the API.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Root cause: MoneyPennyPanelTab's cross-area navigate() looked up a
hardcoded cartridge id ('moneypenny-codex') in the global
CartridgePresenceRegistry. That id only matched the real registered
entry for the standalone mount; every other host (metaMe's
metame-codex, reached via the FS Bridge) registers under its own
outer codex id, so the lookup silently missed and nearly every
cross-area Home card (all but the two same-area "just ask
MoneyPenny" items) no-op'd. Confirmed by a real render+click test
before any fix: the identical click reliably worked against a
'moneypenny-codex'-registered host and reliably failed against
'metame-codex'.

Fix: new CodexHostNavigationContext gives MoneyPennyPanelTab the
mounted host's own setActiveTab directly (provided by
CodexPanelDynamic during its own render, no id to get wrong, no
effect-ordering race). tryOpenInMountedCartridge remains only as a
defensive fallback for a mount outside any CodexPanelDynamic tree. A
failed cross-area navigation now surfaces a visible, dismissible
error banner instead of silently doing nothing.

Adds a collapsed "Specialists" section to Home (Aigent Factor, Aegis,
Aigent Nakamoto, Aigent Know1), sourced from the existing
REGISTRABLE_AGENTS descriptor, each navigating with a typed intent
{panel, specialistId} that the destination panel consumes exactly
once via the same one-shot sessionStorage idiom the existing
cross-area panel handoff already uses.

Renames Factor's canonical display name to "Aigent Factor" at its one
source of truth (REGISTRABLE_AGENTS) since bare "Factor" reads as
generic UI copy; every downstream projection (Agent Card, aigentQube
legibility source, specialist response labels, Candidate Intake copy)
now reads or matches that same value. Service Orchestration needed no
code change — it already projected displayName from the API.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/moneypenny/components/CandidateIntakePanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyOverviewPanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneyPennyNavigation.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `app/api/agents/factor/agent-card.json/route.ts` |
| Added | `app/components/codex/CodexHostNavigationContext.tsx` |
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-05_moneypenny-home-cross-area-nav-fix-and-specialist-access.md` |
| Modified | `services/agents/specialistRouter.ts` |
| Modified | `services/horizen/registrableAgents.ts` |
| Modified | `services/iqube/legibility/sources/aigentQubeSource.ts` |
| Modified | `services/orchestration/specialistRecommender.ts` |
| Modified | `services/smarttriad/specialistDelegation.ts` |
| Modified | `tests/moneypenny-candidate-intake-workspace.test.tsx` |
| Added | `tests/moneypenny-cross-area-integration-diagnostic.test.tsx` |
| Added | `tests/moneypenny-home-cross-area-navigation.test.tsx` |
| Added | `tests/moneypenny-home-nav-diagnostic.test.tsx` |
| Modified | `tests/provision-platform-agent-route.test.ts` |

## Stats

 22 files changed, 1194 insertions(+), 47 deletions(-)
