# Commit Brief: `784c4bf` — access spine: per-persona cartridge-admin grants resolver + canary

| Field | Value |
|-------|-------|
| SHA | [`784c4bf`](https://github.com/iQube-Protocol/AigentZBeta/commit/784c4bffd4c8473394161c5c86f71dce1615033c) |
| Author | Claude |
| Date | 2026-05-26T03:36:40Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
access spine: per-persona cartridge-admin grants resolver + canary

Adds the server-side surface that answers "which cartridges is this
persona an admin of?" — the prerequisite for surfacing a foreign
cartridge's Admin tab inside the metaMe Cartridge Activation
sub-surfaces (chief-of-staff unlock for founder operators).

Does NOT yet wire any UI; that lands in a follow-up commit once this
resolver + its canary are landed and reviewed independently.

New surface
-----------
services/access/cartridgeAdminGrants.ts
  - getCartridgeAdminGrants(authProfileId, linkedAuthProfileIds[])
  - Reads crm_admin_roles via the same auth_profile_id surface
    resolveAdminFlag already uses in getActivePersona, including the
    multi-email-merged sibling profile expansion.
  - Walks roles:
      uber_admin / platform_super_admin / category_uber_admin
        → isGlobalAdmin true, caller branches on the flag
      franchise_super_admin
        → fan-out to every child tenant of the franchise via
          crm_tenants.franchise_id
      tenant_super_admin / category_admin / others with tenant_id
        → collect the single tenant
  - Returns { isGlobalAdmin: boolean, cartridgeSlugs: string[] }
    where cartridgeSlugs is the de-duplicated set of tenant slugs.
    The alpha model treats tenant.slug as cartridge.slug verbatim;
    when multi-tenant cartridges arrive (21 Sats worlds), this
    module is the single hook point to extend with an explicit
    tenant→cartridge mapping.

app/api/persona/cartridge-admin-grants/route.ts
  - GET; resolves persona via getActivePersona() — 401 when missing.
  - Calls getMergedLinkedAuthProfileIds() so admin rows granted
    against a sibling auth_profile_id resolve identically to the
    spine's own resolveAdminFlag.
  - Surfaces { isGlobalAdmin, cartridgeSlugs[] } — both T1-safe; no
    T0 ids on the wire.
  - Fail-closed on resolver error: returns empty grants rather than
    a 500 the client might paper over.

Privacy posture
---------------
This is new surface area inside services/access/. No edits to any of
the PARAMOUNT spine files (getActivePersona, evaluateAccess,
policyResolvers, etc.). Composition over forking, per CLAUDE.md.

Canary tests (tests/cartridge-admin-grants.test.ts) — all pass:
- empty authProfileId → fail-closed, no DB call
- no admin rows → empty grants
- uber/platform_super/category_uber → isGlobalAdmin true, slugs empty
- tenant_super → only that tenant's slug, no siblings, no global elevation
- franchise_super → fan-out to children, no foreign franchises
- missing Supabase client → fail-closed
```

## Body

Adds the server-side surface that answers "which cartridges is this
persona an admin of?" — the prerequisite for surfacing a foreign
cartridge's Admin tab inside the metaMe Cartridge Activation
sub-surfaces (chief-of-staff unlock for founder operators).

Does NOT yet wire any UI; that lands in a follow-up commit once this
resolver + its canary are landed and reviewed independently.

New surface
-----------
services/access/cartridgeAdminGrants.ts
  - getCartridgeAdminGrants(authProfileId, linkedAuthProfileIds[])
  - Reads crm_admin_roles via the same auth_profile_id surface
    resolveAdminFlag already uses in getActivePersona, including the
    multi-email-merged sibling profile expansion.
  - Walks roles:
      uber_admin / platform_super_admin / category_uber_admin
        → isGlobalAdmin true, caller branches on the flag
      franchise_super_admin
        → fan-out to every child tenant of the franchise via
          crm_tenants.franchise_id
      tenant_super_admin / category_admin / others with tenant_id
        → collect the single tenant
  - Returns { isGlobalAdmin: boolean, cartridgeSlugs: string[] }
    where cartridgeSlugs is the de-duplicated set of tenant slugs.
    The alpha model treats tenant.slug as cartridge.slug verbatim;
    when multi-tenant cartridges arrive (21 Sats worlds), this
    module is the single hook point to extend with an explicit
    tenant→cartridge mapping.

app/api/persona/cartridge-admin-grants/route.ts
  - GET; resolves persona via getActivePersona() — 401 when missing.
  - Calls getMergedLinkedAuthProfileIds() so admin rows granted
    against a sibling auth_profile_id resolve identically to the
    spine's own resolveAdminFlag.
  - Surfaces { isGlobalAdmin, cartridgeSlugs[] } — both T1-safe; no
    T0 ids on the wire.
  - Fail-closed on resolver error: returns empty grants rather than
    a 500 the client might paper over.

Privacy posture
---------------
This is new surface area inside services/access/. No edits to any of
the PARAMOUNT spine files (getActivePersona, evaluateAccess,
policyResolvers, etc.). Composition over forking, per CLAUDE.md.

Canary tests (tests/cartridge-admin-grants.test.ts) — all pass:
- empty authProfileId → fail-closed, no DB call
- no admin rows → empty grants
- uber/platform_super/category_uber → isGlobalAdmin true, slugs empty
- tenant_super → only that tenant's slug, no siblings, no global elevation
- franchise_super → fan-out to children, no foreign franchises
- missing Supabase client → fail-closed

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/persona/cartridge-admin-grants/route.ts` |
| Added | `services/access/cartridgeAdminGrants.ts` |
| Added | `tests/cartridge-admin-grants.test.ts` |

## Stats

 3 files changed, 412 insertions(+)
