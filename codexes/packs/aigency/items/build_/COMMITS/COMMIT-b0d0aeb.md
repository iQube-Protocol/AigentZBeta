# Commit Brief: `b0d0aeb` — Fix OCSGA Bridge projection: Ian's exchange no longer hidden behind the delegation shell

| Field | Value |
|-------|-------|
| SHA | [`b0d0aeb`](https://github.com/iQube-Protocol/AigentZBeta/commit/b0d0aebdac5ded9b7ac6bff5a9a340b5cb35a15a) |
| Author | Claude |
| Date | 2026-08-29T13:14:58Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix OCSGA Bridge projection: Ian's exchange no longer hidden behind the delegation shell

Root cause #1: resolveJourneyState.ts's final currentStageId fallback picked
the first array-order incomplete stage, not the first genuinely-blocking one
— a skipped OPTIONAL stage (delegation-establish) outranked the real current
stage (freeze-attestation-ready) purely by array position, even though the
resolver's own prerequisites/priorStagesAllComplete logic already treats
that stage as non-blocking (JS-LAW-002). Now applies the same exemption to
the final fallback.

Root cause #2: ianJourneyState.ts's freeze-attestation-ready evidence read
attestation_ready_acknowledged from yourDeposited alone, treating "an
artifact exists" as "ready for freeze" regardless of pendingPrincipalAttestation
— so Ian's operator-assisted v1.3 artifact registration read as already
acknowledged even though he'd never confirmed it. Now requires
!pendingPrincipalAttestation too; an ordinary self-deposit is unaffected.

Gap: wire the existing confirmOperatorAssistedArtifact service as a new
'confirm' action on the exchange actions route, and surface
pendingPrincipalAttestation in IRLExchangeTab with a "Confirm this artifact"
control and a Freeze button that stays gated until confirmed. Never exposes
the registering operator's persona id (T0 identifier) to the client.

Bug B (the reported utm_source=copilot.com redirect) traced exhaustively —
usePassportSignInHost, PassportConnectPanel, JourneyRunSurface and every
grep across app/services/components/utils for utm_source, copilot.com,
router.replace, window.location — found zero in-app cause; the redirect is
external to this codebase.

Cherry-picked from review/irl-scoped-restoration-2026-08-27 (429dea146),
patch unaltered — this commit adds only the deploy trigger touch.
```

## Body

Root cause #1: resolveJourneyState.ts's final currentStageId fallback picked
the first array-order incomplete stage, not the first genuinely-blocking one
— a skipped OPTIONAL stage (delegation-establish) outranked the real current
stage (freeze-attestation-ready) purely by array position, even though the
resolver's own prerequisites/priorStagesAllComplete logic already treats
that stage as non-blocking (JS-LAW-002). Now applies the same exemption to
the final fallback.

Root cause #2: ianJourneyState.ts's freeze-attestation-ready evidence read
attestation_ready_acknowledged from yourDeposited alone, treating "an
artifact exists" as "ready for freeze" regardless of pendingPrincipalAttestation
— so Ian's operator-assisted v1.3 artifact registration read as already
acknowledged even though he'd never confirmed it. Now requires
!pendingPrincipalAttestation too; an ordinary self-deposit is unaffected.

Gap: wire the existing confirmOperatorAssistedArtifact service as a new
'confirm' action on the exchange actions route, and surface
pendingPrincipalAttestation in IRLExchangeTab with a "Confirm this artifact"
control and a Freeze button that stays gated until confirmed. Never exposes
the registering operator's persona id (T0 identifier) to the client.

Bug B (the reported utm_source=copilot.com redirect) traced exhaustively —
usePassportSignInHost, PassportConnectPanel, JourneyRunSurface and every
grep across app/services/components/utils for utm_source, copilot.com,
router.replace, window.location — found zero in-app cause; the redirect is
external to this codebase.

Cherry-picked from review/irl-scoped-restoration-2026-08-27 (429dea146),
patch unaltered — this commit adds only the deploy trigger touch.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/exchanges/[exchangeId]/actions/route.ts` |
| Modified | `app/triad/components/codex/tabs/IRLExchangeTab.tsx` |
| Modified | `services/journey/ianJourneyState.ts` |
| Modified | `services/journey/resolveJourneyState.ts` |
| Modified | `tests/journey-spine-resolver.test.ts` |
| Added | `tests/ocsga-bridge-projection-fix.test.ts` |

## Stats

 7 files changed, 592 insertions(+), 16 deletions(-)
