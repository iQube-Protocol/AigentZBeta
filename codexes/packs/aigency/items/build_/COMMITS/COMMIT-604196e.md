# Commit Brief: `604196e` — auto-prepend 0x to private keys in deploy.mjs

| Field | Value |
|-------|-------|
| SHA | [`604196e`](https://github.com/iQube-Protocol/AigentZBeta/commit/604196e295856f3cc01602c8709bc144c90fa18b) |
| Author | Claude |
| Date | 2026-06-14T05:14:24Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
auto-prepend 0x to private keys in deploy.mjs

metamask exports private keys as 64 hex chars without the 0x prefix.
the previous script required the operator to type 0x first, which
nobody remembers to do.

normalizePrivateKey() now auto-prepends 0x when it sees exactly 64
hex chars without prefix. error message updated to mention 'with or
without 0x prefix'.

paste-and-go works now.
```

## Body

metamask exports private keys as 64 hex chars without the 0x prefix.
the previous script required the operator to type 0x first, which
nobody remembers to do.

normalizePrivateKey() now auto-prepends 0x when it sees exactly 64
hex chars without prefix. error message updated to mention 'with or
without 0x prefix'.

paste-and-go works now.

## Files Changed

| Change | File |
|--------|------|
| Modified | `scripts/deploy.mjs` |

## Stats

 1 file changed, 14 insertions(+), 4 deletions(-)
