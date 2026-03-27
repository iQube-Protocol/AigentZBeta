# Commit Brief: `653a71b` — fix: Article deep link system with direct ID fetch and social tracking

| Field | Value |
|-------|-------|
| SHA | [`653a71b`](https://github.com/iQube-Protocol/AigentZBeta/commit/653a71bd0ce14d7810673bc1d96629d2934ba041) |
| Author | Kn0w-1 |
| Date | 2026-01-02T16:56:15Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Article deep link system with direct ID fetch and social tracking

- Replace section-based article fetch with direct /api/content/smart/[id] endpoint
- Eliminate dependency on knowing article section for deep links
- Add social share conversion tracking via /api/social/track
- Track referrer platform and reward sharers with Herald of Order KNYT
- Improve error handling with clear 'Article not found' messages

Fixes:
1. Deep links now work for any article regardless of section
2. Social shares tracked and rewarded automatically
3. No more 'article unavailable' errors on valid links
4. Proper metadata and Open Graph tags for social platforms
```

## Files Changed

_File details not available in backfill — see commit link above._
