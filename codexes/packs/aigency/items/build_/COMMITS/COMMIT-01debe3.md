# Commit Brief: `01debe3` — Homecoming Phase II WP-A Increment 1: wire Aletheon into the specialist-consult seam

| Field | Value |
|-------|-------|
| SHA | [`01debe3`](https://github.com/iQube-Protocol/AigentZBeta/commit/01debe39ed8a8b37f1ff753e631ac522c43b09b5) |
| Author | Claude |
| Date | 2026-08-16T20:27:46Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Homecoming Phase II WP-A Increment 1: wire Aletheon into the specialist-consult seam

Adds 'aletheon' to the SpecialistId union and its five parallel
Record<SpecialistId, X> maps (specialistRouter.ts's
SPECIALIST_PERSONA_KEY/SPECIALIST_LABELS, specialistRecommender.ts's
SPECIALIST_LABELS/SPECIALIST_DESCRIPTIONS/SPECIALIST_ACTIVATION_GATE,
ask-agent's VALID_SPECIALISTS), the same pattern every other specialist
(Marketa, MoneyPenny, Nakamoto, Kn0w1, ...) already uses. Adds a
grounded templateResponse branch and a real aigent-aletheon persona
entry sourced verbatim from Aletheon's existing Agent Card (no
fabricated voice/content). Aletheon is now reachable via
POST /api/assistant/ask-agent like any other specialist.

This is explicitly Increment 1 only (per the WP-A Amendment in
2026-08-16_homecoming-phase-ii-activation-pack.md): it makes Aletheon
consultable as a specialist, not selectable as the agent fulfilling
the aigentMe role — that requires threading the persona's resolved
currentAigentMe assignment through the aigentMe Copilot's chat backend
(AigentMeWelcomeSplitTab.tsx / app/api/codex/chat/route.ts), which is
audited and scoped as a deliberately separate follow-up (Increment 2)
given its size and blast radius on shared, high-traffic infrastructure.

No identity/binding/grant table touched — confirmed by a new
regression pin in the added test file. Typecheck error count unchanged
at the established 675 baseline; 68 tests pass across the touched and
adjacent specialist/campaign suites.
```

## Body

Adds 'aletheon' to the SpecialistId union and its five parallel
Record<SpecialistId, X> maps (specialistRouter.ts's
SPECIALIST_PERSONA_KEY/SPECIALIST_LABELS, specialistRecommender.ts's
SPECIALIST_LABELS/SPECIALIST_DESCRIPTIONS/SPECIALIST_ACTIVATION_GATE,
ask-agent's VALID_SPECIALISTS), the same pattern every other specialist
(Marketa, MoneyPenny, Nakamoto, Kn0w1, ...) already uses. Adds a
grounded templateResponse branch and a real aigent-aletheon persona
entry sourced verbatim from Aletheon's existing Agent Card (no
fabricated voice/content). Aletheon is now reachable via
POST /api/assistant/ask-agent like any other specialist.

This is explicitly Increment 1 only (per the WP-A Amendment in
2026-08-16_homecoming-phase-ii-activation-pack.md): it makes Aletheon
consultable as a specialist, not selectable as the agent fulfilling
the aigentMe role — that requires threading the persona's resolved
currentAigentMe assignment through the aigentMe Copilot's chat backend
(AigentMeWelcomeSplitTab.tsx / app/api/codex/chat/route.ts), which is
audited and scoped as a deliberately separate follow-up (Increment 2)
given its size and blast radius on shared, high-traffic infrastructure.

No identity/binding/grant table touched — confirmed by a new
regression pin in the added test file. Typecheck error count unchanged
at the established 675 baseline; 68 tests pass across the touched and
adjacent specialist/campaign suites.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Modified | `app/data/personas.ts` |
| Modified | `services/agents/specialistRouter.ts` |
| Modified | `services/orchestration/specialistRecommender.ts` |
| Added | `tests/homecoming-phase-ii-wpa-aletheon.test.ts` |

## Stats

 5 files changed, 126 insertions(+), 2 deletions(-)
