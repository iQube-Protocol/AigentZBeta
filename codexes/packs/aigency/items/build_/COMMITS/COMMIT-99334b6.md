# Commit Brief: `99334b6` — go live — walrus http publisher + real worldid idkit widget

| Field | Value |
|-------|-------|
| SHA | [`99334b6`](https://github.com/iQube-Protocol/AigentZBeta/commit/99334b6e04b4b5247b80dcb6079ffe709d283428) |
| Author | Claude |
| Date | 2026-06-13T20:48:41Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
go live — walrus http publisher + real worldid idkit widget

per operator request 2026-06-13 'must all be live end-to-end' — moving
from stub mode to real on-chain / real SDK on the integrations we can
flip in code without external setup beyond env vars.

npm install:
  @mysten/sui (2.17.0)
  @mysten/walrus (1.1.7)
  @worldcoin/idkit (4.1.8)
  @worldcoin/minikit-js (2.0.3)
  @worldcoin/agentkit (0.2.0)
  @atheonxyz/verity (provekit sdk, 0.3.2-alpha)

WALRUS — LIVE via HTTP publisher (no Sui keypair needed):

- services/persona/mintPersonaToSui.ts: realWalrusPublish now PUTs the
  encrypted persona descriptor to <WALRUS_PUBLISHER_URL>/v1/blobs?epochs=N
  using the standard Walrus HTTP publisher API. mysten runs a public
  anonymous-write testnet publisher at
  publisher.walrus-testnet.walrus.space which we default to. response
  carries blobId in newlyCreated.blobObject OR alreadyCertified. mode
  is 'sui-walrus' (live) when WALRUS_PUBLISHER_URL is set to a real URL
  (the default IS real now — not stub mode).
- services/passport/lockerStorage.ts: same pattern for locker uploads.
- both modules: realSuiCreate is wired but deferred — when SUI_PACKAGE_ID
  is set AND a persona-qube / locker-item Move package is deployed, the
  on-chain Sui object can be minted. until then, suiObjectId is a
  T1-safe deterministic ref over the REAL Walrus blob_id (not a stub).

WORLD ID — LIVE via real IDKitWidget:

- new components/passport/WorldIdButton.tsx — production component
  wrapping @worldcoin/idkit's IDKitWidget. when
  NEXT_PUBLIC_WORLD_ID_APP_ID is set, mounts the real Worldcoin modal
  with action + signal pinned per-passport; success callback receives
  the real (proof, merkle_root, nullifier_hash, verification_level)
  bundle and forwards to the caller. when env var unset, falls back to
  dev-worldid-orb so local sandboxes still demo.
- app/triad/components/codex/tabs/PassportRegistryTab.tsx — replaces
  the prior dev-token handler with WorldIdButton. handler renamed
  handleWorldIdUpgrade -> handleWorldIdProof.
- app/components/content/SmartWalletDrawer.tsx — same replacement.
  PassportQube section now mounts WorldIdButton with the passport-id
  signal so nullifier reuse can't collide across passports.
- server side (services/passport/personhoodProof.ts) already calls the
  real worldcoin cloud verifier when WORLD_ID_APP_ID set — no change
  needed.

NAMESTONE — already real (services/identity/namestoneClient.ts:73
calls the real https://namestone.com/api/public_v1/set-name endpoint);
just needs NAMESTONE_API_KEY env var set.

deferred to follow-ups (need external setup beyond env vars):
- Sui Move package deploy (~30 min operator work for the persona_qube
  + locker_item modules)
- AgentKit policy server integration (current HMAC token kept as
  placeholder; @worldcoin/agentkit installed for future wiring)
- ProveKit real circuit compilation (current HMAC token kept; verity
  sdk installed; needs .pkp/.pkv circuit bytes from compiled noir)

operator env vars to set (production):
  WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space (default)
  WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space (default)
  WALRUS_EPOCHS=5 (default — ~10 days storage)
  NEXT_PUBLIC_WORLD_ID_APP_ID=<from dev.worldcoin.org>
  NEXT_PUBLIC_WORLD_ID_ACTION_ID=polity-passport-verify
  WORLD_ID_APP_ID=<same as above, server side>
  WORLD_ID_ACTION_ID=polity-passport-verify
  NAMESTONE_API_KEY=<from namestone.com>

after these are set in amplify + a fresh build, every walrus upload
hits a real testnet publisher (verifiable at aggregator), every world
id verify pops the real worldcoin modal, every ENS name minted is
live on polity.eth (or chosen parent).
```

## Body

per operator request 2026-06-13 'must all be live end-to-end' — moving
from stub mode to real on-chain / real SDK on the integrations we can
flip in code without external setup beyond env vars.

npm install:
  @mysten/sui (2.17.0)
  @mysten/walrus (1.1.7)
  @worldcoin/idkit (4.1.8)
  @worldcoin/minikit-js (2.0.3)
  @worldcoin/agentkit (0.2.0)
  @atheonxyz/verity (provekit sdk, 0.3.2-alpha)

WALRUS — LIVE via HTTP publisher (no Sui keypair needed):

- services/persona/mintPersonaToSui.ts: realWalrusPublish now PUTs the
  encrypted persona descriptor to <WALRUS_PUBLISHER_URL>/v1/blobs?epochs=N
  using the standard Walrus HTTP publisher API. mysten runs a public
  anonymous-write testnet publisher at
  publisher.walrus-testnet.walrus.space which we default to. response
  carries blobId in newlyCreated.blobObject OR alreadyCertified. mode
  is 'sui-walrus' (live) when WALRUS_PUBLISHER_URL is set to a real URL
  (the default IS real now — not stub mode).
- services/passport/lockerStorage.ts: same pattern for locker uploads.
- both modules: realSuiCreate is wired but deferred — when SUI_PACKAGE_ID
  is set AND a persona-qube / locker-item Move package is deployed, the
  on-chain Sui object can be minted. until then, suiObjectId is a
  T1-safe deterministic ref over the REAL Walrus blob_id (not a stub).

WORLD ID — LIVE via real IDKitWidget:

- new components/passport/WorldIdButton.tsx — production component
  wrapping @worldcoin/idkit's IDKitWidget. when
  NEXT_PUBLIC_WORLD_ID_APP_ID is set, mounts the real Worldcoin modal
  with action + signal pinned per-passport; success callback receives
  the real (proof, merkle_root, nullifier_hash, verification_level)
  bundle and forwards to the caller. when env var unset, falls back to
  dev-worldid-orb so local sandboxes still demo.
- app/triad/components/codex/tabs/PassportRegistryTab.tsx — replaces
  the prior dev-token handler with WorldIdButton. handler renamed
  handleWorldIdUpgrade -> handleWorldIdProof.
- app/components/content/SmartWalletDrawer.tsx — same replacement.
  PassportQube section now mounts WorldIdButton with the passport-id
  signal so nullifier reuse can't collide across passports.
- server side (services/passport/personhoodProof.ts) already calls the
  real worldcoin cloud verifier when WORLD_ID_APP_ID set — no change
  needed.

NAMESTONE — already real (services/identity/namestoneClient.ts:73
calls the real https://namestone.com/api/public_v1/set-name endpoint);
just needs NAMESTONE_API_KEY env var set.

deferred to follow-ups (need external setup beyond env vars):
- Sui Move package deploy (~30 min operator work for the persona_qube
  + locker_item modules)
- AgentKit policy server integration (current HMAC token kept as
  placeholder; @worldcoin/agentkit installed for future wiring)
- ProveKit real circuit compilation (current HMAC token kept; verity
  sdk installed; needs .pkp/.pkv circuit bytes from compiled noir)

operator env vars to set (production):
  WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space (default)
  WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space (default)
  WALRUS_EPOCHS=5 (default — ~10 days storage)
  NEXT_PUBLIC_WORLD_ID_APP_ID=<from dev.worldcoin.org>
  NEXT_PUBLIC_WORLD_ID_ACTION_ID=polity-passport-verify
  WORLD_ID_APP_ID=<same as above, server side>
  WORLD_ID_ACTION_ID=polity-passport-verify
  NAMESTONE_API_KEY=<from namestone.com>

after these are set in amplify + a fresh build, every walrus upload
hits a real testnet publisher (verifiable at aggregator), every world
id verify pops the real worldcoin modal, every ENS name minted is
live on polity.eth (or chosen parent).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Modified | `app/triad/components/codex/tabs/PassportRegistryTab.tsx` |
| Added | `components/passport/WorldIdButton.tsx` |
| Modified | `package-lock.json` |
| Modified | `package.json` |
| Modified | `services/passport/lockerStorage.ts` |
| Modified | `services/persona/mintPersonaToSui.ts` |

## Stats

 7 files changed, 977 insertions(+), 158 deletions(-)
