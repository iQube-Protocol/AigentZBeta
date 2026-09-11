# SmartTriad Wallet — Q¢ Primary Currency Restructure (Base Q¢ mainnet + BitCent stub)

**Scope:** the GLOBAL SmartTriad wallet only — `app/components/content/SmartWalletDrawer.tsx`
(the canonical embedded wallet, ~5,500 lines). A separate, more constrained "Companion wallet"
variant was being worked on concurrently by a different agent in this same session window and
was deliberately left untouched.

## What changed

### 1. Primary currency swap
- Top-of-wallet primary display: **Q¢ QriptoCENT** (was: KNYT).
- Detail row underneath: **BitCent (B¢)** and **Base Q¢** (was: KNYT (DVN) / KNYT (EVM)), with
  **USDC unchanged**.
- The KNYT cartridge-economy block ("$KNYT · Cartridge Economy") is untouched, per the operator's
  explicit instruction.

### 2. Balance-total relabeling
- The Balances section's old **EVM vs DVN** split is now **L1s vs DVN**.
- **L1s = B¢ + Base Q¢ (mainnet)** — this *replaces* what the old "EVM total" summed (which used
  to add every legacy testnet EVM Q¢ balance: Ethereum/Arbitrum/Base Sepolia, Optimism/Polygon/
  Solana placeholders, generic Bitcoin Q¢). Those legacy rows still render in the expanded
  **Testnet** group — they just no longer feed the headline L1s / Total Q¢ figures.
- **DVN total** is unchanged in its source: `useBaseQcBalance` → `/api/wallet/base-qc/balance` →
  the `qc_balances` table (`currency = 'base_qc'`). This is a real, existing off-chain deferred
  custody balance — see the "DVN Q¢ existence" finding below.

### 3. Expanded balances — Mainnet / Testnet split
The expanded "Balances" list is now grouped:
- **Mainnet**: B¢ (pending stub), Base Q¢ (live mainnet read) + subtotal.
- **Testnet**: B¢ (pending stub), Base Q¢ (Base Sepolia), plus the remaining legacy per-chain
  testnet rows (Ethereum/Arbitrum Sepolia, Optimism/Polygon/Solana placeholders, generic Bitcoin
  Q¢) + subtotal.
- **DVN Q¢** renders last, just above the grand "Total Q¢" line (unchanged formula: L1s + DVN).

### 4. Base Q¢ MAINNET — now read live
New files:
- `app/api/wallet/qct/base-mainnet-balance/route.ts` — wraps the existing
  `services/wallet/qctCanonicalService.ts::getQctMainnetBalance()`, which already read the
  Base mainnet QCT contract (`0x46CD79B8f795169FC59D5f1DE1a444c3C39fE7CE`, chain 8453) via viem
  but had no client-facing route.
- `app/hooks/useQctBaseMainnetBalance.ts` — client hook consuming that route.

This is distinct from two pre-existing balances that look similar but are not:
- `useBalances().qctBase` reads the **Base SEPOLIA (testnet)** contract, not mainnet.
- `useBaseQcBalance()` reads the off-chain **DVN custody ledger** (`qc_balances` table), not an
  on-chain balance at all.

`configured: false` (contract address env unset) renders a "Pending" state, never a silent zero.

### 5. BitCent (B¢) — stubbed, not wired to a live source
No code changes were needed to "wire" B¢ reads because there is nothing live to read from on
either network. See the B¢ finding below. The UI renders B¢ as `—` with a "Pending etch" /
"Pending" badge on both Mainnet and Testnet.

### 6. USDC → Q¢ conversion — destination choice added
The existing "Convert USDC → Q¢" flow now has a **Base Q¢ / BitCent (B¢)** destination toggle
(defaults to Base Q¢, preserving prior behaviour for any caller that omits `destination`).
- `app/api/wallet/qct/convert/usdc-to-qc/route.ts` accepts `destination?: 'BASE_QC' | 'BCENT'`
  (the `QriptoDenomination` type from `services/qriptocent/settlement/types.ts` — reused, not
  duplicated) and credits the corresponding ledger asset.
