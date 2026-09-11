# Commit Brief: `495307d` — Fix ffmpeg-unavailable stitch failure + recover already-generated segments

| Field | Value |
|-------|-------|
| SHA | [`495307d`](https://github.com/iQube-Protocol/AigentZBeta/commit/495307d1a4006e680791dd9375a9c3287a4844e7) |
| Author | Claude |
| Date | 2026-07-05T18:59:03Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix ffmpeg-unavailable stitch failure + recover already-generated segments

Root cause: ffmpeg-static ships a pre-compiled binary whose path is
computed at runtime, so Next's file tracer never bundles it — the
deployed stitch Lambda had no ffmpeg and hard-failed after the clips
had already been generated and paid for (EXP-002, 2026-07-05).

- next.config.js: trace the ffmpeg binary into the stitch route and
  both video status routes (thumbnails were silently skipped too).
- stitch route: resolve relative proxy clip URLs (/api/skills/video/…)
  against the request origin so Venice-proxied clips stitch; surface
  the underlying ffmpeg failure reason in the error.
- SkillVideoPlayer: retain the generated clip URLs across a stitch
  failure and offer "Retry stitch only" — a stitch-side failure never
  again forces regenerating the expensive clips. Full regenerate stays
  available as the secondary action. stitchHierarchical exported for
  reuse.
- New admin-gated GET /api/skills/video/recoverable-segments: lists
  orphaned clips from storage (Sora videos directly; Venice queueIds
  recovered from persisted thumbnails) so pre-fix runs are salvageable.
- Experiment Lab video tab gains a "Recover unstitched segments" panel:
  pick the recovered clips in play order, stitch, play — completing the
  interrupted experiment without regenerating anything.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Root cause: ffmpeg-static ships a pre-compiled binary whose path is
computed at runtime, so Next's file tracer never bundles it — the
deployed stitch Lambda had no ffmpeg and hard-failed after the clips
had already been generated and paid for (EXP-002, 2026-07-05).

- next.config.js: trace the ffmpeg binary into the stitch route and
  both video status routes (thumbnails were silently skipped too).
- stitch route: resolve relative proxy clip URLs (/api/skills/video/…)
  against the request origin so Venice-proxied clips stitch; surface
  the underlying ffmpeg failure reason in the error.
- SkillVideoPlayer: retain the generated clip URLs across a stitch
  failure and offer "Retry stitch only" — a stitch-side failure never
  again forces regenerating the expensive clips. Full regenerate stays
  available as the secondary action. stitchHierarchical exported for
  reuse.
- New admin-gated GET /api/skills/video/recoverable-segments: lists
  orphaned clips from storage (Sora videos directly; Venice queueIds
  recovered from persisted thumbnails) so pre-fix runs are salvageable.
- Experiment Lab video tab gains a "Recover unstitched segments" panel:
  pick the recovered clips in play order, stitch, play — completing the
  interrupted experiment without regenerating anything.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/skills/video/recoverable-segments/route.ts` |
| Modified | `app/api/skills/video/stitch/route.ts` |
| Modified | `components/composer/InvariantVideoExperimentRunner.tsx` |
| Modified | `components/composer/SkillVideoPlayer.tsx` |
| Modified | `next.config.js` |

## Stats

 5 files changed, 403 insertions(+), 31 deletions(-)
