# Commit Brief: `df9a9ef` — Add video skill + Venice model selectors to invariant video runner

| Field | Value |
|-------|-------|
| SHA | [`df9a9ef`](https://github.com/iQube-Protocol/AigentZBeta/commit/df9a9ef93e96bfd16d07d7dfb27468d2f904dca6) |
| Author | Claude |
| Date | 2026-07-04T19:37:27Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add video skill + Venice model selectors to invariant video runner

Replace the free-text skill input on /admin/studio/invariant-video with
proper dropdowns over the Studio's integrated video skills (Venice,
OpenAI Sora curated, Sora community — from studioSkillCatalog) plus a
Venice model selector mirroring composerStore's curated list (which
mirrors VENICE_PREFERRED_TEXT_TO_VIDEO_MODELS in the invoke route —
LTX-2, Kling 2.6 Pro / 2.5 Turbo Pro, Veo 3.1 Fast, Wan 2.6 / 2.5,
plus server-priority auto). venice_model threads through the existing
SkillVideoPlayer prop; the player is key-remounted on skill/model
change so switching between runs never mixes providers mid-flight.
This multiplies EXP-002 into a cross-model experiment; the UI notes
that cross-model runs are separate instances, never comparable rows.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Replace the free-text skill input on /admin/studio/invariant-video with
proper dropdowns over the Studio's integrated video skills (Venice,
OpenAI Sora curated, Sora community — from studioSkillCatalog) plus a
Venice model selector mirroring composerStore's curated list (which
mirrors VENICE_PREFERRED_TEXT_TO_VIDEO_MODELS in the invoke route —
LTX-2, Kling 2.6 Pro / 2.5 Turbo Pro, Veo 3.1 Fast, Wan 2.6 / 2.5,
plus server-priority auto). venice_model threads through the existing
SkillVideoPlayer prop; the player is key-remounted on skill/model
change so switching between runs never mixes providers mid-flight.
This multiplies EXP-002 into a cross-model experiment; the UI notes
that cross-model runs are separate instances, never comparable rows.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/composer/InvariantVideoExperimentRunner.tsx` |

## Stats

 1 file changed, 52 insertions(+), 5 deletions(-)
