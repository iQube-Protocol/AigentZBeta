# Commit Brief: `e72d35a` — scope Standing profiles list to own persona (fixes duplicate Core tabs)

| Field | Value |
|-------|-------|
| SHA | [`e72d35a`](https://github.com/iQube-Protocol/AigentZBeta/commit/e72d35a2690ac10e40c1d66d1343930c28d8d292) |
| Author | Claude |
| Date | 2026-06-24T23:12:09Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
scope Standing profiles list to own persona (fixes duplicate Core tabs)

Root cause of the two "Standing Core" tabs: GET /api/vsp/profiles applied an
admin see-all bypass, so an admin's personal Standing tab listed EVERY
persona's profiles system-wide — including other personas' auto-created
"Standing Core". The per-persona SQL dedupe kept one core per persona, so
multiple survived and rendered as duplicate Core tabs.

- API now scopes the list to the caller's own owner_persona_id by default;
  the admin-wide listing stays available only behind an explicit ?scope=all
  (no consumer needs see-all — the personal Standing tab is the only caller).
- UI dedupe hardened to a normalised (trim + case-insensitive) core-label
  match as defense in depth.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

Root cause of the two "Standing Core" tabs: GET /api/vsp/profiles applied an
admin see-all bypass, so an admin's personal Standing tab listed EVERY
persona's profiles system-wide — including other personas' auto-created
"Standing Core". The per-persona SQL dedupe kept one core per persona, so
multiple survived and rendered as duplicate Core tabs.

- API now scopes the list to the caller's own owner_persona_id by default;
  the admin-wide listing stays available only behind an explicit ?scope=all
  (no consumer needs see-all — the personal Standing tab is the only caller).
- UI dedupe hardened to a normalised (trim + case-insensitive) core-label
  match as defense in depth.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/vsp/profiles/route.ts` |
| Modified | `app/triad/components/codex/tabs/StandingCartridgeTab.tsx` |

## Stats

 2 files changed, 14 insertions(+), 3 deletions(-)
