# Commit Brief: `d427c26` — Wire the registration Standing seed into production, generically

| Field | Value |
|-------|-------|
| SHA | [`d427c26`](https://github.com/iQube-Protocol/AigentZBeta/commit/d427c26e2a63ba0032e4bd888e87535d6fd898f8) |
| Author | Claude |
| Date | 2026-08-09T00:41:56Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Wire the registration Standing seed into production, generically

registrationStandingSeed.ts fully specified the nominal one-time Standing
award for a completed registration (amount=1, basis, the settle-then-award
contract) but had zero production callers — the journey state route read the
registry_standing_seeded settled fact but nothing ever wrote it, so
initialStandingAwarded was always 0 for every agent.

Added services/journey/registrationStandingSeedAward.ts as the one production
implementation of the documented contract, and wired it into the journey
state route at the same point it already observes factory-ingestion
eligibility — mirroring the inline-settle idiom that route already uses for
passport_is_issued, not a new pattern. Agent-generic: takes a
RegistrableAgentConfig, never branches on slug. Idempotent via settleFact's
own alreadySettled semantics, safe against retried GETs and concurrent
requests. Attributed to the real active operator persona, not a static
string. Reflected within the same request/response that triggers the award.

Resolution record + candidate invariant written first, per CLAUDE.md's
resolution-to-invariant loop: RES-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001
/ CI-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

registrationStandingSeed.ts fully specified the nominal one-time Standing
award for a completed registration (amount=1, basis, the settle-then-award
contract) but had zero production callers — the journey state route read the
registry_standing_seeded settled fact but nothing ever wrote it, so
initialStandingAwarded was always 0 for every agent.

Added services/journey/registrationStandingSeedAward.ts as the one production
implementation of the documented contract, and wired it into the journey
state route at the same point it already observes factory-ingestion
eligibility — mirroring the inline-settle idiom that route already uses for
passport_is_issued, not a new pattern. Agent-generic: takes a
RegistrableAgentConfig, never branches on slug. Idempotent via settleFact's
own alreadySettled semantics, safe against retried GETs and concurrent
requests. Attributed to the real active operator persona, not a static
string. Reflected within the same request/response that triggers the award.

Resolution record + candidate invariant written first, per CLAUDE.md's
resolution-to-invariant loop: RES-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001
/ CI-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Added | `codexes/packs/agentiq/resolution-records/candidate-invariants/CI-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.json` |
| Added | `codexes/packs/agentiq/resolution-records/records/RES-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.json` |
| Added | `services/journey/registrationStandingSeedAward.ts` |
| Added | `tests/registration-standing-seed-award.test.ts` |

## Stats

 5 files changed, 425 insertions(+)
