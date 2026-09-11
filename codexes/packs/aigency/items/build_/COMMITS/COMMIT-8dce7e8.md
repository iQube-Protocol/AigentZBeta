# Commit Brief: `8dce7e8` — fix admin-tab visibility: email-alias fallback in grants resolver + diag route

| Field | Value |
|-------|-------|
| SHA | [`8dce7e8`](https://github.com/iQube-Protocol/AigentZBeta/commit/8dce7e897b3d9476640bca271e9ab1b3fe43742b) |
| Author | Claude |
| Date | 2026-05-26T08:19:10Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix admin-tab visibility: email-alias fallback in grants resolver + diag route

Two changes for the "admin tab still not showing" report 2026-05-26
after the spine extension landed.

Root cause: resolver missed admin grants on email-aliased siblings
-----------------------------------------------------------------
The prior getCartridgeAdminGrants() resolver queried crm_admin_roles
by auth_profile_id only, including any ids from the merge view
(getMergedLinkedAuthProfileIds). But the spine's own resolveAdminFlag
ALSO falls back to the crm_auth_profile_emails alias table — covering
the case where an admin role is granted against a sibling profile id
that the merge view hasn't linked yet (admin grants pre-dating the
profile merge, or auth_profiles seeded out-of-band).

Without the email-alias fallback in getCartridgeAdminGrants, the
spine had a split-brain: resolveAdminFlag would find the global
admin via email, but the per-cartridge resolver returned empty —
admin tab stayed hidden for any tenant-admin whose role lived on a
non-merged sibling. Root cause of the operator's report.

Resolver fix
------------
services/access/cartridgeAdminGrants.ts
- Optional third arg `callerEmail: string | null` added to
  getCartridgeAdminGrants(). When present, the resolver queries
  crm_auth_profile_emails for matching auth_profile_ids and adds them
  to the candidate set BEFORE the crm_admin_roles query.
- Best-effort: if the alias lookup throws, the resolver continues
  with whatever ids it already has — no exception escapes.

services/identity/getActivePersona.ts
- Passes caller.email through to getCartridgeAdminGrants(), so the
  spine pass uses the same email-alias fallback resolveAdminFlag does.
  cartridgeFlags.adminCartridges is now populated symmetrically with
  cartridgeFlags.isAdmin for the email-aliased case.

Canary additions
----------------
tests/cartridge-admin-grants.test.ts:
- Discovers admin grant via email-alias fallback when the canonical
  auth_profile_id has no role row (replays the operator's bug as a
  passing test going forward).
- Email-alias lookup that throws is best-effort — no exception
  escapes; resolver returns empty grants safely.

12/12 cartridge-admin-grants canaries pass. 10/10 spine-admin-cartridges
canaries pass. 11/11 persona-broadcast-handshake canaries pass.

Diagnostic route
----------------
NEW: /api/admin/diag/cartridge-admin-grants
- Admin-only diagnostic that dumps every layer of the resolution
  chain so the operator (or any subsequent agent) can see exactly
  where it fails:
    step 1: linkage (linked + email-alias auth_profile_ids)
    step 2: raw crm_admin_roles rows for canonical + linked ids
    step 3: roles found ONLY via email-alias (the leg the prior
            resolver missed)
    step 4: tenant + franchise rows referenced by the role rows
    step 5: franchise fan-out preview
    step 6: resolver's final output
    step 7: spine cartridgeFlags as exposed by getActivePersona
  Plus a one-line hint summarising the most likely cause given the
  data dumped. Mirrors the pattern of /api/admin/diag/persona-resolution
  built for the same class of "the resolver isn't returning what I
  expect" problem.
```

## Body

Two changes for the "admin tab still not showing" report 2026-05-26
after the spine extension landed.

Root cause: resolver missed admin grants on email-aliased siblings
-----------------------------------------------------------------
The prior getCartridgeAdminGrants() resolver queried crm_admin_roles
by auth_profile_id only, including any ids from the merge view
(getMergedLinkedAuthProfileIds). But the spine's own resolveAdminFlag
ALSO falls back to the crm_auth_profile_emails alias table — covering
the case where an admin role is granted against a sibling profile id
that the merge view hasn't linked yet (admin grants pre-dating the
profile merge, or auth_profiles seeded out-of-band).

Without the email-alias fallback in getCartridgeAdminGrants, the
spine had a split-brain: resolveAdminFlag would find the global
admin via email, but the per-cartridge resolver returned empty —
admin tab stayed hidden for any tenant-admin whose role lived on a
non-merged sibling. Root cause of the operator's report.

Resolver fix
------------
services/access/cartridgeAdminGrants.ts
- Optional third arg `callerEmail: string | null` added to
  getCartridgeAdminGrants(). When present, the resolver queries
  crm_auth_profile_emails for matching auth_profile_ids and adds them
  to the candidate set BEFORE the crm_admin_roles query.
- Best-effort: if the alias lookup throws, the resolver continues
  with whatever ids it already has — no exception escapes.

services/identity/getActivePersona.ts
- Passes caller.email through to getCartridgeAdminGrants(), so the
  spine pass uses the same email-alias fallback resolveAdminFlag does.
  cartridgeFlags.adminCartridges is now populated symmetrically with
  cartridgeFlags.isAdmin for the email-aliased case.

Canary additions
----------------
tests/cartridge-admin-grants.test.ts:
- Discovers admin grant via email-alias fallback when the canonical
  auth_profile_id has no role row (replays the operator's bug as a
  passing test going forward).
- Email-alias lookup that throws is best-effort — no exception
  escapes; resolver returns empty grants safely.

12/12 cartridge-admin-grants canaries pass. 10/10 spine-admin-cartridges
canaries pass. 11/11 persona-broadcast-handshake canaries pass.

Diagnostic route
----------------
NEW: /api/admin/diag/cartridge-admin-grants
- Admin-only diagnostic that dumps every layer of the resolution
  chain so the operator (or any subsequent agent) can see exactly
  where it fails:
    step 1: linkage (linked + email-alias auth_profile_ids)
    step 2: raw crm_admin_roles rows for canonical + linked ids
    step 3: roles found ONLY via email-alias (the leg the prior
            resolver missed)
    step 4: tenant + franchise rows referenced by the role rows
    step 5: franchise fan-out preview
    step 6: resolver's final output
    step 7: spine cartridgeFlags as exposed by getActivePersona
  Plus a one-line hint summarising the most likely cause given the
  data dumped. Mirrors the pattern of /api/admin/diag/persona-resolution
  built for the same class of "the resolver isn't returning what I
  expect" problem.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/admin/diag/cartridge-admin-grants/route.ts` |
| Modified | `services/access/cartridgeAdminGrants.ts` |
| Modified | `services/identity/getActivePersona.ts` |
| Modified | `tests/cartridge-admin-grants.test.ts` |

## Stats

 4 files changed, 352 insertions(+), 6 deletions(-)
