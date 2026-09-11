# Commit Brief: `f13d150` — fix LayerZero 504 timeout: parallelize attestation calls + cap batch size

| Field | Value |
|-------|-------|
| SHA | [`f13d150`](https://github.com/iQube-Protocol/AigentZBeta/commit/f13d150e51332a54be3a307e0b70fa8f1a739002) |
| Author | Claude |
| Date | 2026-06-08T21:20:31Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix LayerZero 504 timeout: parallelize attestation calls + cap batch size

The sequential for-loop made one IC update call per pending message (~2-3s
each). With 10+ messages this exceeded the Lambda 28s ceiling. Now uses
Promise.allSettled for parallel execution and caps at 10 messages per
request. Returns hasMore flag so the caller can paginate.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b
```

## Body

The sequential for-loop made one IC update call per pending message (~2-3s
each). With 10+ messages this exceeded the Lambda 28s ceiling. Now uses
Promise.allSettled for parallel execution and caps at 10 messages per
request. Returns hasMore flag so the caller can paginate.

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/ops/layerzero/process/route.ts` |

## Stats

 1 file changed, 86 insertions(+), 79 deletions(-)
