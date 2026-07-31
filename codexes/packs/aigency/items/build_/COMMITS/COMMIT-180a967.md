# Commit Brief: `180a967` — handle ens namewrapper — polity.eth is wrapped, registry.owner returns zero

| Field | Value |
|-------|-------|
| SHA | [`180a967`](https://github.com/iQube-Protocol/AigentZBeta/commit/180a96733ea5b3bd4b92b9ec984f6e795c7db6b9) |
| Author | Claude |
| Date | 2026-06-14T05:28:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
handle ens namewrapper — polity.eth is wrapped, registry.owner returns zero

operator hit: 'caller is not the owner of polity.eth — the owner is
0x0000…0000'. registry returns zero for the namehash even though the
operator owns the name.

root cause: ENS Manager v3 wraps names by default. for wrapped names:
  - Registry.owner(node) returns NameWrapper address (or zero on
    Sepolia where the wrapped slot doesn't sync the parent ownership)
  - the actual owner is the ERC1155 NFT holder, queryable via
    NameWrapper.ownerOf(uint256(node))
  - setResolver MUST be called on the NameWrapper, not the Registry

fix: detect wrapped names and route through NameWrapper:
  - check Registry.owner — if zero or matches NameWrapper sepolia
    address (0x0635513f179D50A207757E05759CbD106d7dFcE8), treat as
    wrapped
  - read actual owner via NameWrapper.ownerOf(uint256(node))
  - call setResolver on NameWrapper instead of Registry
  - resolver is still stored in the Registry slot, so the resolver()
    read stays unchanged

now polity.eth (wrapped via Manager v3) and any legacy unwrapped name
both work.
```

## Body

operator hit: 'caller is not the owner of polity.eth — the owner is
0x0000…0000'. registry returns zero for the namehash even though the
operator owns the name.

root cause: ENS Manager v3 wraps names by default. for wrapped names:
  - Registry.owner(node) returns NameWrapper address (or zero on
    Sepolia where the wrapped slot doesn't sync the parent ownership)
  - the actual owner is the ERC1155 NFT holder, queryable via
    NameWrapper.ownerOf(uint256(node))
  - setResolver MUST be called on the NameWrapper, not the Registry

fix: detect wrapped names and route through NameWrapper:
  - check Registry.owner — if zero or matches NameWrapper sepolia
    address (0x0635513f179D50A207757E05759CbD106d7dFcE8), treat as
    wrapped
  - read actual owner via NameWrapper.ownerOf(uint256(node))
  - call setResolver on NameWrapper instead of Registry
  - resolver is still stored in the Registry slot, so the resolver()
    read stays unchanged

now polity.eth (wrapped via Manager v3) and any legacy unwrapped name
both work.

## Files Changed

| Change | File |
|--------|------|
| Modified | `scripts/set-resolver.mjs` |

## Stats

 1 file changed, 67 insertions(+), 10 deletions(-)
