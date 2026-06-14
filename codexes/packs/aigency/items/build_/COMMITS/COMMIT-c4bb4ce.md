# Commit Brief: `c4bb4ce` — self-hosted ccip-read ens resolver — bypass namestone entirely

| Field | Value |
|-------|-------|
| SHA | [`c4bb4ce`](https://github.com/iQube-Protocol/AigentZBeta/commit/c4bb4cea824f0ee3b947f83d7f5731738b2337aa) |
| Author | Claude |
| Date | 2026-06-14T00:15:12Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
self-hosted ccip-read ens resolver — bypass namestone entirely

operator confirmed namestone is broken on both mainnet (resolver-not-
set-correctly with arkagent.eth despite owning it) and sepolia (form
won't progress even after polity.eth is registered on sepolia). they
also confirmed they need real ens resolution for the prize track.

pivoting to self-hosted ccip-read (eip-3668) — what namestone does
under the hood, built ourselves. no third-party api key dependency.
one on-chain sepolia tx (set resolver on polity.eth) and we're done.

three pieces shipped:

1. app/api/ens/ccip-read/[sender]/[data]/route.ts
   ccip-read gateway endpoint. flow:
   - ens client (viem, ethers, sepolia.app.ens.domains) calls
     resolver.resolve(name, recordCall) on sepolia
   - resolver contract reverts with OffchainLookup pointing here
   - client GETs us with sender + abi-encoded calldata
   - we decode the wrapped resolve(name, data), extract the inner
     record query (addr / addr+coin / text), look up in
     persona_ens_names + locker_ens_names
   - sign result with POLITY_ISSUER_PRIVATE_KEY using ens labs
     offchain-resolver pattern:
       hash = keccak256(0x1900 || resolver_addr || expires(uint64) ||
                       keccak256(request) || keccak256(result))
   - return { data: abi.encode(result, expires, sig) }
   client invokes resolver.resolveWithProof(response, extraData) to
   recover the signer and return the result.

   supports:
   - addr(node) → returns synthetic address derived from public_ref
   - addr(node, coinType) → ENSIP-9 multi-chain address
   - text(node, key) → arbitrary text records ('polity.public_ref',
     'polity.kind', avatar, description, url, etc.)

   T0 discipline: persona_id never appears in any response. only the
   public commitment ref + label + parent + minted_at travel out.

2. contracts/PolityOffchainResolver.sol
   minimal eip-3668 wildcard resolver (~80 lines). implements
   IExtendedResolver. resolve() reverts with OffchainLookup; the full
   msg.data forwards to the gateway. resolveWithProof() recovers the
   signer from the signed hash and returns the result. supportsInterface
   reports IExtendedResolver (0x9061b923).

   modelled on ENS Labs' OffchainResolver reference at
   github.com/ensdomains/offchain-resolver. owner-settable url + signer
   for future rotation.

3. scripts/deploy-polity-resolver.ts
   one-shot tsx deploy script. uses solc to compile the contract from
   source, deploys to sepolia via viem with DEPLOYER_PRIVATE_KEY,
   passes (GATEWAY_URL, POLITY_ISSUER_PUBLIC_ADDR) to the constructor,
   prints the resolver address + the next step (set resolver on
   polity.eth via sepolia.app.ens.domains).

   npm install -D solc tsx (now in package.json)
   DEPLOYER_PRIVATE_KEY=0x... POLITY_ISSUER_PRIVATE_KEY=0x...      npx tsx scripts/deploy-polity-resolver.ts

   default gateway url:
   https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json

operator next steps:
  1. set POLITY_ISSUER_PRIVATE_KEY env var (generate with viem.generatePrivateKey)
  2. add same key as DEPLOYER_PRIVATE_KEY (or use a different sepolia wallet)
  3. get ~0.005 sepolia eth from a faucet
  4. run: npx tsx scripts/deploy-polity-resolver.ts
  5. note the deployed resolver address
  6. set it as resolver on polity.eth via sepolia.app.ens.domains
  7. test: viem.getEnsAddress({ name: 'first-citizen.polity.eth', chain: sepolia })

once steps 1-6 are done, every ens subname minted via
POST /api/identity/persona/[id]/ens resolves on-chain through standard
ens tooling. no namestone, no justaname, just real ens.
```

## Body

operator confirmed namestone is broken on both mainnet (resolver-not-
set-correctly with arkagent.eth despite owning it) and sepolia (form
won't progress even after polity.eth is registered on sepolia). they
also confirmed they need real ens resolution for the prize track.

pivoting to self-hosted ccip-read (eip-3668) — what namestone does
under the hood, built ourselves. no third-party api key dependency.
one on-chain sepolia tx (set resolver on polity.eth) and we're done.

three pieces shipped:

1. app/api/ens/ccip-read/[sender]/[data]/route.ts
   ccip-read gateway endpoint. flow:
   - ens client (viem, ethers, sepolia.app.ens.domains) calls
     resolver.resolve(name, recordCall) on sepolia
   - resolver contract reverts with OffchainLookup pointing here
   - client GETs us with sender + abi-encoded calldata
   - we decode the wrapped resolve(name, data), extract the inner
     record query (addr / addr+coin / text), look up in
     persona_ens_names + locker_ens_names
   - sign result with POLITY_ISSUER_PRIVATE_KEY using ens labs
     offchain-resolver pattern:
       hash = keccak256(0x1900 || resolver_addr || expires(uint64) ||
                       keccak256(request) || keccak256(result))
   - return { data: abi.encode(result, expires, sig) }
   client invokes resolver.resolveWithProof(response, extraData) to
   recover the signer and return the result.

   supports:
   - addr(node) → returns synthetic address derived from public_ref
   - addr(node, coinType) → ENSIP-9 multi-chain address
   - text(node, key) → arbitrary text records ('polity.public_ref',
     'polity.kind', avatar, description, url, etc.)

   T0 discipline: persona_id never appears in any response. only the
   public commitment ref + label + parent + minted_at travel out.

2. contracts/PolityOffchainResolver.sol
   minimal eip-3668 wildcard resolver (~80 lines). implements
   IExtendedResolver. resolve() reverts with OffchainLookup; the full
   msg.data forwards to the gateway. resolveWithProof() recovers the
   signer from the signed hash and returns the result. supportsInterface
   reports IExtendedResolver (0x9061b923).

   modelled on ENS Labs' OffchainResolver reference at
   github.com/ensdomains/offchain-resolver. owner-settable url + signer
   for future rotation.

3. scripts/deploy-polity-resolver.ts
   one-shot tsx deploy script. uses solc to compile the contract from
   source, deploys to sepolia via viem with DEPLOYER_PRIVATE_KEY,
   passes (GATEWAY_URL, POLITY_ISSUER_PUBLIC_ADDR) to the constructor,
   prints the resolver address + the next step (set resolver on
   polity.eth via sepolia.app.ens.domains).

   npm install -D solc tsx (now in package.json)
   DEPLOYER_PRIVATE_KEY=0x... POLITY_ISSUER_PRIVATE_KEY=0x...      npx tsx scripts/deploy-polity-resolver.ts

   default gateway url:
   https://dev-beta.aigentz.me/api/ens/ccip-read/{sender}/{data}.json

operator next steps:
  1. set POLITY_ISSUER_PRIVATE_KEY env var (generate with viem.generatePrivateKey)
  2. add same key as DEPLOYER_PRIVATE_KEY (or use a different sepolia wallet)
  3. get ~0.005 sepolia eth from a faucet
  4. run: npx tsx scripts/deploy-polity-resolver.ts
  5. note the deployed resolver address
  6. set it as resolver on polity.eth via sepolia.app.ens.domains
  7. test: viem.getEnsAddress({ name: 'first-citizen.polity.eth', chain: sepolia })

once steps 1-6 are done, every ens subname minted via
POST /api/identity/persona/[id]/ens resolves on-chain through standard
ens tooling. no namestone, no justaname, just real ens.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/ens/ccip-read/[sender]/[data]/route.ts` |
| Added | `contracts/PolityOffchainResolver.sol` |
| Modified | `package-lock.json` |
| Modified | `package.json` |
| Added | `scripts/deploy-polity-resolver.ts` |

## Stats

 5 files changed, 1521 insertions(+), 32 deletions(-)
