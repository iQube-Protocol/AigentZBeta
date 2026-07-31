# Commit Brief: `40b86f5` — fix Policy Passport deep link — use full cartridge ID in overlay slug

| Field | Value |
|-------|-------|
| SHA | [`40b86f5`](https://github.com/iQube-Protocol/AigentZBeta/commit/40b86f580c9aebef36214e1984179e56b16eb5ad) |
| Author | Claude |
| Date | 2026-06-19T12:46:03Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Policy Passport deep link — use full cartridge ID in overlay slug

The CTA passed slug 'polity-passport-bureau' which the embed page suffixed
with '-codex' → 'polity-passport-bureau-codex'. But the cartridge is
registered as 'polity-passport-bureau-cartridge'. Using the full ID so
the embed page passes it through unchanged and the lookup resolves.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

The CTA passed slug 'polity-passport-bureau' which the embed page suffixed
with '-codex' → 'polity-passport-bureau-codex'. But the cartridge is
registered as 'polity-passport-bureau-cartridge'. Using the full ID so
the embed page passes it through unchanged and the lookup resolves.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 1 file changed, 1 insertion(+), 1 deletion(-)