- `services/wallet/qctLedgerService.ts` — `WalletAssetCode` extended with `'BCENT'` so the
  ledger can hold an off-chain B¢ balance. This is a **simulated/off-chain credit** — B¢ has no
  live Rune to settle against yet, consistent with the Phase-1-simulation model already
  established in the cross-denomination settlement substrate
  (`services/qriptocent/settlement/types.ts`, `1 B¢ = 1 Base Q¢ = one cent of reference value`).

### 7. Wallet wiring (X402 / TransactionModal)
`app/components/wallet/TransactionModal.tsx`:
- Added **Base Mainnet (chain 8453)** as a live, active Send/Receive network option, with
  `QCT_ADDRESSES[8453] = process.env.NEXT_PUBLIC_QCT_BASE_MAINNET`. This reuses the modal's
  existing custody/claim/canonical execution paths unchanged — no parallel transfer mechanism was
  built.
- Added a `'bitcent-mainnet'` chain entry, kept `active: false` ("Coming soon"), matching the
  existing precedent for `'btc-testnet'` / `'sol-devnet'`. Because the Send tab only renders
  `SUPPORTED_CHAINS.filter(c => c.active)`, this entry does **not** appear as a selectable-but-
  broken control in Send (Companion Menu invariant MS-9: "a control that cannot act must not
  render") — it only surfaces, correctly disabled with a "Soon" badge, in the Verify tab's full
  chain grid, which already renders inactive chains that way.
- `SmartWalletDrawer`'s primary-block Send/Receive buttons now open the modal with
  `chainId: 8453` by default (was implicitly KNYT/Ethereum-mainnet-first via the KNYT block).

## Explicit findings the operator asked for

### X402 / Bitcoin Rune transfer capability — NOT already supported, new plumbing required
Read end-to-end: `services/x402/router.ts`, `services/x402/signing.ts`,
`services/x402/schemas.ts`, `services/x402/config.ts`, `services/x402/exec.ts`,
`services/x402/adapters/btc.ts`.

- **`signing.ts`** is asset-agnostic (ed25519 signature over a generic header tuple including a
  free-text `asset` field) — it would sign a Rune-denominated transfer identically to any other.
- **`schemas.ts`** validates `asset`, `chain`, `redeem_to.chain` etc. as plain `z.string()` — a
  Rune ticker or a `'bitcoin'` chain string would pass validation as-is.
- **`router.ts`**'s `handleCustody` parses `iqube_ref` as `iq:<chain>/<contract>/<tokenId>` — an
  EVM-shaped reference (contract address + token id). Bitcoin Runes have no contract address or
  token id; they are UTXO/rune-id based. This parsing does not fit a Rune reference.
- **`exec.ts`** and **`config.ts`** are **entirely EVM**: `ethers.js JsonRpcProvider` +
  `Wallet` + ABI-bound contract calls (`ITokenQubeACL`, `IClaimManager`), configured per chain via
  `{ rpcUrl, aclAddress, claimManagerAddress }`. There is no Bitcoin/Rune branch anywhere in the
  execution layer.
- **`adapters/btc.ts`** is the only Bitcoin-aware code in X402, and it does something different:
  it anchors an **iQube ref's hash** into a Bitcoin OP_RETURN via the ICP `btc_signer_psbt`
  canister (threshold ECDSA). It does not move a Rune-denominated balance and has no concept of
  a Rune ticker, Rune UTXOs, or Rune transfer construction.

**Conclusion:** X402's schema/signing layer would *accept* a Rune-denominated transfer without
modification (nothing there is EVM-specific), but the **execution layer has zero Bitcoin Rune
support today** — no chain config shape for it, no rune-transfer construction, no rune-balance
read. Wiring a real B¢ transfer through X402 would require new plumbing: a Rune-aware
execution adapter (UTXO selection, Rune transfer output construction, likely extending or
paralleling `adapters/btc.ts`'s canister-based signing) plus a new `exec.ts` branch or
equivalent. This is why B¢ is stubbed rather than "wired" in this pass — there is no live Rune to
target, and no execution path to reach it even if there were.

### B¢ mainnet (and testnet) contract — confirmed still not live
Checked `codexes/packs/agentiq/updates/2026-07-29_qriptocent-supply-constitution.md` and
`.../2026-07-28_vl-ct-001-gap-register.md` (R-10) plus both etching scripts
(`scripts/deploy-qct-runes.{js,ts}`, `scripts/deploy-qct-bitcoin.js`) for any newer etching
record. **R-10 is still open** — no Rune has been etched on any network. The two scripts
disagree on tokenomics (400M/47,619-per-mint/21,000-cap vs. 100M/1,000-per-mint/900,000,000-cap)
and are both explicitly guarded/flagged as non-authoritative pending an operator ruling on
allocation. No txid, no Rune id, no etch confirmation exists anywhere in the repo. B¢ is
correctly represented in this pass as a clearly labeled **pending** stub on both Mainnet and
Testnet, never a silent zero.

### DVN Q¢ balance — confirmed it DOES exist today
`useBaseQcBalance()` → `GET /api/wallet/base-qc/balance?personaId=...` → Supabase `qc_balances`
table filtered to `currency = 'base_qc'`, summed per persona. This is a real, already-wired
off-chain deferred/custody balance (analogous to `dvnKnyt`), not something I invented. The
relabeled "DVN" total in the Balances section continues to source from exactly this — no new
DVN Q¢ source was fabricated, per the operator's explicit instruction not to invent one.

## Files touched

- `app/components/content/SmartWalletDrawer.tsx` — primary display, balance rows/groups, totals,
  convert-destination toggle.
- `app/components/wallet/TransactionModal.tsx` — Base Mainnet (8453) + BitCent stub chain entries.
- `app/api/wallet/qct/convert/usdc-to-qc/route.ts` — destination param.
- `services/wallet/qctLedgerService.ts` — `WalletAssetCode` extended with `'BCENT'`.
- `app/api/wallet/qct/base-mainnet-balance/route.ts` — new.
- `app/hooks/useQctBaseMainnetBalance.ts` — new.

## Verification

- `npx tsc --noEmit` — the repo's `tsconfig.json` currently fails before reaching any project file
  (`ignoreDeprecations: "6.0"` rejected by the installed TypeScript 5.9.3, plus a `types/iqube`
  `typeRoots` entry with no package structure) — a **pre-existing environment issue**, confirmed
  unrelated to this change (it also fails on a bare tsconfig read, before any source file loads).
  Re-ran with a scratch tsconfig that only relaxes those two settings (not committed, not part of
  this change): the resulting ~950 project-wide errors were diffed against this change's
  identifiers (`bcentMainnetPending`, `qctMainnetBalance`, `mainnetBalanceRows`,
  `testnetBalanceRows`, `l1sTotal`, `qcTopTotal`, `convertDestination`, `QriptoDenomination`,
  `8453`, `bitcent-mainnet`, etc.) — **zero matches**. The handful of errors on touched lines in
  `SmartWalletDrawer.tsx` (`PersonaState.personaId`, `WalletTasksPayload.standingScore`,
  `PersonaState.btcAddress`) are pre-existing, on lines this change did not touch.
- `npx vitest run` (full suite): **3334 passed, 1 failed** (185 files). The one failure
  (`tests/research-lab-workspace.test.ts`) is in `data/codex-configs.ts`, a file mid-edit by a
  different concurrent agent in this same session window — unrelated to wallet/balance code and
  not touched by this change.
- Focused runs, all green: `tests/qriptocent-settlement-substrate.test.ts` (123 tests — exercises
  the `services/qriptocent/settlement/types.ts` module this change imports `QriptoDenomination`
  from), `tests/persona-spine-fetch.test.ts` (5 tests — confirms `SmartWalletDrawer.tsx`'s
  existing KNOWN_DEBT bootstrap-fetch status is unaffected; neither new route is a spine
  endpoint, so no `personaFetch` requirement applies to them).
- **No live browser/dev-server render check was performed** — not attempted in this pass, stated
  explicitly rather than claimed.

## Not done / explicitly out of scope

- No real B¢ balance read or transfer path — none can exist until the Rune is etched (R-10) and
  new X402 execution plumbing is built (see finding above).
- No changes to the Companion wallet variant.
- No changes to `services/x402/exec.ts` / `config.ts` / the DVN pipeline files — none of the
  paramount-protected files in CLAUDE.md were touched.
