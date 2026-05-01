# Commit Brief: `9bf2293` — fix drawer z-index, KNYT store link, copilot on store tabs, investor tab visibility

| Field | Value |
|-------|-------|
| SHA | [`9bf2293`](https://github.com/iQube-Protocol/AigentZBeta/commit/9bf229332d417c0e3b4e319a4b2fc88e737e8c48) |
| Author | Claude |
| Date | 2026-05-01T17:21:01Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix drawer z-index, KNYT store link, copilot on store tabs, investor tab visibility

- raise iQube/identity/memory/connections/wallet drawer z-indices above cartridge overlay (z-[60] → z-[65]–z-[70])
- fix welcome takeover AI prompt: tab="store" → tab="store-episodes" (correct slug)
- add CodexCopilotLayer for knyt-codex store group tabs in CodexPanelDynamic
- remove adminOnly gate from store-investor tab so all users can view it
- add CRM investor-status check in KnytStoreInvestorTab: purchase buttons locked for non-CRM-verified investors

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

- raise iQube/identity/memory/connections/wallet drawer z-indices above cartridge overlay (z-[60] → z-[65]–z-[70])
- fix welcome takeover AI prompt: tab="store" → tab="store-episodes" (correct slug)
- add CodexCopilotLayer for knyt-codex store group tabs in CodexPanelDynamic
- remove adminOnly gate from store-investor tab so all users can view it
- add CRM investor-status check in KnytStoreInvestorTab: purchase buttons locked for non-CRM-verified investors

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/runtime/takeover/infer/route.ts` |
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `app/triad/components/codex/tabs/KnytStoreInvestorTab.tsx` |
| Modified | `components/AgentWalletDrawer.tsx` |
| Modified | `components/iqube/ConnectionsIQubeDrawer.tsx` |
| Modified | `components/iqube/MemoryIQubeDrawer.tsx` |
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |
| Modified | `data/codex-configs.ts` |

## Stats

 8 files changed, 95 insertions(+), 32 deletions(-)
