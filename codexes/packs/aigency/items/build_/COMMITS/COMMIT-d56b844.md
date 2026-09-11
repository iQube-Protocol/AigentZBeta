# Commit Brief: `d56b844` — Pre-recording Horizen polish: compact narrator header + Register ceremony replay

| Field | Value |
|-------|-------|
| SHA | [`d56b844`](https://github.com/iQube-Protocol/AigentZBeta/commit/d56b8444cbcefad7a30581ca7bd5edc0ab46cb1c) |
| Author | Claude |
| Date | 2026-08-10T06:41:38Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Pre-recording Horizen polish: compact narrator header + Register ceremony replay

Part A: collapse the Threshold Guide header to one compressed top row —
drop "Destination: aigentMe", fold the stage description into a
RotatingStatusLine narrator (what's happening <-> constitutional
consequence, per-stage vocabulary), and shrink the Refresh control to an
icon + "State" label. Frees the stage description row for the journey
itself.

Part B: diagnosed (no code change) that Nakamoto's Ingest badge already
renders correctly — IngestIntoFactoryPanel structurally cannot show "Ingest
into Factory" once alreadyIngested is true, and the DVN-pending fork badge
is additive, never gating the emerald tick.

Part C: add a non-mutating Register ceremony replay (RegisterCeremonyReplay)
that reconstructs an already-registered agent's seven-step wallet-signing
ceremony from canonical receipts alone — read-only, no executable controls,
built generically for any agent. Two of the seven steps (wallet ready,
mandate prepared) have no receipt type and carry authority: 'inferred'
rather than fabricated evidence; the remaining five carry authority:
'evidence' from their real, distinct receipts. Projected once in the state
route's registerCeremony field and threaded through JourneyRunSurface /
PilotJourneyTab exactly like ratifySubPredicates — never a second
computation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Part A: collapse the Threshold Guide header to one compressed top row —
drop "Destination: aigentMe", fold the stage description into a
RotatingStatusLine narrator (what's happening <-> constitutional
consequence, per-stage vocabulary), and shrink the Refresh control to an
icon + "State" label. Frees the stage description row for the journey
itself.

Part B: diagnosed (no code change) that Nakamoto's Ingest badge already
renders correctly — IngestIntoFactoryPanel structurally cannot show "Ingest
into Factory" once alreadyIngested is true, and the DVN-pending fork badge
is additive, never gating the emerald tick.

Part C: add a non-mutating Register ceremony replay (RegisterCeremonyReplay)
that reconstructs an already-registered agent's seven-step wallet-signing
ceremony from canonical receipts alone — read-only, no executable controls,
built generically for any agent. Two of the seven steps (wallet ready,
mandate prepared) have no receipt type and carry authority: 'inferred'
rather than fabricated evidence; the remaining five carry authority:
'evidence' from their real, distinct receipts. Projected once in the state
route's registerCeremony field and threaded through JourneyRunSurface /
PilotJourneyTab exactly like ratifySubPredicates — never a second
computation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Added | `components/journey/RegisterCeremonyReplay.tsx` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `tests/cfs-055-coherence-canaries.test.ts` |
| Modified | `tests/journey-orient-stage.test.ts` |
| Modified | `tests/pnl-evidence-wiring.test.ts` |
| Added | `tests/register-ceremony-replay.test.ts` |
| Modified | `types/journey.ts` |

## Stats

 12 files changed, 611 insertions(+), 47 deletions(-)
