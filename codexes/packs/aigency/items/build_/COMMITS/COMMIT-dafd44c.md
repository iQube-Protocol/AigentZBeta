# Commit Brief: `dafd44c` — document worldcoin keyspace — three keys, one purpose each (operator unblock)

| Field | Value |
|-------|-------|
| SHA | [`dafd44c`](https://github.com/iQube-Protocol/AigentZBeta/commit/dafd44c85ec0e9d66bfba03511d4abd5739b5946) |
| Author | Claude |
| Date | 2026-06-13T23:10:59Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
document worldcoin keyspace — three keys, one purpose each (operator unblock)

operator asked which key goes where after seeing the worldcoin
developer portal mcp schema referencing WORLD_DEVELOPER_API_KEY and
not knowing if it's the same key they need for passport verification.

clarifies in CLAUDE.md the three distinct credentials:

  WORLD_ID_APP_ID / NEXT_PUBLIC_WORLD_ID_APP_ID
    server + browser pair. public 'app_xxx...' identifier from
    developer.worldcoin.org. needed by both the server-side cloud
    verifier (no auth header — the proof itself is the credential)
    and the browser-side IDKit modal (or it silently fails).

  WORLD_ID_ACTION_ID / NEXT_PUBLIC_WORLD_ID_ACTION_ID
    action slug. nullifier hash scope. created under app ->
    incognito actions.

  WORLD_DEVELOPER_API_KEY
    developer portal MANAGEMENT api bearer token. NOT used by
    passport verification. only relevant when driving the
    worldcoin dev portal from chat via mcp-remote
    (mcp_servers.worldcoin-developer-portal).

documents the NEXT_PUBLIC_ duplication requirement (next.js bakes
public env into the client bundle at build time so IDKit can't read
server-only vars) and the rebuild-after-setting gotcha.

four env vars, two values: that's the production verification setup.

key TL;DR placed at the top of CLAUDE.md just above the wallet-over-
cartridge overlay pattern so future agents find it before the more
specialised UI pattern.
```

## Body

operator asked which key goes where after seeing the worldcoin
developer portal mcp schema referencing WORLD_DEVELOPER_API_KEY and
not knowing if it's the same key they need for passport verification.

clarifies in CLAUDE.md the three distinct credentials:

  WORLD_ID_APP_ID / NEXT_PUBLIC_WORLD_ID_APP_ID
    server + browser pair. public 'app_xxx...' identifier from
    developer.worldcoin.org. needed by both the server-side cloud
    verifier (no auth header — the proof itself is the credential)
    and the browser-side IDKit modal (or it silently fails).

  WORLD_ID_ACTION_ID / NEXT_PUBLIC_WORLD_ID_ACTION_ID
    action slug. nullifier hash scope. created under app ->
    incognito actions.

  WORLD_DEVELOPER_API_KEY
    developer portal MANAGEMENT api bearer token. NOT used by
    passport verification. only relevant when driving the
    worldcoin dev portal from chat via mcp-remote
    (mcp_servers.worldcoin-developer-portal).

documents the NEXT_PUBLIC_ duplication requirement (next.js bakes
public env into the client bundle at build time so IDKit can't read
server-only vars) and the rebuild-after-setting gotcha.

four env vars, two values: that's the production verification setup.

key TL;DR placed at the top of CLAUDE.md just above the wallet-over-
cartridge overlay pattern so future agents find it before the more
specialised UI pattern.

## Files Changed

| Change | File |
|--------|------|
| Modified | `CLAUDE.md` |

## Stats

 1 file changed, 26 insertions(+), 3 deletions(-)
