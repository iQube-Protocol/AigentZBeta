# Addendum – Hybrid DVN & Three‑Tier Batching
Date: 2025-10-12

- DVN→PoS→BTC anchor (IC) is live. Next.js shows live data but does not yet persist/batch/anchor.
- All events shown originate from on‑chain/canister sources (verifiable txids/receipts).

## Three‑Tier Policy
1) Fast‑Track (high‑value): direct DVN→PoS individual anchor.
2) Drift Batch (canister): if DVN−PoS drift > 10, auto‑batch and anchor.
3) Server Batch (planned): Next.js append‑only logs → Merkle root → DVN BatchCommit → PoS anchor → purge; keep audit index + proof API.

## Next Steps
- Implement server tx log, Merkle batcher, DVN BatchCommit, PoS batch receipts.
- Build audit/proof APIs and purge policy; add governance thresholds & dashboards.
