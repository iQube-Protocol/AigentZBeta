# Commit Brief: `b7f270f` — Fix Bitcoin explorer bug class once and for all: canonical helper + txid provenance

| Field | Value |
|-------|-------|
| SHA | [`b7f270f`](https://github.com/iQube-Protocol/AigentZBeta/commit/b7f270fd24782fb0bc8171efd681423890b13528) |
| Author | Claude |
| Date | 2026-07-06T18:24:01Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Bitcoin explorer bug class once and for all: canonical helper + txid provenance

The recurring mempool-explorer bug was a provider split: the ops page had
migrated to blockstream.info for reliability but QCT surfaces (tx history
modal, QCT dashboard) and x402 stayed on abandoned mempool.space, 404ing
intermittently. Fixes: (1) services/ops/btcExplorer.ts is now THE canonical
network-keyed explorer/API helper — every Bitcoin link and Esplora base in
the main app flows through it, enforced by a canary that scans the source
tree for hardcoded hosts; (2) txid provenance hardened — the status route
probes lastAnchorId only when txid-shaped and promotes only on explorer
confirmation (Merkle roots are 64-hex too; shape checks alone caused the
prior 404s); (3) anchor_history.anchor_txid pollution stopped — cron-tick
persists anchor()'s return only when txid-shaped, else best-effort reads
btc_anchor_txid from the latest batch; (4) NEXT_PUBLIC_RPC_BTC_TESTNET
documented and now OPTIONAL — blockstream fallback replaces the
'endpoint: not configured' dead-end. Sub-app (theqriptopian) migrated to
blockstream too (Esplora-compatible responses).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The recurring mempool-explorer bug was a provider split: the ops page had
migrated to blockstream.info for reliability but QCT surfaces (tx history
modal, QCT dashboard) and x402 stayed on abandoned mempool.space, 404ing
intermittently. Fixes: (1) services/ops/btcExplorer.ts is now THE canonical
network-keyed explorer/API helper — every Bitcoin link and Esplora base in
the main app flows through it, enforced by a canary that scans the source
tree for hardcoded hosts; (2) txid provenance hardened — the status route
probes lastAnchorId only when txid-shaped and promotes only on explorer
confirmation (Merkle roots are 64-hex too; shape checks alone caused the
prior 404s); (3) anchor_history.anchor_txid pollution stopped — cron-tick
persists anchor()'s return only when txid-shaped, else best-effort reads
btc_anchor_txid from the latest batch; (4) NEXT_PUBLIC_RPC_BTC_TESTNET
documented and now OPTIONAL — blockstream fallback replaces the
'endpoint: not configured' dead-end. Sub-app (theqriptopian) migrated to
blockstream too (Esplora-compatible responses).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `.env.example` |
| Modified | `app/(shell)/ops/page.tsx` |
| Modified | `app/api/ops/btc/status/route.ts` |
| Modified | `app/api/ops/sync/cron-tick/route.ts` |
| Modified | `app/api/x402/verify/route.ts` |
| Modified | `app/components/wallet/TransactionModal.tsx` |
| Modified | `app/data/agentConfig.ts` |
| Modified | `apps/theqriptopian-web/src/api/x402/verify/route.ts` |
| Modified | `apps/theqriptopian-web/src/components/wallet/TransactionModal.tsx` |
| Modified | `components/ops/ChainTransactionHistoryModal.tsx` |
| Modified | `components/ops/QCTDashboard.tsx` |
| Modified | `config/qct-contracts.ts` |
| Added | `services/ops/btcExplorer.ts` |
| Modified | `services/ops/btcService.ts` |
| Modified | `services/qct/EventListener.ts` |
| Modified | `services/x402/adapters/btc.ts` |
| Added | `tests/btc-explorer.test.ts` |

## Stats

 17 files changed, 251 insertions(+), 62 deletions(-)
