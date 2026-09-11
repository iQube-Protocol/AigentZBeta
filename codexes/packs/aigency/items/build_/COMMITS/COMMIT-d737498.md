# Commit Brief: `d737498` — add artifact class (canonical/operational) toggle to qriptopian upload modal

| Field | Value |
|-------|-------|
| SHA | [`d737498`](https://github.com/iQube-Protocol/AigentZBeta/commit/d737498f0e586a7f7ba89388bf440c984de728d8) |
| Author | Claude |
| Date | 2026-08-11T20:41:43Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add artifact class (canonical/operational) toggle to qriptopian upload modal
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/admin/codex/components/CodexUploadModal.tsx` |
| Modified | `app/api/_lib/supabaseServer.ts` |
| Modified | `app/bridge/ci/page.tsx` |
| Modified | `app/bridge/knyts/page.tsx` |
| Modified | `app/components/metaVatar/MetaAvatar.tsx` |
| Added | `app/components/metaVatar/MetaAvatarHost.tsx` |
| Added | `components/journey/ArtifactMattedFrame.tsx` |
| Modified | `components/journey/BridgeMediaStage.tsx` |
| Deleted | `components/journey/ConstitutionalAgentFieldEntrySurface.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgePassportRoom.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgePersonifyMyCanvas.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeStandPanel.tsx` |
| Modified | `components/journey/ConstitutionalInternetBridgeViewSequence.tsx` |
| Added | `components/journey/FullscreenableFrame.tsx` |
| Modified | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `services/wallet/personaRepo.ts` |
| Modified | `tests/ci-bridge-threshold-guide-architecture.test.ts` |

## Stats

 19 files changed, 835 insertions(+), 336 deletions(-)
