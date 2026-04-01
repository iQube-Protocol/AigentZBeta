# Commit Brief: `de47e4e` — Preserve composition_bundle metadata through session completion

| Field | Value |
|-------|-------|
| SHA | [`de47e4e`](https://github.com/iQube-Protocol/AigentZBeta/commit/de47e4e17bb1dbc6bdc73d119c2360c6df620eb8) |
| Author | Claude |
| Date | 2026-03-20T22:16:13Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Preserve composition_bundle metadata through session completion

Two fixes for video bundle routing to buildSkillPacket:

1. handleComplete now carries composition_bundle from the editing
   experience into completedExperience.metadata so it survives the
   PUT that overwrites the experience after session completion.

2. isSkillBacked in the packet route now also checks
   config.make_bundle?.presetId as a belt-and-suspenders fallback
   so video bundles route correctly even if metadata.composition_bundle
   was not preserved.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
