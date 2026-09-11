# PersonaQube → iQube registry SoT + bearer tokenQube + deferred/multi-chain

**Date:** 2026-06-17
**Branch:** `claude/optimistic-davinci-exiykx`

## Model (operator-confirmed)

Every persona mint now produces the full iQube trinity and a registry SoT entry:

- **metaQube** (public, T2-safe) — `primitive_type: DataQube`. Name/slug from
  `persona_public_ref`; metadata carries only commitments + refs (token id,
  chain, Sui/Walrus locker pointers). No BlakQube bytes, no display name, no
  persona_id.
- **iqube_id_map** row — the canonical registry SoT join (`source: triad_meta`).
  The persona now shows up as a registered iQube (global SoT).
- **blakQube (locker)** — the encrypted persona descriptor on Sui/Walrus (or the
  encrypted blob); never public.
- **tokenQube (bearer)** — the **Base ERC-721** on the iQube NFT contract
  (`IQUBE_NFT_CONTRACT_ADDRESS`), minted on **every** mint (not a fallback). The
  token id is a one-way commitment over the persona id (T2-safe). The Base NFT
  is the bearer token for the Sui/Walrus locker (the meta carries the locker
  refs).
- **persona_token_qube_ownership** — per-persona ownership (persona_id is T0,
  service-role RLS); `chain_anchor` holds public refs only.

## Deferred batch mint + multi-chain readiness

- `services/chain/mintChains.ts` — the mint-target registry. **Base is live**;
  Optimism / Arbitrum / Polygon / Solana / Bitcoin are declared `live: false`
  (extend as the canonical ref-chain set is finalised). A chain goes live by
  flipping the flag + wiring its minter.
- `services/chain/deferredMint.ts` — `enqueueDeferredMint` queues mints that are
  (a) requested as a batch (`strategy: 'deferred'`), (b) targeting a non-live
  chain, or (c) blocked by unconfigured env. `processDeferredMints` is a
  documented **stub** for the future batch processor / per-chain minters.
- `supabase/migrations/20260617300000_deferred_token_qube_mints.sql` — the queue
  table (persona_id T0, service-role RLS) + `persona_qube_mints.iqube_id` link.

The mint route accepts optional `{ chain, strategy }`; defaults are
`base` + `immediate`. Idempotent throughout (deterministic token id;
`iqube_id_map` unique; `persona_qube_mints.iqube_id` reused on re-mint).

## T0-T2 / BlakQube privacy

The registry/meta surface exposes only commitments + the NFT id + locker refs.
The BlakQube (encrypted persona descriptor) never enters the registry; the
ownership table that holds the T0 persona_id is service-role-only.

## Files

- `services/chain/mintChains.ts`, `services/chain/deferredMint.ts` (new)
- `services/chain/baseTokenMint.ts` (export `derivePersonaTokenIdHex`)
- `services/persona/registerPersonaIqube.ts` (new — registry SoT entry)
- `app/api/iqube/persona/passport/mint/route.ts` (always-mint bearer + register + deferred/chain seam; returns `iqubeId`, `chain`, `deferred`)
- `supabase/migrations/20260617300000_deferred_token_qube_mints.sql`

## Migration to run

```sql
-- 20260617300000_deferred_token_qube_mints.sql (+ persona_qube_mints.iqube_id)
```
(plus the earlier `20260617200000_persona_qube_base_mint.sql` if not yet applied.)
