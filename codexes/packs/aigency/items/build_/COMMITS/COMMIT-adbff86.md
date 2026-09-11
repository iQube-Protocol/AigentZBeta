# Commit Brief: `adbff86` — Add a conflict resolution path to the dev auto-merge workflow

| Field | Value |
|-------|-------|
| SHA | [`adbff86`](https://github.com/iQube-Protocol/AigentZBeta/commit/adbff8645b1eff499bb03646881969bd0a2b9a86) |
| Author | Claude |
| Date | 2026-08-09T22:43:44Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add a conflict resolution path to the dev auto-merge workflow

A real content conflict previously failed the merge job with no further
trace — auto-resolve the mechanical .amplify-deploy case, file/update a
GitHub issue naming the conflict for everything else, and document the
incident + rule in CLAUDE.md, AGENTS.md, and an updates record.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQxPBryjVXF5hknSionkx5
```

## Body

A real content conflict previously failed the merge job with no further
trace — auto-resolve the mechanical .amplify-deploy case, file/update a
GitHub issue naming the conflict for everything else, and document the
incident + rule in CLAUDE.md, AGENTS.md, and an updates record.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQxPBryjVXF5hknSionkx5

## Files Changed

| Change | File |
|--------|------|
| Modified | `.github/workflows/merge-claude-to-dev.yml` |
| Modified | `AGENTS.md` |
| Modified | `CLAUDE.md` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-08-09_dev-merge-conflict-resolution-path.md` |

## Stats

 5 files changed, 268 insertions(+), 4 deletions(-)
