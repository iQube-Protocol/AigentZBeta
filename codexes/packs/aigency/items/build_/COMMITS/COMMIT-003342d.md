# Commit Brief: `003342d` — fix: add close_codex ACK + broader action key matching

| Field | Value |
|-------|-------|
| SHA | [`003342d`](https://github.com/iQube-Protocol/AigentZBeta/commit/003342d2621c252aace25d1e23f3d4ee16d6e126) |
| Author | Kn0w-1 |
| Date | 2026-03-02T16:35:15Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: add close_codex ACK + broader action key matching

- ACK: runtime posts STATE_SYNC with close_codex_ack back to shell
- Broader matching: action_id, item_id, action, intent all accepted
- Both onAnyMessage and onShellMessage handlers send ACK
- Shell can verify end-to-end delivery by listening for ACK
```

## Files Changed

_File details not available in backfill — see commit link above._
