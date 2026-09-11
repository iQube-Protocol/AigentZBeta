# Commit Brief: `24a86f3` — intent route: accept activation-driven nbeIds — resolveCandidate parses 'activation:<id>:<action>' from ACTIVATION_CATALOG so the cockpit's Recommended NBAs (Phase 2 B.2 1/2) can queue intents; static NBE_CATALOGUE entries unchanged. Fixes 'unknown-nbeId' error when acting on activation-sourced rows in venture progress

| Field | Value |
|-------|-------|
| SHA | [`24a86f3`](https://github.com/iQube-Protocol/AigentZBeta/commit/24a86f3c321960a95036a8e1ef898c1345973129) |
| Author | Claude |
| Date | 2026-05-24T07:06:39Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent route: accept activation-driven nbeIds — resolveCandidate parses 'activation:<id>:<action>' from ACTIVATION_CATALOG so the cockpit's Recommended NBAs (Phase 2 B.2 1/2) can queue intents; static NBE_CATALOGUE entries unchanged. Fixes 'unknown-nbeId' error when acting on activation-sourced rows in venture progress
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/assistant/intent/route.ts` |

## Stats

 2 files changed, 70 insertions(+), 3 deletions(-)
