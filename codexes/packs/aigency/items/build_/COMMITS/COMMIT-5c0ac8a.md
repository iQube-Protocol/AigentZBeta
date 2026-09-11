# Commit Brief: `5c0ac8a` — CTP Slice C: atomic wallet conversion (Part B) + ctp.wallet.asset.convert (Part C)

| Field | Value |
|-------|-------|
| SHA | [`5c0ac8a`](https://github.com/iQube-Protocol/AigentZBeta/commit/5c0ac8a9bff20a225e7955270ef64e4c3462cd7c) |
| Author | Claude |
| Date | 2026-09-01T06:32:31Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CTP Slice C: atomic wallet conversion (Part B) + ctp.wallet.asset.convert (Part C)

Part B canonicalises the USDC->BASE_QC conversion mechanics into ONE atomic
Postgres function (convert_wallet_asset) rather than the prior separate
debit-then-credit composition, which never checked write errors, allowed a
read-modify-write race, and "rolled back" a failed credit with a
compensating credit instead of a real transaction abort. Both balance rows
lock in a fixed order (SELECT ... FOR UPDATE, ascending asset_code) so two
concurrent conversions between the same asset pair cannot deadlock; any
failure anywhere aborts the whole transaction with no compensating logic
needed. services/wallet/qctLedgerService.ts's new convertWalletAsset binds
this one function; debitWalletAsset/creditWalletAsset are preserved
unmodified for their existing non-conversion callers.

Part C registers ctp.wallet.asset.convert (USDC -> BASE_QC only; BCENT
stays out of scope for this slice pending real BitCent settlement) and
converts the route into a thin web-channel adapter over
constitutionalRuntime.execute. Principal-only (delegability: false): the
durable delegation_grants model was inspected and cannot yet express
amount/asset-scoped conversion authority (no ceiling/asset-scope fields at
all, only a free-text spend_autonomy label and a count-based max_actions) --
per instruction this fails closed structurally rather than reusing a
generic spend permission for what is not an outbound spend. Projected
consequence is computed before any mutation; authorization checks it before
execution; the atomic function's own insufficient-funds guard remains the
final race-safe enforcement regardless. Evidence flows through the existing
ctp_transition_evidence path, with the domain ledger (wallet_transactions)
remaining the financial system of record.

Requires supabase/migrations/20260930150000_wallet_atomic_convert.sql to be
applied to the live database before this can be deployed -- NOT deployed to
dev yet, pending that.
```

## Body

Part B canonicalises the USDC->BASE_QC conversion mechanics into ONE atomic
Postgres function (convert_wallet_asset) rather than the prior separate
debit-then-credit composition, which never checked write errors, allowed a
read-modify-write race, and "rolled back" a failed credit with a
compensating credit instead of a real transaction abort. Both balance rows
lock in a fixed order (SELECT ... FOR UPDATE, ascending asset_code) so two
concurrent conversions between the same asset pair cannot deadlock; any
failure anywhere aborts the whole transaction with no compensating logic
needed. services/wallet/qctLedgerService.ts's new convertWalletAsset binds
this one function; debitWalletAsset/creditWalletAsset are preserved
unmodified for their existing non-conversion callers.

Part C registers ctp.wallet.asset.convert (USDC -> BASE_QC only; BCENT
stays out of scope for this slice pending real BitCent settlement) and
converts the route into a thin web-channel adapter over
constitutionalRuntime.execute. Principal-only (delegability: false): the
durable delegation_grants model was inspected and cannot yet express
amount/asset-scoped conversion authority (no ceiling/asset-scope fields at
all, only a free-text spend_autonomy label and a count-based max_actions) --
per instruction this fails closed structurally rather than reusing a
generic spend permission for what is not an outbound spend. Projected
consequence is computed before any mutation; authorization checks it before
execution; the atomic function's own insufficient-funds guard remains the
final race-safe enforcement regardless. Evidence flows through the existing
ctp_transition_evidence path, with the domain ledger (wallet_transactions)
remaining the financial system of record.

Requires supabase/migrations/20260930150000_wallet_atomic_convert.sql to be
applied to the live database before this can be deployed -- NOT deployed to
dev yet, pending that.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/wallet/qct/convert/usdc-to-qc/route.ts` |
| Added | `services/ctp/primitives/walletAssetConvert.ts` |
| Modified | `services/wallet/qctLedgerService.ts` |
| Added | `services/wallet/usdcToBaseQcQuote.ts` |
| Added | `supabase/migrations/20260930150000_wallet_atomic_convert.sql` |
| Added | `tests/ctp-wallet-asset-convert-primitive.test.ts` |
| Added | `tests/ctp-wallet-channel-singularity.test.ts` |
| Added | `tests/wallet-atomic-convert-service.test.ts` |
| Deleted | `tests/wallet-usdc-to-qc-authorization.test.ts` |
| Added | `tests/wallet-usdc-to-qc-route-ctp.test.ts` |

## Stats

 10 files changed, 1116 insertions(+), 192 deletions(-)
