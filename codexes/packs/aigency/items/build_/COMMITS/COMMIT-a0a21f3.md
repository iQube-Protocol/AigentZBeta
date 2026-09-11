# Commit Brief: `a0a21f3` — receipt card: show full card collapsed, gate only chain-of-intent; fix cycles card layout + error surfacing

| Field | Value |
|-------|-------|
| SHA | [`a0a21f3`](https://github.com/iQube-Protocol/AigentZBeta/commit/a0a21f3c96e305e1fadd15295a582536863af2fc) |
| Author | Claude |
| Date | 2026-06-09T04:21:40Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
receipt card: show full card collapsed, gate only chain-of-intent; fix cycles card layout + error surfacing

- ActivityReceiptCard: default collapsed, show chips/footer/status always,
  expand chevron (right-aligned) only gates chain-of-intent + JSON viewer
- CyclesManagementCard: move top-up button below canister name to prevent
  bleed outside card boundary
- cycles-status: surface actual Management Canister error in alert text,
  add dfx proxy fallback for Amplify/cloud environments

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b
```

## Body

- ActivityReceiptCard: default collapsed, show chips/footer/status always,
  expand chevron (right-aligned) only gates chain-of-intent + JSON viewer
- CyclesManagementCard: move top-up button below canister name to prevent
  bleed outside card boundary
- cycles-status: surface actual Management Canister error in alert text,
  add dfx proxy fallback for Amplify/cloud environments

https://claude.ai/code/session_01GAaQ29phj1nbW8wKrx2g3b

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/ops/canisters/cycles-status/route.ts` |
| Modified | `components/metame/cards/ActivityReceiptCard.tsx` |
| Modified | `components/ops/CyclesManagementCard.tsx` |

## Stats

 3 files changed, 76 insertions(+), 52 deletions(-)
