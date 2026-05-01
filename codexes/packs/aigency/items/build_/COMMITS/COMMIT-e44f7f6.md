# Commit Brief: `e44f7f6` — fix Brave compatibility — storage guards, fetch timeouts, static fallbacks

| Field | Value |
|-------|-------|
| SHA | [`e44f7f6`](https://github.com/iQube-Protocol/AigentZBeta/commit/e44f7f6608623af235c0d69e912f078fb6f0a71f) |
| Author | Claude |
| Date | 2026-05-01T06:44:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Brave compatibility — storage guards, fetch timeouts, static fallbacks

- wrap all localStorage/sessionStorage access in try/catch in PersonaContext
  and useCodexEmbedAuthBridge (Brave strict shields throws SecurityError)
- add 10s AbortController timeout + retry:false to codex registry fetch
  so the spinner fails fast instead of hanging forever when Brave stalls requests
- use static codex config as initialData fallback so the codex renders
  immediately even if the registry fetch is blocked
- add 8s timeout to takeover infer fetch + static fallback manifest so the
  welcome banner and quick links render even when the API is unreachable
```

## Body

- wrap all localStorage/sessionStorage access in try/catch in PersonaContext
  and useCodexEmbedAuthBridge (Brave strict shields throws SecurityError)
- add 10s AbortController timeout + retry:false to codex registry fetch
  so the spinner fails fast instead of hanging forever when Brave stalls requests
- use static codex config as initialData fallback so the codex renders
  immediately even if the registry fetch is blocked
- add 8s timeout to takeover infer fetch + static fallback manifest so the
  welcome banner and quick links render even when the API is unreachable

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(embed)/triad/embed/codex/_lib/useCodexEmbedAuthBridge.ts` |
| Modified | `app/contexts/PersonaContext.tsx` |
| Modified | `app/hooks/useCodexConfig.ts` |
| Modified | `app/hooks/useRuntimeTakeover.ts` |

## Stats

 4 files changed, 89 insertions(+), 25 deletions(-)
