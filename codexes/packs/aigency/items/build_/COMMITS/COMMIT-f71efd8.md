# Commit Brief: `f71efd8` — fix Firefox X-Frame-Options on cartridge embed; consolidate header logic

| Field | Value |
|-------|-------|
| SHA | [`f71efd8`](https://github.com/iQube-Protocol/AigentZBeta/commit/f71efd8e08c161144a6a17d4af359b5cfc66e3da) |
| Author | Claude |
| Date | 2026-04-30T16:37:15Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Firefox X-Frame-Options on cartridge embed; consolidate header logic

Smart-menu quick action started failing with:
  "dev-beta.aigentz.me will not allow Firefox to display the page if
   another site has embedded it"

Root cause: next.config.js's headers() used a negative-lookahead path
pattern to apply X-Frame-Options=SAMEORIGIN to everything EXCEPT
/triad/embed/* and /metame/runtime/*. Next.js's path-to-regexp doesn't
reliably support negative lookaheads in source patterns — the rule was
matching paths it shouldn't have, applying SAMEORIGIN to the embed
routes that the cartridge overlay iframe loads.

Middleware was deleting X-Frame-Options on those routes, but Next.js's
headers() config can re-apply after middleware runs. Firefox enforces
X-Frame-Options strictly even when CSP frame-ancestors is also set, so
the embed iframe was blocked.

Fix:
- next.config.js: removed the negative-lookahead X-Frame-Options block.
  Kept the explicit Content-Security-Policy frame-ancestors entries on
  /triad/embed/* and /metame/runtime/* — those use exact-match patterns
  path-to-regexp handles correctly.
- middleware.ts: expanded matcher to cover all routes (excluding
  _next/static, favicon, .well-known). Branches handle embed/runtime
  paths first (delete X-Frame-Options, set frame-ancestors CSP); a new
  default fallback sets X-Frame-Options=SAMEORIGIN on everything else
  to preserve security posture.

Single source of truth for X-Frame-Options is now the middleware.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Smart-menu quick action started failing with:
  "dev-beta.aigentz.me will not allow Firefox to display the page if
   another site has embedded it"

Root cause: next.config.js's headers() used a negative-lookahead path
pattern to apply X-Frame-Options=SAMEORIGIN to everything EXCEPT
/triad/embed/* and /metame/runtime/*. Next.js's path-to-regexp doesn't
reliably support negative lookaheads in source patterns — the rule was
matching paths it shouldn't have, applying SAMEORIGIN to the embed
routes that the cartridge overlay iframe loads.

Middleware was deleting X-Frame-Options on those routes, but Next.js's
headers() config can re-apply after middleware runs. Firefox enforces
X-Frame-Options strictly even when CSP frame-ancestors is also set, so
the embed iframe was blocked.

Fix:
- next.config.js: removed the negative-lookahead X-Frame-Options block.
  Kept the explicit Content-Security-Policy frame-ancestors entries on
  /triad/embed/* and /metame/runtime/* — those use exact-match patterns
  path-to-regexp handles correctly.
- middleware.ts: expanded matcher to cover all routes (excluding
  _next/static, favicon, .well-known). Branches handle embed/runtime
  paths first (delete X-Frame-Options, set frame-ancestors CSP); a new
  default fallback sets X-Frame-Options=SAMEORIGIN on everything else
  to preserve security posture.

Single source of truth for X-Frame-Options is now the middleware.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `middleware.ts` |
| Modified | `next.config.js` |

## Stats

 2 files changed, 33 insertions(+), 17 deletions(-)
