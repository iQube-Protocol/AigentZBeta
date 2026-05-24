# Commit Brief: `328bbf4` — Phase 2 B.3: live cockpit sync — silent background polling at 20s on cockpit layouts (pauses on document.hidden); LiveSyncIndicator in cockpit header shows 'Synced Ns ago' + manual refresh button; all mutation paths (KPI edit / intent action / NBE approval) trigger silent refetch so the cockpit reacts immediately without skeleton flash. Phase 3 will replace polling with Supabase realtime subscription

| Field | Value |
|-------|-------|
| SHA | [`328bbf4`](https://github.com/iQube-Protocol/AigentZBeta/commit/328bbf44535ed723e4114a2bdb3cccb88bbde5e5) |
| Author | Claude |
| Date | 2026-05-24T06:24:05Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Phase 2 B.3: live cockpit sync — silent background polling at 20s on cockpit layouts (pauses on document.hidden); LiveSyncIndicator in cockpit header shows 'Synced Ns ago' + manual refresh button; all mutation paths (KPI edit / intent action / NBE approval) trigger silent refetch so the cockpit reacts immediately without skeleton flash. Phase 3 will replace polling with Supabase realtime subscription
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/welcome/layouts/VentureCockpitLayout.tsx` |
| Modified | `components/metame/welcome/layouts/types.ts` |

## Stats

 4 files changed, 165 insertions(+), 20 deletions(-)
