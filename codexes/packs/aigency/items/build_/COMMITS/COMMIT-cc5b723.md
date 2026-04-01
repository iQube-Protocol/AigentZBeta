# Commit Brief: `cc5b723` — Feat/qct ux improvements (#39)

| Field | Value |
|-------|-------|
| SHA | [`cc5b723`](https://github.com/iQube-Protocol/AigentZBeta/commit/cc5b723a9d958233eedd97bdf42850539ebbce8a) |
| Author | Kn0w1 |
| Date | 2025-10-07T19:50:19Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Feat/qct ux improvements (#39)

* feat: Improve QCT Trading Card UX

- Updated chain symbols: POL (Polygon), ARB, OP, BASE for better spacing
- Changed balance display to use abbreviated symbols instead of full names
- Added smart 'Connect Wallet' button that appears when no wallet connected
- Button intelligently connects to correct wallet based on From Chain selection:
  - EVM chains → MetaMask
  - Solana → Phantom
  - Bitcoin → Coming soon message
- Button replaces wallet badges when disconnected
- Maintains same compact styling and layout

* feat: Dynamic quick action buttons in QCT Trading Card

- Quick action buttons now dynamically pair with BTC based on From Chain
- If From Chain is Ethereum: Shows 'ETH → BTC' and 'BTC → ETH'
- If From Chain is Solana: Shows 'SOL → BTC' and 'BTC → SOL'
- If From Chain is Polygon: Shows 'POL → BTC' and 'BTC → POL'
- And so on for all chains
- Default to BTC ↔ ETH when Bitcoin is selected as From Chain
- Maintains same styling and layout
```

## Files Changed

_File details not available in backfill — see commit link above._
