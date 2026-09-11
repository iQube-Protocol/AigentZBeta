# Commit Brief: `6e961c0` — Add the missing Ingest act (capability_registered) plus its guided UI action

| Field | Value |
|-------|-------|
| SHA | [`6e961c0`](https://github.com/iQube-Protocol/AigentZBeta/commit/6e961c040f2e050cd7525275a5dbccabf758e02e) |
| Author | Claude |
| Date | 2026-08-09T21:48:06Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add the missing Ingest act (capability_registered) plus its guided UI action

New POST /api/journey/moneypenny-horizen/ingest writes the agent-scoped
capability_registered receipt no production path ever wrote (the only
existing writer, services/constitutional/capabilityRegistry.ts, scopes it
to aigent-z for an unrelated concept). Writes no Standing itself - the
existing state-route seed-award mechanism observes the new receipt on its
next read and accrues the nominal seed separately. Adds the
IngestIntoFactoryPanel guided action to the deploy/Ingest stage, ahead of
the existing read-only Ingested Assets catalogue, and corrects the stage's
own doc comment that had described the old AigentQube-presence bug as
current behavior.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

New POST /api/journey/moneypenny-horizen/ingest writes the agent-scoped
capability_registered receipt no production path ever wrote (the only
existing writer, services/constitutional/capabilityRegistry.ts, scopes it
to aigent-z for an unrelated concept). Writes no Standing itself - the
existing state-route seed-award mechanism observes the new receipt on its
next read and accrues the nominal seed separately. Adds the
IngestIntoFactoryPanel guided action to the deploy/Ingest stage, ahead of
the existing read-only Ingested Assets catalogue, and corrects the stage's
own doc comment that had described the old AigentQube-presence bug as
current behavior.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/journey/moneypenny-horizen/ingest/route.ts` |
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Added | `components/journey/IngestIntoFactoryPanel.tsx` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `tests/journey-admission-spine.test.ts` |
| Added | `tests/journey-ingest-route.test.ts` |
| Modified | `tests/journey-single-copilot.test.ts` |

## Stats

 8 files changed, 652 insertions(+), 12 deletions(-)
