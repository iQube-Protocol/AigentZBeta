# Commit Brief: `2abac0b` — dedupe duplicate Standing Core tab in the Standing cartridge

| Field | Value |
|-------|-------|
| SHA | [`2abac0b`](https://github.com/iQube-Protocol/AigentZBeta/commit/2abac0b3ce420130251eee585f17d5febdc83bb0) |
| Author | Claude |
| Date | 2026-06-24T22:13:11Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
dedupe duplicate Standing Core tab in the Standing cartridge

The backend dedupe (ensureCoreProfile reusing the earliest row) stops NEW
duplicate "Standing Core" profiles, but historical rows created before that
fix still render two Core tabs. Collapse all "Standing Core" profiles to the
earliest-created one in the UI so it can never show two Core tabs regardless
of DB state. Non-core (operator-named) profiles pass through untouched.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

The backend dedupe (ensureCoreProfile reusing the earliest row) stops NEW
duplicate "Standing Core" profiles, but historical rows created before that
fix still render two Core tabs. Collapse all "Standing Core" profiles to the
earliest-created one in the UI so it can never show two Core tabs regardless
of DB state. Non-core (operator-named) profiles pass through untouched.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/StandingCartridgeTab.tsx` |

## Stats

 1 file changed, 23 insertions(+), 3 deletions(-)
