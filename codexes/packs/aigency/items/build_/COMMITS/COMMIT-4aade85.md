# Commit Brief: `4aade85` — fix: remove dead default imports from wallet barrel to break TDZ chain

| Field | Value |
|-------|-------|
| SHA | [`4aade85`](https://github.com/iQube-Protocol/AigentZBeta/commit/4aade85e3775e7d77bab1c7d0c43f8818798b8ba) |
| Author | Claude |
| Date | 2026-05-01T03:17:09Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: remove dead default imports from wallet barrel to break TDZ chain

PersonaSelector now imports PersonaContext (for cartridge-default UX).
The wallet barrel had explicit `import PersonaSelectorDefault` static
imports that webpack cannot tree-shake, pulling PersonaSelector into
the SmartWalletDrawer chunk and causing webpack scope-hoisting to
evaluate PersonaContext in the wrong order (sH TDZ in production).

Fix: remove the dead default re-exports (PersonaSelectorDefault etc.) and
remove PersonaSelector from the barrel entirely — it is only used via
direct import in identity/page.tsx, never via the wallet barrel.

https://claude.ai/code/session_01N5P9g719QcJgM6dEuRUosj
```

## Body

PersonaSelector now imports PersonaContext (for cartridge-default UX).
The wallet barrel had explicit `import PersonaSelectorDefault` static
imports that webpack cannot tree-shake, pulling PersonaSelector into
the SmartWalletDrawer chunk and causing webpack scope-hoisting to
evaluate PersonaContext in the wrong order (sH TDZ in production).

Fix: remove the dead default re-exports (PersonaSelectorDefault etc.) and
remove PersonaSelector from the barrel entirely — it is only used via
direct import in identity/page.tsx, never via the wallet barrel.

https://claude.ai/code/session_01N5P9g719QcJgM6dEuRUosj

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/components/wallet/index.ts` |
| Modified | `app/components/wallet/index.tsx` |

## Stats

 2 files changed, 34 deletions(-)
