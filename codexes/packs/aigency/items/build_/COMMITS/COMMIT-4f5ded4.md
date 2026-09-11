# Commit Brief: `4f5ded4` — fix video stitch pipeline: distinct per-segment prompts + 4-segment hierarchical stitching

| Field | Value |
|-------|-------|
| SHA | [`4f5ded4`](https://github.com/iQube-Protocol/AigentZBeta/commit/4f5ded4e1518e49b7f9126c2396b7f3a410b347b) |
| Author | Claude |
| Date | 2026-07-04T01:23:11Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix video stitch pipeline: distinct per-segment prompts + 4-segment hierarchical stitching

Root cause of the reported 'segments share one url' defect: SkillVideoPlayer.invokeMultiSegment submitted N parallel /api/skills/invoke calls with byte-identical bodies (same prompt/duration/style every time) — a 24s video was mechanically the same 12s clip generated twice, with no per-segment prompt mechanism at all.

Fix: new segment_prompts?: string[] prop (each segment submits its own prompt; falls back to repeating prompt for existing callers). MAX_SEGMENTS raised 2->4 (48s). New stitchHierarchical() — a generic order-preserving reducer that chunks by the stitch route's 3-clip-per-pass cap and stitches recursively, so any segment count works. Threaded segment_prompts through ExperienceLiquidRenderer (packet.skill.segment_prompts) and added a 48s duration option to the Studio video-prompt field.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Root cause of the reported 'segments share one url' defect: SkillVideoPlayer.invokeMultiSegment submitted N parallel /api/skills/invoke calls with byte-identical bodies (same prompt/duration/style every time) — a 24s video was mechanically the same 12s clip generated twice, with no per-segment prompt mechanism at all.

Fix: new segment_prompts?: string[] prop (each segment submits its own prompt; falls back to repeating prompt for existing callers). MAX_SEGMENTS raised 2->4 (48s). New stitchHierarchical() — a generic order-preserving reducer that chunks by the stitch route's 3-clip-per-pass cap and stitches recursively, so any segment count works. Threaded segment_prompts through ExperienceLiquidRenderer (packet.skill.segment_prompts) and added a 48s duration option to the Studio video-prompt field.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/composer/ExperienceLiquidRenderer.tsx` |
| Modified | `components/composer/SkillVideoPlayer.tsx` |
| Modified | `services/composer/composerStore.ts` |

## Stats

 3 files changed, 92 insertions(+), 15 deletions(-)
