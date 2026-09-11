# Commit Brief: `937b6d8` — add back button to threshold guides + wire groundContext to bridge copilots

| Field | Value |
|-------|-------|
| SHA | [`937b6d8`](https://github.com/iQube-Protocol/AigentZBeta/commit/937b6d832e22fce22e150afb9e4c59b2e37558a8) |
| Author | Claude |
| Date | 2026-08-11T20:49:07Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add back button to threshold guides + wire groundContext to bridge copilots

- JourneyRunSurface: add optional onBack prop, render back arrow in both compact/non-compact headers
- KNYTS Bridge: add stage navigation tracking for back button, pass onBack callback
- CI Bridge: add stage navigation tracking for back button, pass onBack callback
- KNYTS/CI Copilots: add groundContext to provide ground-truth KB awareness
- Chat API: wire contextId to KB scope as fallback for journey surfaces

Addresses mid-turn requests: back button navigation for embedded cartridges + ground-truth KB for bridge copilots
```

## Body

- JourneyRunSurface: add optional onBack prop, render back arrow in both compact/non-compact headers
- KNYTS Bridge: add stage navigation tracking for back button, pass onBack callback
- CI Bridge: add stage navigation tracking for back button, pass onBack callback
- KNYTS/CI Copilots: add groundContext to provide ground-truth KB awareness
- Chat API: wire contextId to KB scope as fallback for journey surfaces

Addresses mid-turn requests: back button navigation for embedded cartridges + ground-truth KB for bridge copilots

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |
| Modified | `app/bridge/ci/page.tsx` |
| Modified | `app/bridge/knyts/page.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |

## Stats

 4 files changed, 103 insertions(+), 4 deletions(-)
