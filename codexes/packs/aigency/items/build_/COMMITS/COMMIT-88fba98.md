# Commit Brief: `88fba98` — fix consumer 404: render experience inline-only for non-admins, hide platform links

| Field | Value |
|-------|-------|
| SHA | [`88fba98`](https://github.com/iQube-Protocol/AigentZBeta/commit/88fba98483b8b91ec59ded97f49eb9e0697c7054) |
| Author | Claude |
| Date | 2026-06-18T23:01:41Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix consumer 404: render experience inline-only for non-admins, hide platform links

On the thin client (metame.live) the experience renders inline in the
runtime panel (hero, task runner with rewards, remix editor, media
preview, and the inline RuntimeArticlePanel). The external CTAs that
pointed at /studio/composer/experience/[id] opened that platform route
at the thin-client top-level origin via target=_blank / window.open —
which 404s because metame.live doesn't host that route.

Gate all external/authoring experience CTAs on runtimeAdminMode so
consumers (non-admins) get a clean inline-only view with no broken
links:
- media-header "Pop out experience" link
- embed-mode authoring block ("Generate Images", "Open Experience")
- carousel-card receipt / regenerate authoring links
- carousel-card "Open in new window" now launches inline for consumers

Admins keep the pop-out/authoring links (they work from the platform
origin).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

On the thin client (metame.live) the experience renders inline in the
runtime panel (hero, task runner with rewards, remix editor, media
preview, and the inline RuntimeArticlePanel). The external CTAs that
pointed at /studio/composer/experience/[id] opened that platform route
at the thin-client top-level origin via target=_blank / window.open —
which 404s because metame.live doesn't host that route.

Gate all external/authoring experience CTAs on runtimeAdminMode so
consumers (non-admins) get a clean inline-only view with no broken
links:
- media-header "Pop out experience" link
- embed-mode authoring block ("Generate Images", "Open Experience")
- carousel-card receipt / regenerate authoring links
- carousel-card "Open in new window" now launches inline for consumers

Admins keep the pop-out/authoring links (they work from the platform
origin).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 1 file changed, 9 insertions(+), 6 deletions(-)
