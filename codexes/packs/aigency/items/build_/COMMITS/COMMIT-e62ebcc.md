# Commit Brief: `e62ebcc` — consolidate X-Frame-Options into middleware as single source of truth

| Field | Value |
|-------|-------|
| SHA | [`e62ebcc`](https://github.com/iQube-Protocol/AigentZBeta/commit/e62ebcc87ab46318443aab0394e5556165c493dc) |
| Author | Claude |
| Date | 2026-04-30T18:08:16Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
consolidate X-Frame-Options into middleware as single source of truth

Completes the consolidation that 1ab55f2 partially reverted. The
previous attempt's bug: it didn't include `/` in the embeddable-path
list, but `/` redirects to `/metame/runtime` and is the URL the parent
thin client (Lovable at metame.live) embeds. So the SAMEORIGIN default
fallback was applying to `/`, breaking the entire iframe.

This version explicitly enumerates the embeddable paths in
isEmbeddablePath():
- `/` and `/<empty>`        — root redirects to /metame/runtime
- `/metame/runtime`         — runtime entry point
- `/metame/runtime/...`     — runtime sub-routes
- `/triad/embed/...`        — cartridge / wallet / admin embeds

Middleware structure:
1. Embeddable paths    → delete X-Frame-Options, set frame-ancestors CSP,
                         cache-bust the runtime entry-points
2. /api/...            → existing API handling (rate limit, CORS,
                         SAMEORIGIN/DENY at the end)
3. Default fallback    → set X-Frame-Options=SAMEORIGIN on operator-facing
                         routes (shell pages, dashboard, CRM, codex viewer
                         direct-access, etc.) — preserves the security
                         posture the broken next.config negative-lookahead
                         was supposed to provide.

Matcher expanded to all paths except Next.js internals
(_next/static, _next/image, favicon.ico, .well-known). Middleware itself
decides per-path what policy applies.

Single source of truth — next.config.js no longer touches X-Frame-Options.
The frame-ancestors CSP entries on /triad/embed/* and /metame/runtime/*
in next.config remain (exact-match path-to-regexp patterns work fine
there) as belt-and-suspenders.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Completes the consolidation that 1ab55f2 partially reverted. The
previous attempt's bug: it didn't include `/` in the embeddable-path
list, but `/` redirects to `/metame/runtime` and is the URL the parent
thin client (Lovable at metame.live) embeds. So the SAMEORIGIN default
fallback was applying to `/`, breaking the entire iframe.

This version explicitly enumerates the embeddable paths in
isEmbeddablePath():
- `/` and `/<empty>`        — root redirects to /metame/runtime
- `/metame/runtime`         — runtime entry point
- `/metame/runtime/...`     — runtime sub-routes
- `/triad/embed/...`        — cartridge / wallet / admin embeds

Middleware structure:
1. Embeddable paths    → delete X-Frame-Options, set frame-ancestors CSP,
                         cache-bust the runtime entry-points
2. /api/...            → existing API handling (rate limit, CORS,
                         SAMEORIGIN/DENY at the end)
3. Default fallback    → set X-Frame-Options=SAMEORIGIN on operator-facing
                         routes (shell pages, dashboard, CRM, codex viewer
                         direct-access, etc.) — preserves the security
                         posture the broken next.config negative-lookahead
                         was supposed to provide.

Matcher expanded to all paths except Next.js internals
(_next/static, _next/image, favicon.ico, .well-known). Middleware itself
decides per-path what policy applies.

Single source of truth — next.config.js no longer touches X-Frame-Options.
The frame-ancestors CSP entries on /triad/embed/* and /metame/runtime/*
in next.config remain (exact-match path-to-regexp patterns work fine
there) as belt-and-suspenders.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `middleware.ts` |

## Stats

 1 file changed, 75 insertions(+), 49 deletions(-)
