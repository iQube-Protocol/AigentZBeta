# Commit Brief: `bc6c7cc` — fix: isEpisodeLocked() now checks metadata.owned first, eliminating badge/lock divergence

| Field | Value |
|-------|-------|
| SHA | [`bc6c7cc`](https://github.com/iQube-Protocol/AigentZBeta/commit/bc6c7cc508c72d85516bd8910e540def9e14e382) |
| Author | Claude |
| Date | 2026-05-04T21:37:47Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: isEpisodeLocked() now checks metadata.owned first, eliminating badge/lock divergence

Badge and lock check were reading from separate state variables (ownedEpisodeNumbers
vs ownedIssues). Even with the cache fix, they could still diverge for items that
arrive without the owned flag pre-stamped.

Added metadata.owned as the primary check — if the badge says OWNED the gate
says unlocked, guaranteed. ownedIssues remains as a secondary fallback for raw
items not yet processed by contentWithOwnership.
```

## Body

Badge and lock check were reading from separate state variables (ownedEpisodeNumbers
vs ownedIssues). Even with the cache fix, they could still diverge for items that
arrive without the owned flag pre-stamped.

Added metadata.owned as the primary check — if the badge says OWNED the gate
says unlocked, guaranteed. ownedIssues remains as a secondary fallback for raw
items not yet processed by contentWithOwnership.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/KnytTab.tsx` |

## Stats

 1 file changed, 8 insertions(+), 8 deletions(-)
