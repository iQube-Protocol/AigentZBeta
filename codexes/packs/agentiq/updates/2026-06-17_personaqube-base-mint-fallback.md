# PersonaQube Base mainnet mint (live, on the iQube NFT contract)

**Date:** 2026-06-17
**Surface:** AgentiQ OS → Registry → Persona → Mint (routes to SmartWallet → iQube tab PersonaQube mint)
**Branch:** `claude/optimistic-davinci-exiykx`

## Why

The PersonaQube mint (`/api/iqube/persona/passport/mint`) was **Sui/Walrus only**
and the Sui Move call is an unimplemented TODO, so it always showed "stub mode".
There was no Base path wired into the persona mint even though the Base ERC-721
mint stack exists. iQube is the first-class primitive and persona is a derivative
tokenQube, so the PersonaQube now mints against the **same iQube NFT contract**
(`IQUBE_NFT_CONTRACT_ADDRESS`).

## What changed

- **`services/chain/baseTokenMint.ts`** — new `mintPersonaQubeToBase({ personaId,
  ownerAddress })` reusing the existing signer / chain-id assertion / ERC-721
  `safeMint` against `IQUBE_NFT_CONTRACT_ADDRESS`. The token id is a **one-way
  commitment over the persona id** (`sha256('iqube:persona:'+personaId)` → uint256)
  — T2-safe, deterministic/idempotent, and the raw persona id never goes on-chain
  (the locker-UUID protocol). `safeMint` revert on an existing token is treated as
  idempotent success. No-ops cleanly (`skipped`) when the Base env isn't set.
- **`/api/iqube/persona/passport/mint`** — when the Sui/Walrus result isn't
  on-chain, mint the PersonaQube on Base to the persona's EVM address. On success
  the response/record carry `baseTokenId` + `baseTxHash`, `mode: 'base'`,
  `onChain: true`. Persisted to `persona_qube_mints` (soft-fall back if the new
  columns aren't migrated yet). GET returns the base fields too.
- **`supabase/migrations/20260617200000_persona_qube_base_mint.sql`** — adds
  `base_token_id` + `base_tx_hash` to `persona_qube_mints`.
- **SmartWalletDrawer PersonaQube card** — shows the **PersonaQube NFT** id +
  Base tx (in place of Sui/Walrus) when minted on Base; "on-chain" instead of
  "stub mode"; the stub hint now names the Base env vars first.

## Env (already confirmed set in dev Amplify)

`IQUBE_NFT_CONTRACT_ADDRESS` (the iQube NFT contract) + `BASE_MINTER_PRIVATE_KEY`
+ a Base mainnet RPC. With these set, the mint goes on-chain and the card shows
the NFT id; without them it stays stub (never fakes liveness).

## Migration to run

```sql
-- supabase/migrations/20260617200000_persona_qube_base_mint.sql
ALTER TABLE public.persona_qube_mints
  ADD COLUMN IF NOT EXISTS base_token_id text,
  ADD COLUMN IF NOT EXISTS base_tx_hash  text;
```
