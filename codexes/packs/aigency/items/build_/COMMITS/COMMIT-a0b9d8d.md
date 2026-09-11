# Commit Brief: `a0b9d8d` — Build KNYTS Bridge v1 — campaign-tagged crossing journey

| Field | Value |
|-------|-------|
| SHA | [`a0b9d8d`](https://github.com/iQube-Protocol/AigentZBeta/commit/a0b9d8db9d5aa7e9831d18461778995fd87d9063) |
| Author | Claude |
| Date | 2026-08-09T22:05:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Build KNYTS Bridge v1 — campaign-tagged crossing journey

Seven-stage campaign (Homecoming/View/Orient/Passport/Remix/Stand/Buy)
layered entirely on existing KNYT infrastructure, per the approved
reuse-first plan:

- campaign_tag / campaign_id migrations on community_generated_content
  and social_share_analytics; knyts-bridge-crossing campaign registered
  alongside the existing qriptopian-share campaign, with reward
  distribution parameterized instead of forked
- KnytCommunityContentTab/PulseTemplate gain an optional campaign filter
  and a card-level Remix action, gated on Passport via a new reusable
  wallet-surface-request pair (usePassportSignInGate/usePassportSignInHost)
  that carries the interrupted Remix intent through sign-in and resumes it
- RemixDialog gains initialSkill/campaignTag; myCanvas's remix= URL param
  parser threads campaign/theme/skill into metaJson end to end
- new knyts-bridge-crossing JourneyDefinition (passport/remix/stand) plus
  its state route, a thin read-only Stand projection over real reaction/
  share/remix-lineage signals, and a minimal Crossing of the Week
  announcement record
- public front door at /bridge/knyts, browsable signed out

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQxPBryjVXF5hknSionkx5
```

## Body

Seven-stage campaign (Homecoming/View/Orient/Passport/Remix/Stand/Buy)
layered entirely on existing KNYT infrastructure, per the approved
reuse-first plan:

- campaign_tag / campaign_id migrations on community_generated_content
  and social_share_analytics; knyts-bridge-crossing campaign registered
  alongside the existing qriptopian-share campaign, with reward
  distribution parameterized instead of forked
- KnytCommunityContentTab/PulseTemplate gain an optional campaign filter
  and a card-level Remix action, gated on Passport via a new reusable
  wallet-surface-request pair (usePassportSignInGate/usePassportSignInHost)
  that carries the interrupted Remix intent through sign-in and resumes it
- RemixDialog gains initialSkill/campaignTag; myCanvas's remix= URL param
  parser threads campaign/theme/skill into metaJson end to end
- new knyts-bridge-crossing JourneyDefinition (passport/remix/stand) plus
  its state route, a thin read-only Stand projection over real reaction/
  share/remix-lineage signals, and a minimal Crossing of the Week
  announcement record
- public front door at /bridge/knyts, browsable signed out

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQxPBryjVXF5hknSionkx5

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/community-content/generate/route.ts` |
| Modified | `app/api/community-content/list/route.ts` |
| Added | `app/api/journey/knyts-bridge/crossing-of-the-week/route.ts` |
| Added | `app/api/journey/knyts-bridge/crossing-of-the-week/select/route.ts` |
| Added | `app/api/journey/knyts-bridge/stand/route.ts` |
| Added | `app/api/journey/knyts-bridge/state/route.ts` |
| Modified | `app/api/mycanvas/entries/[id]/publish-to-pulse/route.ts` |
| Modified | `app/api/social/track/route.ts` |
| Added | `app/bridge/knyts/page.tsx` |
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Added | `app/hooks/usePassportSignInGate.ts` |
| Added | `app/hooks/usePassportSignInHost.ts` |
| Modified | `app/triad/components/codex/tabTemplates/PulseTemplate.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytCommunityContentTab.tsx` |
| Modified | `app/triad/components/codex/tabs/MyCanvasTab.tsx` |
| Added | `components/journey/KnytsBridgeStandPanel.tsx` |
| Modified | `components/metame/runtime/RemixDialog.tsx` |
| Modified | `packages/smarttriad/src/SocialSharingModal.tsx` |
| Modified | `services/campaign/campaignRegistry.ts` |
| Added | `services/journey/crossingOfTheWeek.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Added | `services/journey/knytsBridgeCrossingJourney.ts` |
| Added | `services/journey/knytsBridgeStand.ts` |
| Modified | `services/journey/nextConstitutionalAct.ts` |
| Modified | `services/rewards/rewardsService.ts` |
| Modified | `services/wallet/walletSurfaceRequest.ts` |
| Added | `supabase/migrations/20260930001400_knyts_bridge_campaign_tagging.sql` |
| Added | `supabase/migrations/20260930001500_knyts_bridge_crossing_of_the_week.sql` |
| Modified | `types/campaign.ts` |

## Stats

 29 files changed, 1565 insertions(+), 33 deletions(-)
