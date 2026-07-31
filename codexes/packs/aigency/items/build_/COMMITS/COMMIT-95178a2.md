# Commit Brief: `95178a2` — fix Amplify build-size overflow: exclude deploy-trigger commit briefs from Lambda tracing

| Field | Value |
|-------|-------|
| SHA | [`95178a2`](https://github.com/iQube-Protocol/AigentZBeta/commit/95178a26a51c510d7907c019439f396978fd8399) |
| Author | Claude |
| Date | 2026-07-17T19:08:10Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Amplify build-size overflow: exclude deploy-trigger commit briefs from Lambda tracing

The Amplify build output hit 230957566 bytes, ~271 KB over the 230686720 hard
cap (the same cap the ffmpeg-static NOTE documents). Root cause: the
codexes-pack tracing include bundles ALL codexes/packs/**/*.md into the SSR
Lambda, including codexes/packs/aigency/items/build_/COMMITS/ — 1900+
auto-generated deploy-trigger commit briefs (~8 MB, growing every deploy).

Added that dir to outputFileTracingExcludes (same philosophy as the
typescript/caniuse-lite entries): build-log metadata never needs to ship in the
size-capped runtime Lambda. Behaviourally safe — the copilot skips these by
default (exclude_deploy_triggers) and readCodexFile returns null for a missing
file (the loop simply skips it). Frees ~8 MB of headroom.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The Amplify build output hit 230957566 bytes, ~271 KB over the 230686720 hard
cap (the same cap the ffmpeg-static NOTE documents). Root cause: the
codexes-pack tracing include bundles ALL codexes/packs/**/*.md into the SSR
Lambda, including codexes/packs/aigency/items/build_/COMMITS/ — 1900+
auto-generated deploy-trigger commit briefs (~8 MB, growing every deploy).

Added that dir to outputFileTracingExcludes (same philosophy as the
typescript/caniuse-lite entries): build-log metadata never needs to ship in the
size-capped runtime Lambda. Behaviourally safe — the copilot skips these by
default (exclude_deploy_triggers) and readCodexFile returns null for a missing
file (the loop simply skips it). Frees ~8 MB of headroom.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `next.config.js` |

## Stats

 1 file changed, 9 insertions(+)
