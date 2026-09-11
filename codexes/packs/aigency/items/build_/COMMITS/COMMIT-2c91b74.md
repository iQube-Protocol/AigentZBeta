# Commit Brief: `2c91b74` — spine extension: per-cartridge admin grants → cartridgeFlags.adminCartridges

| Field | Value |
|-------|-------|
| SHA | [`2c91b74`](https://github.com/iQube-Protocol/AigentZBeta/commit/2c91b74f11ac0688e59bd13f1a99389214607365) |
| Author | Claude |
| Date | 2026-05-26T04:34:23Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
spine extension: per-cartridge admin grants → cartridgeFlags.adminCartridges

Bring the admin authorization path into line with the canonical
Identity & Access Spine + ContentQube protocols. Replaces the prior
bolted-on resolver pattern (separate route, separate UI hook, parallel
CRM query) with a first-class field on ActivePersonaContext /
ActivePersonaSurface — so the spine is the single source of truth for
"can this persona admin cartridge X?" and downstream gates flow
through credentialMatchesCartridgeFlag + evaluateAccess.

Operator approval recorded
--------------------------
Per CLAUDE.md "Identity & Access Spine — CANONICAL SoT", the four
PARAMOUNT spine files must not be modified without explicit operator
approval. Approval recorded in this session 2026-05-26:

  > "1. Yes [green light to modify the four PARAMOUNT spine files] and
  > make note why and how you did. 2. Array. 3. Yes agreed [ship
  > layers 1+2 now, defer layer 3 ContentQube to fast-follow]."

Full why/how trail: codexes/packs/agentiq/updates/2026-05-26_spine-admin-grants-extension.md.

PARAMOUNT file edits
--------------------
types/access.ts
- ActivePersonaContext.cartridgeFlags.adminCartridges: string[] (T0)
- ActivePersonaSurface.cartridgeFlags.adminCartridges: string[] (T1)
Both T1-safe — slug strings only, never tenant/franchise/auth-profile
ids. Document why the field exists + how it was introduced inline.

services/identity/getActivePersona.ts
- Promise.all gains a third leg calling getCartridgeAdminGrants()
- cartridgeFlags.isAdmin becomes (legacy resolveAdminFlag || admin
  grants resolver's isGlobalAdmin) — either path counts as global
- cartridgeFlags.adminCartridges populated from grants.cartridgeSlugs
- New import for getCartridgeAdminGrants

services/access/policyResolvers.ts
- credentialMatchesCartridgeFlag accepts optional adminCartridges in
  its flags arg (backwards compatible — legacy callers still work)
- New credential class: 'admin-cartridge:<slug>'
  - Global isAdmin → satisfies any admin-cartridge:<slug>
  - Otherwise the slug must appear in adminCartridges
  - Malformed input (missing slug, missing colon) → false (fail-closed)

services/access/evaluateAccess.ts
- No edit. Already passes context.cartridgeFlags wholesale to the
  resolver, so the type widening flows through transparently. This
  was the fourth PARAMOUNT file approved for modification but turned
  out not to need any.

Non-PARAMOUNT consumers updated
-------------------------------
- /api/wallet/active-persona — spreads cartridgeFlags wholesale, new
  field auto-flows
- /api/assistant/bootstrap — inline shape widened to mirror the spine
- app/contexts/PersonaContext.tsx — BroadcastSurface type widened
- /api/persona/cartridge-admin-grants — REWRITTEN as a thin
  pass-through over getActivePersona(). No longer re-queries CRM.
  Marked deprecated in JSDoc + carries a _deprecated hint field
  pointing callers at /api/wallet/active-persona.cartridgeFlags.
  Existing clients keep working unchanged — surface is identical.

Canary tests
------------
NEW: tests/spine-admin-cartridges.test.ts — 10 tests locking:
- T1 surface serialisation has no T0 ids (tenant/franchise/auth-profile/
  kybe_did/rootDid/did:fio:)
- T0 context's adminCartridges holds strings only (no UUIDs)
- credentialMatchesCartridgeFlag semantics:
  * admin-cartridge:<slug> matches against the array
  * global isAdmin satisfies any admin-cartridge:<slug>
  * tenant-admin grants do NOT promote to global isAdmin
  * partner credential unaffected by adminCartridges
  * malformed credentials → false
  * legacy callers without adminCartridges still work
- Spine resolver result never leaks internal ids

31/31 admin-related canaries pass (spine-admin-cartridges 10/10 +
cartridge-admin-grants 10/10 + persona-broadcast 11/11). The single
failure in access-spine.test.ts (debugBypass hardcoded ON) is
pre-existing and unrelated.

Layer 3 (ContentQube admin descriptors) deferred per operator
decision — backlog tracked in the new update doc + the existing
2026-05-26_admin-tab-in-activation-backlog.md.
```

## Body

Bring the admin authorization path into line with the canonical
Identity & Access Spine + ContentQube protocols. Replaces the prior
bolted-on resolver pattern (separate route, separate UI hook, parallel
CRM query) with a first-class field on ActivePersonaContext /
ActivePersonaSurface — so the spine is the single source of truth for
"can this persona admin cartridge X?" and downstream gates flow
through credentialMatchesCartridgeFlag + evaluateAccess.

Operator approval recorded
--------------------------
Per CLAUDE.md "Identity & Access Spine — CANONICAL SoT", the four
PARAMOUNT spine files must not be modified without explicit operator
approval. Approval recorded in this session 2026-05-26:

  > "1. Yes [green light to modify the four PARAMOUNT spine files] and
  > make note why and how you did. 2. Array. 3. Yes agreed [ship
  > layers 1+2 now, defer layer 3 ContentQube to fast-follow]."

Full why/how trail: codexes/packs/agentiq/updates/2026-05-26_spine-admin-grants-extension.md.

PARAMOUNT file edits
--------------------
types/access.ts
- ActivePersonaContext.cartridgeFlags.adminCartridges: string[] (T0)
- ActivePersonaSurface.cartridgeFlags.adminCartridges: string[] (T1)
Both T1-safe — slug strings only, never tenant/franchise/auth-profile
ids. Document why the field exists + how it was introduced inline.

services/identity/getActivePersona.ts
- Promise.all gains a third leg calling getCartridgeAdminGrants()
- cartridgeFlags.isAdmin becomes (legacy resolveAdminFlag || admin
  grants resolver's isGlobalAdmin) — either path counts as global
- cartridgeFlags.adminCartridges populated from grants.cartridgeSlugs
- New import for getCartridgeAdminGrants

services/access/policyResolvers.ts
- credentialMatchesCartridgeFlag accepts optional adminCartridges in
  its flags arg (backwards compatible — legacy callers still work)
- New credential class: 'admin-cartridge:<slug>'
  - Global isAdmin → satisfies any admin-cartridge:<slug>
  - Otherwise the slug must appear in adminCartridges
  - Malformed input (missing slug, missing colon) → false (fail-closed)

services/access/evaluateAccess.ts
- No edit. Already passes context.cartridgeFlags wholesale to the
  resolver, so the type widening flows through transparently. This
  was the fourth PARAMOUNT file approved for modification but turned
  out not to need any.

Non-PARAMOUNT consumers updated
-------------------------------
- /api/wallet/active-persona — spreads cartridgeFlags wholesale, new
  field auto-flows
- /api/assistant/bootstrap — inline shape widened to mirror the spine
- app/contexts/PersonaContext.tsx — BroadcastSurface type widened
- /api/persona/cartridge-admin-grants — REWRITTEN as a thin
  pass-through over getActivePersona(). No longer re-queries CRM.
  Marked deprecated in JSDoc + carries a _deprecated hint field
  pointing callers at /api/wallet/active-persona.cartridgeFlags.
  Existing clients keep working unchanged — surface is identical.

Canary tests
------------
NEW: tests/spine-admin-cartridges.test.ts — 10 tests locking:
- T1 surface serialisation has no T0 ids (tenant/franchise/auth-profile/
  kybe_did/rootDid/did:fio:)
- T0 context's adminCartridges holds strings only (no UUIDs)
- credentialMatchesCartridgeFlag semantics:
  * admin-cartridge:<slug> matches against the array
  * global isAdmin satisfies any admin-cartridge:<slug>
  * tenant-admin grants do NOT promote to global isAdmin
  * partner credential unaffected by adminCartridges
  * malformed credentials → false
  * legacy callers without adminCartridges still work
- Spine resolver result never leaks internal ids

31/31 admin-related canaries pass (spine-admin-cartridges 10/10 +
cartridge-admin-grants 10/10 + persona-broadcast 11/11). The single
failure in access-spine.test.ts (debugBypass hardcoded ON) is
pre-existing and unrelated.

Layer 3 (ContentQube admin descriptors) deferred per operator
decision — backlog tracked in the new update doc + the existing
2026-05-26_admin-tab-in-activation-backlog.md.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/bootstrap/route.ts` |
| Modified | `app/api/persona/cartridge-admin-grants/route.ts` |
| Modified | `app/contexts/PersonaContext.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-26_spine-admin-grants-extension.md` |
| Modified | `services/access/policyResolvers.ts` |
| Modified | `services/identity/getActivePersona.ts` |
| Added | `tests/spine-admin-cartridges.test.ts` |
| Modified | `types/access.ts` |

## Stats

 9 files changed, 418 insertions(+), 55 deletions(-)
