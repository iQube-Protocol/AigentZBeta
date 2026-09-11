# Commit Brief: `a7cce75` — Fix Qube tool id encoding: tool-<name> canonical, tool_<name> legacy fallback (registered names use hyphens, not underscores)

| Field | Value |
|-------|-------|
| SHA | [`a7cce75`](https://github.com/iQube-Protocol/AigentZBeta/commit/a7cce75b6c219eb6aa70e7e702738edd3944f43e) |
| Author | Claude |
| Date | 2026-05-28T16:34:26Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Qube tool id encoding: tool-<name> canonical, tool_<name> legacy fallback (registered names use hyphens, not underscores)
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `docs/iqube-agent-legibility-profile.md` |
| Modified | `services/iqube/legibility/registry.ts` |
| Modified | `services/iqube/legibility/sources/aigentQubeSource.ts` |
| Modified | `services/iqube/legibility/sources/toolQubeSource.ts` |
| Modified | `tests/iqube-legibility.test.ts` |

## Stats

 5 files changed, 40 insertions(+), 21 deletions(-)
