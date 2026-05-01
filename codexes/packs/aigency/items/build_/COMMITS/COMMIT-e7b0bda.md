# Commit Brief: `e7b0bda` — fix: SmartWalletDrawer hook-order TDZ — declare archived-persona useState before allAvailablePersonas useMemo

| Field | Value |
|-------|-------|
| SHA | [`e7b0bda`](https://github.com/iQube-Protocol/AigentZBeta/commit/e7b0bda4895da2d6229ef830387e38367d35c9ea) |
| Author | Claude |
| Date | 2026-05-01T04:17:07Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: SmartWalletDrawer hook-order TDZ — declare archived-persona useState before allAvailablePersonas useMemo

Root cause of the production-only ReferenceError 'Cannot access "sH" before initialization' (chunk 35101):

- Commit a3a4ed70 (persona archive toggle) added showArchivedPersonas + archivedPersonas to the allAvailablePersonas useMemo dependency array on line 268.
- The useState declarations for those variables sat on lines 304-305, AFTER the useMemo.
- JavaScript TDZ rule: useMemo's deps array is evaluated immediately when the hook is called, so on every render the deps array tried to read const bindings that had not yet been initialized.
- Minified output confirmed: sH = archivedPersonas (useState([])), sY = showArchivedPersonas (useState(false)). The deps array [...,sY,sH] is referenced before the [sH,sK]=useState([]) declaration.

Fix: move the two useState calls above the useMemo. No behaviour change; React hook call order is preserved (this is a single component body, all hooks still execute unconditionally on every render in the new order).

Previous attempts misdiagnosed this as a barrel-import / scope-hoisting issue. Those changes (direct imports, removed dead default re-exports) are kept as harmless cleanup but were not the cause.
```

## Body

Root cause of the production-only ReferenceError 'Cannot access "sH" before initialization' (chunk 35101):

- Commit a3a4ed70 (persona archive toggle) added showArchivedPersonas + archivedPersonas to the allAvailablePersonas useMemo dependency array on line 268.
- The useState declarations for those variables sat on lines 304-305, AFTER the useMemo.
- JavaScript TDZ rule: useMemo's deps array is evaluated immediately when the hook is called, so on every render the deps array tried to read const bindings that had not yet been initialized.
- Minified output confirmed: sH = archivedPersonas (useState([])), sY = showArchivedPersonas (useState(false)). The deps array [...,sY,sH] is referenced before the [sH,sK]=useState([]) declaration.

Fix: move the two useState calls above the useMemo. No behaviour change; React hook call order is preserved (this is a single component body, all hooks still execute unconditionally on every render in the new order).

Previous attempts misdiagnosed this as a barrel-import / scope-hoisting issue. Those changes (direct imports, removed dead default re-exports) are kept as harmless cleanup but were not the cause.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/components/content/SmartWalletDrawer.tsx` |

## Stats

 1 file changed, 10 insertions(+), 2 deletions(-)
