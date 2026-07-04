# Commit Brief: `4f00c2c` — add programmatic resolver-set script — bypass ENS Manager UI

| Field | Value |
|-------|-------|
| SHA | [`4f00c2c`](https://github.com/iQube-Protocol/AigentZBeta/commit/4f00c2c9567678af40bd2aefcd3b36196a3346f9) |
| Author | Claude |
| Date | 2026-06-14T05:21:47Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add programmatic resolver-set script — bypass ENS Manager UI

ENS Manager v3 keeps moving the resolver setting around in the UI.
operator couldn't find the Records tab on sepolia.app.ens.domains.

scripts/set-resolver.mjs:
  - reads DEPLOYER_PRIVATE_KEY from ~/.polity-ccip-read.env
  - takes resolver address as argv or prompts
  - calls ENS Registry's setResolver(node, resolver) on Sepolia at
    0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
  - validates caller IS the owner of the name before sending
  - shows current resolver (early-exit if already set)
  - waits for confirmation, prints explorer link, next-step
    smoke-test command

usage:
  node scripts/set-resolver.mjs 0xb906eff8d87436ff03d2a8ec08a1674066d3c0a8

one tx, no ENS UI required.
```

## Body

ENS Manager v3 keeps moving the resolver setting around in the UI.
operator couldn't find the Records tab on sepolia.app.ens.domains.

scripts/set-resolver.mjs:
  - reads DEPLOYER_PRIVATE_KEY from ~/.polity-ccip-read.env
  - takes resolver address as argv or prompts
  - calls ENS Registry's setResolver(node, resolver) on Sepolia at
    0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
  - validates caller IS the owner of the name before sending
  - shows current resolver (early-exit if already set)
  - waits for confirmation, prints explorer link, next-step
    smoke-test command

usage:
  node scripts/set-resolver.mjs 0xb906eff8d87436ff03d2a8ec08a1674066d3c0a8

one tx, no ENS UI required.

## Files Changed

| Change | File |
|--------|------|
| Added | `scripts/set-resolver.mjs` |

## Stats

 1 file changed, 154 insertions(+)
