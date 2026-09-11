# Bitcent — Supabase receipt wiring, wallet UI, and ops card (2026-07-30)

Follows the real testnet etch (`2026-07-30_bitcent-testnet-etch-broadcast.md`, tx
`551bbaaa50b5ed91c585aee90af1e8f41932da80a93525fd1eebe234a68deb65`). Three things wired, per
operator direction: Supabase/DVN receipt persistence, wallet UI, and a network ops card.

Naming: this doc and all new code use **Bitcent** (capital B only), the operator-ratified canonical
prose spelling. The on-chain Rune name stays `BITCENT` (all-caps), unaffected — that's a Runes
protocol convention, not a prose choice.

## What was researched first (Explore agent, before any code)

No existing Supabase table for on-chain issuance events, asset registries, or treasury mandates.
The right substrate to extend is `activity_receipts` (the DVN-anchored receipt system) — not a new
table. `scripts/deploy-qct-bitcoin.js` was confirmed to persist nothing after broadcast; the real
etch lived nowhere but terminal output and prior docs before this change. The wallet UI already had
a Bitcent balance row stubbed `pending: true` with a comment citing the exact R-10/gap-register
status this etch closes — extended, not duplicated. The existing "BTC Testnet" ops card reports
Proof-of-State DVN anchor data, unrelated to Bitcent — operator chose a new, separate card rather
than overloading it.

## 1. Supabase / DVN receipt wiring

**New action type**: `bitcent_treasury_etch_executed`, added in the three places this vocabulary
requires (CLAUDE.md's DVN Pipeline Protection rule permits adding an action type unilaterally; every
other DVN pipeline change needs approval):
- `ActivityActionType` union — `services/receipts/activityReceiptService.ts`
- `ANCHORABLE_ACTION_TYPES` — `services/dvn/activityReceiptDvnPipeline.ts`
- The `activity_receipts_action_type_check` CHECK constraint, rebuilt in full —
  `supabase/migrations/20260930000200_bitcent_treasury_receipt_type.sql`

Verified via `tests/activity-receipts-action-type-parity.test.ts` (the drift-incident regression
guard) and `tests/source-of-truth-parity.test.ts` — both green.

**`services/treasury/bitcentTreasuryReceipts.ts`** — `buildBitcentEtchReceiptInput(facts, personaId)`
is a pure function (no IO, no clock) shaping the receipt's summary/`approvalsGranted`/`actionInput`
from known facts (mandate commitment, tx hash, tokenomics split, custodian/deployer addresses).
`recordBitcentEtchReceipt` is the thin IO wrapper calling `createActivityReceipt`. 7 unit tests
(`tests/bitcent-treasury-receipt.test.ts`) cover determinism, the correct action type, the
signatory/observer approval strings, and — explicitly — that no passcode/private-key material ever
appears in the built receipt.

**`scripts/record-bitcent-etch-receipt.ts`** — operator-run (requires live Supabase; confirmed
blocked from this sandbox, same as every other live-network step this session). Resolves Aigent Z's
`persona_id` via `personas.fio_handle = 'aigentz@aigent'` (the same lookup
`app/api/admin/identity/align-agent-persona/route.ts` already uses — not a new resolution
mechanism), then records the receipt for the real etch (defaults are the actual broadcast facts;
overridable via `--tx-hash=`/`--network=`/etc. for a future etch). Verified up to the live-Supabase
boundary: arg parsing, issuance-record loading, tokenomics resolution, and Supabase client
construction all succeed; it fails only at the expected network call.

```bash
npm run record:bitcent-etch-receipt
```

## 2. Wallet UI

`app/components/content/SmartWalletDrawer.tsx`'s Bitcent balance-row comment (~line 1490) updated
to reflect reality: etched (with the real tx hash), still `pending: true` on both rows because no
reliably working Rune-balance indexer was found this session — an honest "pending" rather than a
fabricated number. The two visible `"BitCent (B¢)"` labels renamed to `"Bitcent (B¢)"`. The row
machinery (label, unit, logo, pending-state styling) was already built; nothing else changed.

## 3. Network ops card

**`deployments/bitcent-testnet.json`** (new) — deployment-specific facts only (tx hash, deployer
address, mandate commitment, broadcast timestamp), mirroring the `deployments/qct-*-addresses.json`
precedent. Tokenomics are NOT duplicated here — they stay solely in
`scripts/bitcent-issuance-record.json`, the single ratified source.

**`app/api/ops/bitcent/testnet/route.ts`** (new) — reads both files server-side, does a live
confirmation/block-height check via the canonical `services/ops/btcExplorer.ts` helper (never a
hardcoded host — `tests/btc-explorer.test.ts`'s canary enforces this repo-wide), and reports
`{ ok, at, network, txHash, explorer, status, confirmations, blockHeight, runeName, symbol,
maxSupply, premine, initiallyActiveIssuance, governedReserve, premineCustodianAddress }`. Matches
the documented `NETWORK_ROUTE_PATTERN.md` response shape. Deliberately does not attempt a live
Rune-supply read — same honest gap as the wallet row, not fabricated here either.

**`hooks/ops/useBitcentTestnet.ts`** (new) — standard ops-hook shape (30s poll, `{data, loading,
error, refresh}`), matching `useBaseSepolia.ts` etc. exactly.

**`app/(shell)/ops/page.tsx`** — new card key `bitcent_testnet` ("Bitcent Treasury"), distinct color
(`badgeClassFor`: orange, vs. the existing `btc_testnet` card's amber) so the two Bitcoin-related
cards are visually distinguishable. Shows status dot, Rune name/symbol, premine, active/reserve
split, custodian address (copyable), etch tx (linked + copyable), confirmations, last check.

## Verification

- Full suite: 194 files / 3457 tests, all passing (including the new 7 receipt-builder tests and the
  re-verified `btc-explorer`/parity canaries).
- `npx tsc --noEmit` clean on every touched/new file.
- Every new script/route verified up to its live-network or live-Supabase boundary from this
  sandbox; none could be run to completion here (consistent with every other live step this
  session) — the operator's machine is required for the actual `npm run record:bitcent-etch-receipt`
  and for viewing the live ops card / wallet row against a deployed Amplify build.

## Files

- `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts` — new
  action type
- `supabase/migrations/20260930000200_bitcent_treasury_receipt_type.sql` — new
- `services/treasury/bitcentTreasuryReceipts.ts` — new
- `scripts/record-bitcent-etch-receipt.ts` — new
- `tests/bitcent-treasury-receipt.test.ts` — new
- `deployments/bitcent-testnet.json` — new
- `app/api/ops/bitcent/testnet/route.ts` — new
- `hooks/ops/useBitcentTestnet.ts` — new
- `app/(shell)/ops/page.tsx` — new card wired in
- `app/components/content/SmartWalletDrawer.tsx` — comment + label updated
- `package.json` — `record:bitcent-etch-receipt` script alias
