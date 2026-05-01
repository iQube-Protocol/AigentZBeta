# Commit Brief: `1ab55f2` — revert overbroad middleware fallback that broke runtime page embedding

| Field | Value |
|-------|-------|
| SHA | [`1ab55f2`](https://github.com/iQube-Protocol/AigentZBeta/commit/1ab55f21f05074c1480263f35e63e7d039365c13) |
| Author | Claude |
| Date | 2026-04-30T16:58:22Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
revert overbroad middleware fallback that broke runtime page embedding

f71efd8 added a default X-Frame-Options=SAMEORIGIN fallback in middleware
to preserve the security posture lost when I removed the next.config
negative-lookahead. But the runtime page (/metame/runtime) is hit by
the parent thin-client (Lovable shell) as the iframe target — and the
fallback was applying SAMEORIGIN to it (since the parent shell is a
different origin), so the entire runtime iframe failed to load.

Reverting just the fallback + matcher expansion. Keeping the
next.config change (removed the broken negative-lookahead) — that part
was correct.

Net effect of this commit pair (f71efd8 + this revert):
- next.config.js no longer applies X-Frame-Options=SAMEORIGIN to the
  embed/runtime paths it wasn't supposed to (the original Firefox bug
  the user reported is fixed)
- Middleware behavior is back to original: deletes X-Frame-Options on
  embed/runtime paths, sets it on /api/* paths, untouched elsewhere
- Other pages (/, dashboard, etc.) no longer get X-Frame-Options at
  all — slightly more permissive than before, but doesn't break the
  Lovable embedding flow which is critical

If the original X-Frame issue resurfaces on the cartridge iframe, we'll
need to investigate at the response-headers level (CDN, Amplify) rather
than the Next.js layer.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

f71efd8 added a default X-Frame-Options=SAMEORIGIN fallback in middleware
to preserve the security posture lost when I removed the next.config
negative-lookahead. But the runtime page (/metame/runtime) is hit by
the parent thin-client (Lovable shell) as the iframe target — and the
fallback was applying SAMEORIGIN to it (since the parent shell is a
different origin), so the entire runtime iframe failed to load.

Reverting just the fallback + matcher expansion. Keeping the
next.config change (removed the broken negative-lookahead) — that part
was correct.

Net effect of this commit pair (f71efd8 + this revert):
- next.config.js no longer applies X-Frame-Options=SAMEORIGIN to the
  embed/runtime paths it wasn't supposed to (the original Firefox bug
  the user reported is fixed)
- Middleware behavior is back to original: deletes X-Frame-Options on
  embed/runtime paths, sets it on /api/* paths, untouched elsewhere
- Other pages (/, dashboard, etc.) no longer get X-Frame-Options at
  all — slightly more permissive than before, but doesn't break the
  Lovable embedding flow which is critical

If the original X-Frame issue resurfaces on the cartridge iframe, we'll
need to investigate at the response-headers level (CDN, Amplify) rather
than the Next.js layer.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `middleware.ts` |

## Stats

 1 file changed, 2 insertions(+), 18 deletions(-)
