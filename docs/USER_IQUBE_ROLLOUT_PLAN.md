# User iQube Rollout Plan (Dev-First)

## Objective
Make persona visibility deterministic and tenant-safe by using `user_iqubes` as the canonical access policy for signed-in users.

## What is implemented now

1. **`user_iqubes` schema (dev bootstrap model)**
   - Migration: `supabase/migrations/20260219143000_user_iqubes_dev_bootstrap.sql`
   - Stores:
     - `auth_profile_id` (canonical user linkage)
     - `emails` and `email_verified`
     - `allowed_tenant_ids`
     - `persona_grants` (persona-level access)
     - `default_persona_by_tenant`
     - `status`

2. **Dev bootstrap endpoint**
   - Route: `app/api/admin/identity/dev-user-iqubes/route.ts`
   - Builds/updates iQubes from dev email inputs and existing persona ownership/manual grants.
   - Security posture:
     - Allowed by default in non-production
     - In production requires explicit env enable + shared secret header

3. **Persona listing resolution updated**
   - Route: `app/api/wallet/personas/route.ts`
   - Resolution behavior:
     - Resolve caller auth profile ID
     - Load active `user_iqubes` row
     - Read active `persona_grants`
     - Enforce tenant scoping via `allowed_tenant_ids`
     - Merge direct-owned personas + granted personas
     - De-duplicate + return stable safe view payload

4. **Single-persona read parity added**
   - Routes:
     - `app/api/wallet/persona/[id]/route.ts` (`GET`)
     - `app/api/identity/persona/[id]/route.ts` (`GET`)
   - Behavior now:
     - Owner access works as before
     - Active iQube grants can read persona details
     - Discoverable-within-tenant remains available for public tenant context

5. **Shared iQube access helper added**
   - Module: `services/wallet/userIQubeAccess.ts`
   - Helpers:
     - `getActiveUserIQube(authProfileId)`
     - `isTenantAllowed(iqube, tenantId)`
     - `hasActivePersonaGrant(iqube, personaId, tenantId)`

6. **Bulk bootstrap/rollout support added**
   - Route: `app/api/admin/identity/dev-user-iqubes/route.ts`
   - Added scoped rollout inputs:
     - `franchiseIds[]`
     - `includeAllActiveTenants`
     - `includeAllAuthProfilesInScope`
     - `authProfileIds[]`
     - `dryRun`
   - Safety guard:
     - `includeAllAuthProfilesInScope=true` requires tenant scope (`tenantIds[]`, `franchiseIds[]`, or `includeAllActiveTenants=true`)

---

## Integration status

### Completed

1. **Single persona read access parity**
- `app/api/wallet/persona/[id]/route.ts` now supports iQube grant-based read access.

2. **Identity persona read path parity**
- `app/api/identity/persona/[id]/route.ts` now aligns with iQube grant checks.

3. **Shared authorization helper**
- Centralized helper added in `services/wallet/userIQubeAccess.ts`.

### Remaining (recommended hardening)

1. **Write operations remain owner-gated (intentional)**
- `PATCH/DELETE` on persona routes should continue requiring owner auth (`persona.auth_profile_id === callerAuthProfileId`) unless explicit delegated-write policy is introduced.

2. **Operational observability**
- Add explicit audit log entries for bootstrap and rollout invocations.

---

## Rollout risk controls

### Access control controls
1. **Tenant guard first**
   - If `tenantId` requested and not in `allowed_tenant_ids`, return empty/404 equivalent for reads.
2. **Grant active flag enforcement**
   - Only grants with `active !== false` should authorize reads.
3. **Fail-safe fallback**
   - If no iQube row exists, owner-linked personas still resolve (prevents lockout while migrating).

### Operational controls
1. **Bootstrap endpoint hardening**
   - Keep production disabled unless:
     - `ENABLE_DEV_IQUBE_BOOTSTRAP=true`
     - `x-dev-bootstrap-secret` matches `DEV_IQUBE_BOOTSTRAP_SECRET`
