# Commit Brief: `41d1079` — fix admin-tab visibility: hook uses personaFetch (Bearer token), not raw fetch

| Field | Value |
|-------|-------|
| SHA | [`41d1079`](https://github.com/iQube-Protocol/AigentZBeta/commit/41d107988fae82afb82700340424a2d554ddcac2) |
| Author | Claude |
| Date | 2026-05-26T09:47:13Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix admin-tab visibility: hook uses personaFetch (Bearer token), not raw fetch

ROOT CAUSE of the "admin tab not showing" bug confirmed via
/api/admin/diag/cartridge-admin-grants 2026-05-26.

The diagnostic confirmed the server-side spine resolution works:
- Operator persona is uber_admin in CRM (step2_role_rows_direct.count=1)
- Spine populates cartridgeFlags.isAdmin=true (step7)
- Resolver flags isGlobalAdmin=true (step6)
- Hint: "Every cartridge admin tab should be visible to you"

But useCartridgeAdminGrants was calling /api/persona/cartridge-admin-grants
with raw `fetch()` + `credentials: 'same-origin'` — sending cookies
but NOT the Authorization: Bearer header that the spine
(getCallerIdentityContext) requires. Result: the hook ALWAYS
received 401, ALWAYS returned the empty no-grants posture, and the
admin tab filter (adminOfCartridge gate) ALWAYS denied — for global
admins included.

Switches the hook to personaFetch (from utils/personaSpine), which
auto-attaches the Supabase Bearer token before delegating to fetch.
Same auth path the rest of the spine-aware app uses.

After this deploys: global admins (uber/platform/category_uber) see
every adminOfCartridge tab; per-cartridge admins see the tabs
matching their cartridgeFlags.adminCartridges entries. No backend
changes; the spine was already correct.
```

## Body

ROOT CAUSE of the "admin tab not showing" bug confirmed via
/api/admin/diag/cartridge-admin-grants 2026-05-26.

The diagnostic confirmed the server-side spine resolution works:
- Operator persona is uber_admin in CRM (step2_role_rows_direct.count=1)
- Spine populates cartridgeFlags.isAdmin=true (step7)
- Resolver flags isGlobalAdmin=true (step6)
- Hint: "Every cartridge admin tab should be visible to you"

But useCartridgeAdminGrants was calling /api/persona/cartridge-admin-grants
with raw `fetch()` + `credentials: 'same-origin'` — sending cookies
but NOT the Authorization: Bearer header that the spine
(getCallerIdentityContext) requires. Result: the hook ALWAYS
received 401, ALWAYS returned the empty no-grants posture, and the
admin tab filter (adminOfCartridge gate) ALWAYS denied — for global
admins included.

Switches the hook to personaFetch (from utils/personaSpine), which
auto-attaches the Supabase Bearer token before delegating to fetch.
Same auth path the rest of the spine-aware app uses.

After this deploys: global admins (uber/platform/category_uber) see
every adminOfCartridge tab; per-cartridge admins see the tabs
matching their cartridgeFlags.adminCartridges entries. No backend
changes; the spine was already correct.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/hooks/useCartridgeAdminGrants.ts` |

## Stats

 1 file changed, 18 insertions(+), 5 deletions(-)
