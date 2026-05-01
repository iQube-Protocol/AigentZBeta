# Commit Brief: `c4329b0` — allow metame.live + metame.dev to embed; mandate descriptive merge messages

| Field | Value |
|-------|-------|
| SHA | [`c4329b0`](https://github.com/iQube-Protocol/AigentZBeta/commit/c4329b06a94b51f88f6c521f24d28eb39d253897) |
| Author | Claude |
| Date | 2026-04-30T17:36:56Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
allow metame.live + metame.dev to embed; mandate descriptive merge messages

Two changes responding to user feedback:

1. metame.live + metame.dev added to embed allowlists. The thin-client
   production site now runs from metame.live (new domain). The Firefox
   X-Frame-Options error was correct behaviour: the embedded page's
   frame-ancestors didn't include the new parent origin, so the browser
   blocked. Files updated:
   - configs/embed/policy.v1.json (canonical source for middleware +
     next.config CSP)
   - netlify/edge-functions/embed-headers.ts (Netlify deployment)
   - apps/theqriptopian-web/netlify/edge-functions/embed-headers.ts
     (Qriptopian Netlify deployment)

   Both Netlify edge functions had hardcoded frame-ancestors strings
   that drift from the policy file — they now include the metame.com /
   runtime.metame.com / metame.live / metame.dev origins to match.

2. CLAUDE.md: new "Push Commit Messages — MANDATORY" section at the
   top, above the existing Zero Tolerance section. Forbids the generic
   "Merge remote-tracking branch ..." message on any push to dev or
   deploy-triggering branches. Requires every push to name the session
   branch and a short summary of WHAT is being pushed, so the operator
   can read commit history without opening GitHub. Applies to all
   agents (Claude Code, Codex, Lovable, future agents); no exceptions.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Two changes responding to user feedback:

1. metame.live + metame.dev added to embed allowlists. The thin-client
   production site now runs from metame.live (new domain). The Firefox
   X-Frame-Options error was correct behaviour: the embedded page's
   frame-ancestors didn't include the new parent origin, so the browser
   blocked. Files updated:
   - configs/embed/policy.v1.json (canonical source for middleware +
     next.config CSP)
   - netlify/edge-functions/embed-headers.ts (Netlify deployment)
   - apps/theqriptopian-web/netlify/edge-functions/embed-headers.ts
     (Qriptopian Netlify deployment)

   Both Netlify edge functions had hardcoded frame-ancestors strings
   that drift from the policy file — they now include the metame.com /
   runtime.metame.com / metame.live / metame.dev origins to match.

2. CLAUDE.md: new "Push Commit Messages — MANDATORY" section at the
   top, above the existing Zero Tolerance section. Forbids the generic
   "Merge remote-tracking branch ..." message on any push to dev or
   deploy-triggering branches. Requires every push to name the session
   branch and a short summary of WHAT is being pushed, so the operator
   can read commit history without opening GitHub. Applies to all
   agents (Claude Code, Codex, Lovable, future agents); no exceptions.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `CLAUDE.md` |
| Modified | `apps/theqriptopian-web/netlify/edge-functions/embed-headers.ts` |
| Modified | `configs/embed/policy.v1.json` |
| Modified | `netlify/edge-functions/embed-headers.ts` |

## Stats

 4 files changed, 56 insertions(+), 3 deletions(-)