2. **Auditability**
   - Log bootstrap invocation metadata (requestor, auth profile, count of grants changed).
3. **Least privilege**
   - Keep service-role usage confined to server routes only.

### Data quality controls
1. Normalize email inputs to lowercase before matching.
2. De-duplicate persona grants by persona ID.
3. Ensure tenant IDs are derived from granted personas + explicit allow-list only.

---

## Validation checklist

### A) Schema and bootstrap
- [ ] Apply migration and verify `user_iqubes` exists.
- [ ] POST dev bootstrap with known test email(s).
- [ ] Confirm row upserted with expected `allowed_tenant_ids` and `persona_grants`.

### B) Persona visibility
- [ ] `GET /api/wallet/personas` returns owned personas when no iQube exists.
- [ ] `GET /api/wallet/personas` returns union of owned + granted personas when iQube exists.
- [ ] `GET /api/wallet/personas?tenantId=<allowed>` returns tenant-scoped set.
- [ ] `GET /api/wallet/personas?tenantId=<not-allowed>` returns empty list.

### C) Negative/edge cases
- [ ] Inactive grants (`active=false`) are excluded.
- [ ] Duplicate grants do not duplicate response records.
- [ ] Unknown granted persona IDs are ignored safely.

### D) Production safety checks
- [ ] Verify bootstrap route returns `403` in production without explicit enable + secret.
- [ ] Confirm no client-side code calls admin bootstrap route.

### E) Multi-tenant/franchise rollout checks
- [ ] `dryRun=true` on full scope returns expected `targetedAuthProfileCount` before writes.
- [ ] Scoped rollout by `franchiseIds[]` only touches personas in those franchise tenants.
- [ ] `includeAllAuthProfilesInScope=true` is rejected without tenant scope.
- [ ] Live run reports `processed === targetedAuthProfileCount` (or expected error rows reviewed).

---

## Controlled rollout commands

Endpoint: `POST /api/admin/identity/dev-user-iqubes`

1. **Dry run for all active tenants we control**

```bash
curl -X POST "http://localhost:3000/api/admin/identity/dev-user-iqubes" \
  -H "Content-Type: application/json" \
  -d '{
    "includeAllActiveTenants": true,
    "includeAllAuthProfilesInScope": true,
    "dryRun": true,
    "emailVerified": true
  }'
```

2. **Dry run for specific franchises only**

```bash
curl -X POST "http://localhost:3000/api/admin/identity/dev-user-iqubes" \
  -H "Content-Type: application/json" \
  -d '{
    "franchiseIds": ["<franchise-id-1>", "<franchise-id-2>"],
    "includeAllAuthProfilesInScope": true,
    "dryRun": true,
    "emailVerified": true
  }'
```

3. **Execute live rollout after dry-run validation**

```bash
curl -X POST "http://localhost:3000/api/admin/identity/dev-user-iqubes" \
  -H "Content-Type: application/json" \
  -d '{
    "includeAllActiveTenants": true,
    "includeAllAuthProfilesInScope": true,
    "dryRun": false,
    "emailVerified": true
  }'
```

4. **Production-protected invocation (if explicitly enabled)**

```bash
curl -X POST "https://<your-domain>/api/admin/identity/dev-user-iqubes" \
  -H "Content-Type: application/json" \
  -H "x-dev-bootstrap-secret: <DEV_IQUBE_BOOTSTRAP_SECRET>" \
  -d '{
    "includeAllActiveTenants": true,
    "includeAllAuthProfilesInScope": true,
    "dryRun": true
  }'
```

---

## Suggested phased rollout

1. **Phase 0 (now):** list endpoint switched to iQube grants + owner fallback.
2. **Phase 1 (done):** iQube-aware checks added to single-persona read endpoints.
3. **Phase 2 (done):** shared helper/service added for iQube access checks.
4. **Phase 3:** optionally remove owner-only fallback after complete iQube backfill and monitoring confidence.
