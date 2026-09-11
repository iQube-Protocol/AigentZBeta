# Commit Brief: `6cd14f6` — add marketer/creator-facing video-article flow in studio workflows tab

| Field | Value |
|-------|-------|
| SHA | [`6cd14f6`](https://github.com/iQube-Protocol/AigentZBeta/commit/6cd14f6cd11587ff7bc06500777ba9e402af7fed) |
| Author | claude[bot] |
| Date | 2026-07-15T06:03:44Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add marketer/creator-facing video-article flow in studio workflows tab

Remedy #1: the video+article generation controls existed only in the metaMe IRL
research lab. Adds an audience prop to VideoArticleSkillRunner (lab | creator)
that reframes copy/labels in plain language, a self-contained
VideoArticleCreatorFlow launcher, and mounts it (plus the video_article_24s
skill card) in the ComposerStudio Workflows tab — the surface marketers and
creators work in. One generation path, two persona surfaces.

packId f34e7ed6-39f7-4ac0-8df6-275395677bf1

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Body

Remedy #1: the video+article generation controls existed only in the metaMe IRL
research lab. Adds an audience prop to VideoArticleSkillRunner (lab | creator)
that reframes copy/labels in plain language, a self-contained
VideoArticleCreatorFlow launcher, and mounts it (plus the video_article_24s
skill card) in the ComposerStudio Workflows tab — the surface marketers and
creators work in. One generation path, two persona surfaces.

packId f34e7ed6-39f7-4ac0-8df6-275395677bf1

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/composer/ComposerStudio.tsx` |
| Added | `components/composer/VideoArticleCreatorFlow.tsx` |
| Modified | `components/composer/VideoArticleSkillRunner.tsx` |

## Stats

 3 files changed, 116 insertions(+), 11 deletions(-)
