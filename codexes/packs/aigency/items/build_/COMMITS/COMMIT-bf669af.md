# Commit Brief: `bf669af` — Fetch ffmpeg into /tmp at first use — bundle-size-safe stitch fix

| Field | Value |
|-------|-------|
| SHA | [`bf669af`](https://github.com/iQube-Protocol/AigentZBeta/commit/bf669afceab82cfbfa40868fda35484b9ffa69be) |
| Author | Claude |
| Date | 2026-07-05T19:49:47Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fetch ffmpeg into /tmp at first use — bundle-size-safe stitch fix

Second EXP-002 run hit the same "ffmpeg binary unavailable" failure
(ENOENT on /var/task/node_modules/ffmpeg-static/ffmpeg) — static
tracing was the original fix but broke the Amplify 220 MiB build cap
and was reverted. This is the durable middle path:

- getFfmpegPath now resolves in order: FFMPEG_BIN env path → bundled
  ffmpeg-static binary (local dev) → /tmp/ffmpeg (cached per warm
  container) → download-and-cache. The download source is
  ffmpeg-static@5.3.0's own pinned release asset (read from the
  package's install.js URL template + package.json binary-release-tag
  b6.1.1, gzipped ~30MB — the identical asset every npm install on
  the build machine already fetches), honouring the package's own
  FFMPEG_BINARIES_URL / FFMPEG_BINARY_RELEASE env overrides.
  Write-then-rename keeps concurrent readers off partial binaries;
  an in-flight promise dedups parallel downloads.
- Stitch route gains a GET warm-up handler that pre-resolves the
  binary; stitchHierarchical calls it best-effort before the first
  pass so the download never eats the stitch request's own budget.
- Zero bytes added to the build output; thumbnail extraction on the
  two status routes heals through the same path.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Second EXP-002 run hit the same "ffmpeg binary unavailable" failure
(ENOENT on /var/task/node_modules/ffmpeg-static/ffmpeg) — static
tracing was the original fix but broke the Amplify 220 MiB build cap
and was reverted. This is the durable middle path:

- getFfmpegPath now resolves in order: FFMPEG_BIN env path → bundled
  ffmpeg-static binary (local dev) → /tmp/ffmpeg (cached per warm
  container) → download-and-cache. The download source is
  ffmpeg-static@5.3.0's own pinned release asset (read from the
  package's install.js URL template + package.json binary-release-tag
  b6.1.1, gzipped ~30MB — the identical asset every npm install on
  the build machine already fetches), honouring the package's own
  FFMPEG_BINARIES_URL / FFMPEG_BINARY_RELEASE env overrides.
  Write-then-rename keeps concurrent readers off partial binaries;
  an in-flight promise dedups parallel downloads.
- Stitch route gains a GET warm-up handler that pre-resolves the
  binary; stitchHierarchical calls it best-effort before the first
  pass so the download never eats the stitch request's own budget.
- Zero bytes added to the build output; thumbnail extraction on the
  two status routes heals through the same path.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/skills/video/_thumbnail.ts` |
| Modified | `app/api/skills/video/stitch/route.ts` |
| Modified | `components/composer/SkillVideoPlayer.tsx` |
| Modified | `next.config.js` |

## Stats

 4 files changed, 106 insertions(+), 12 deletions(-)
