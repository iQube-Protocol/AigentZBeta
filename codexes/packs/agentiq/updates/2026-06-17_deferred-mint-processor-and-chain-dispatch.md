# Deferred tokenQube mint processor + per-chain minter dispatch

**Date:** 2026-06-17
**Branch:** `claude/optimistic-davinci-exiykx`

## What changed

Completes the deferred/multi-chain mint seams left scaffolded in the registry-SoT
work.

### Per-chain minter dispatch
`services/chain/tokenQubeMintDispatch.ts` — `mintTokenQubeOnChain(chain, { personaId,
ownerAddress })` is the single seam for minting a tokenQube on a given chain.
**Base** is wired (via `mintPersonaQubeToBase`); a new reference chain (Optimism /
Solana / Bitcoin / …) is added by a new `case` here + flipping `live: true` in
`mintChains.ts`. Non-live / unimplemented chains return a `skipped` reason.

The persona mint route now mints through the dispatch (chain-agnostic) instead of
calling Base directly.

### Batch processor (live, not a stub anymore)
`processDeferredMints({ admin, limit })` drains pending rows in
`deferred_token_qube_mints`: for each row whose target chain is live, it mints via
the dispatch and reconciles the records with the resolved token id —
`deferred_token_qube_mints.status → minted` (+ tx hash), `persona_qube_mints`
(`base_token_id`, `base_tx_hash`, `on_chain`, `mint_mode`), and the
`persona_token_qube_ownership.chain_anchor`. Non-live chains / rows missing an
owner are left pending (skipped). Idempotent — safe to re-run.

### Admin trigger
`POST /api/admin/iqube/process-deferred-mints` (admin-only) drains the queue
(optional `{ limit }`); `GET` returns per-chain/status counts. Wire to a cron when
the batch cadence is decided.

## Flow recap

- Immediate mint on a live chain → minted on-chain now (Base).
- `strategy: 'deferred'`, a non-live chain, or unconfigured env → queued in
  `deferred_token_qube_mints`; the processor mints it when the chain is live.
- Token id is the deterministic T2-safe commitment throughout, so deferred and
  immediate resolve to the same id.

## Files
- `services/chain/tokenQubeMintDispatch.ts` (new)
- `services/chain/deferredMint.ts` (`processDeferredMints` implemented)
- `app/api/admin/iqube/process-deferred-mints/route.ts` (new)
- `app/api/iqube/persona/passport/mint/route.ts` (mints via dispatch)

No new migration — uses `deferred_token_qube_mints` (20260617300000).
