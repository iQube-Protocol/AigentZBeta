# Commit Brief: `0eaaa90` — JourneyCompanionCarousel and journey narration are agent-generic

| Field | Value |
|-------|-------|
| SHA | [`0eaaa90`](https://github.com/iQube-Protocol/AigentZBeta/commit/0eaaa90b68c85d1ec509b2feefbb4dc44c08909b) |
| Author | Claude |
| Date | 2026-08-09T01:12:17Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
JourneyCompanionCarousel and journey narration are agent-generic

JourneyCompanionCarousel silently defaulted to MoneyPenny: it imported
HORIZEN_MONEYPENNY_JOURNEY directly, rendered a static JOURNEY_INTRO_TEXT
naming her by name, and fetched journey state with no agentSlug at all
(always reading the default agent's state regardless of which agent was
actually selected on the Journey tab). The journey definition itself
(horizenMoneyPennyJourney.ts) hardcoded "MoneyPenny" in ~10 narration
strings, so even PilotJourneyTab — which already threads selectedAgentSlug
correctly everywhere else — rendered the wrong agent's name in stage copy.

Added services/journey/journeyCopyTemplate.ts (renderJourneyCopy +
AGENT_DISPLAY_NAME_TOKEN) and replaced every hardcoded "MoneyPenny" in
horizenMoneyPennyJourney.ts's rendered narration with the token. Added
services/journey/selectedPilotAgent.ts — a small, SSR-safe, localStorage-
backed shared record of the operator's last-selected pilot agent, since the
Companion carousel and the Journey tab live in separate React trees with no
existing shared state. PilotJourneyTab now reads it on mount and writes it on
every change; JourneyCompanionCarousel now accepts an optional agentSlug
prop, resolves the shared selection when absent, uses it in its state fetch,
and renders buildJourneyIntroText(agent)/renderJourneyCopy(...) instead of
static, MoneyPenny-named text.

journeyCompanionTrigger.ts's JOURNEY_INTRO_TEXT constant is now
buildJourneyIntroText(agent), a function of the selected agent.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

JourneyCompanionCarousel silently defaulted to MoneyPenny: it imported
HORIZEN_MONEYPENNY_JOURNEY directly, rendered a static JOURNEY_INTRO_TEXT
naming her by name, and fetched journey state with no agentSlug at all
(always reading the default agent's state regardless of which agent was
actually selected on the Journey tab). The journey definition itself
(horizenMoneyPennyJourney.ts) hardcoded "MoneyPenny" in ~10 narration
strings, so even PilotJourneyTab — which already threads selectedAgentSlug
correctly everywhere else — rendered the wrong agent's name in stage copy.

Added services/journey/journeyCopyTemplate.ts (renderJourneyCopy +
AGENT_DISPLAY_NAME_TOKEN) and replaced every hardcoded "MoneyPenny" in
horizenMoneyPennyJourney.ts's rendered narration with the token. Added
services/journey/selectedPilotAgent.ts — a small, SSR-safe, localStorage-
backed shared record of the operator's last-selected pilot agent, since the
Companion carousel and the Journey tab live in separate React trees with no
existing shared state. PilotJourneyTab now reads it on mount and writes it on
every change; JourneyCompanionCarousel now accepts an optional agentSlug
prop, resolves the shared selection when absent, uses it in its state fetch,
and renders buildJourneyIntroText(agent)/renderJourneyCopy(...) instead of
static, MoneyPenny-named text.

journeyCompanionTrigger.ts's JOURNEY_INTRO_TEXT constant is now
buildJourneyIntroText(agent), a function of the selected agent.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/JourneyCompanionCarousel.tsx` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/journeyCompanionTrigger.ts` |
| Added | `services/journey/journeyCopyTemplate.ts` |
| Added | `services/journey/selectedPilotAgent.ts` |
| Modified | `tests/journey-companion-trigger.test.ts` |
| Added | `tests/journey-narration-genericity.test.ts` |
| Modified | `tests/principal-wallet-surface.test.ts` |

## Stats

 10 files changed, 249 insertions(+), 34 deletions(-)
