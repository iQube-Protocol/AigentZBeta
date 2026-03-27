# Commit Brief: `35720c7` — fix inference not triggering from live text input and marketa persona lookup

| Field | Value |
|-------|-------|
| SHA | [`35720c7`](https://github.com/iQube-Protocol/AigentZBeta/commit/35720c732796cdfb86a511872789d8f85f8b2ba6) |
| Author | Claude |
| Date | 2026-03-24T07:21:55Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix inference not triggering from live text input and marketa persona lookup

- MetaMeRuntimeClient: pass source 'text_input' from the live prompt bar
  (Enter key and send button) so shouldRequestInference fires in non-thin-shell
  mode; without this, source defaulted to 'runtime_ui' and inference was skipped
- route.ts: normalize aigentId via normalizeAgentId() before personas lookup so
  short keys like 'marketa' and 'kn0w1' resolve to full IDs 'aigent-marketa' and
  'aigent-kn0w1', fixing Marketa not being recognized in the thin client

https://claude.ai/code/session_017i9fiEGA3zMjxFonVYZCQT
```

## Files Changed

_File details not available in backfill — see commit link above._
