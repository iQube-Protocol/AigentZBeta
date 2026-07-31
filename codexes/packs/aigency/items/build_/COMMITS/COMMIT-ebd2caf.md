# Commit Brief: `ebd2caf` — Fix static tabs shadowed by DB codex_tabs and ground runner on namespaces

| Field | Value |
|-------|-------|
| SHA | [`ebd2caf`](https://github.com/iQube-Protocol/AigentZBeta/commit/ebd2caf9df85cd88a571456691408d63316abc05) |
| Author | Claude |
| Date | 2026-07-04T04:02:47Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix static tabs shadowed by DB codex_tabs and ground runner on namespaces

Registry route merged CODEX_DEFINITIONS tabs with codex_tabs DB rows via
wholesale replacement, so any existing DB row dropped every newly-added
static tab (Foundation/Experiments/Invariant-Intelligence never appeared).
Add mergeStaticAndDbTabs: static tabs canonical, DB overrides only enabled,
DB-authored tabs appended. Runner now grounds on namespaces resolved to
invariant IDs instead of requiring nonexistent Level-2 collections, so the
brief generates and SkillVideoPlayer mounts against the seeded substrate.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Registry route merged CODEX_DEFINITIONS tabs with codex_tabs DB rows via
wholesale replacement, so any existing DB row dropped every newly-added
static tab (Foundation/Experiments/Invariant-Intelligence never appeared).
Add mergeStaticAndDbTabs: static tabs canonical, DB overrides only enabled,
DB-authored tabs appended. Runner now grounds on namespaces resolved to
invariant IDs instead of requiring nonexistent Level-2 collections, so the
brief generates and SkillVideoPlayer mounts against the seeded substrate.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/registry/[codexId]/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-04_tab-shadowing-fix-and-runner-namespace-grounding.md` |
| Modified | `components/composer/InvariantVideoExperimentRunner.tsx` |

## Stats

 4 files changed, 178 insertions(+), 111 deletions(-)
