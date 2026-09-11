# Backlog — request-scoped enforcement behind the four service-role CRM routes

**Date logged:** 2026-07-28
**Status:** Backlog — separately chartered increment, not started
**Severity:** Defence-in-depth (not a live exposure — see "Current state" below)
**Touches:** `app/api/crm/investors/route.ts`, `app/api/crm/investors/[id]/route.ts`, `app/api/crm/investors/bulk/route.ts`, `app/api/mvl/partners/route.ts`, `services/crm/crmDataAccess.ts::getCrmClient()`

---

## Correction to the record (Aletheon review, 2026-07-28)

The RLS migration `supabase/migrations/20260901000000_crm_investors_partners_rls_defense_in_depth.sql`
added admin-gated Row Level Security policies to `nakamoto_knyt_personas` and
tightened `avl_partner_contacts`. Read precisely:

> **The new RLS policies protect direct authenticated access and non-service-role
> clients only. They do NOT provide database-level defence behind the four
> service-role-client routes above** — `getCrmClient()` connects with the
> Supabase **service-role** key, and **service-role bypasses RLS
> unconditionally**, regardless of what policy is attached to the table. Every
> `USING`/`WITH CHECK` clause in that migration includes an explicit
> `auth.role() = 'service_role' OR ...` branch precisely because Postgres would
> otherwise force service-role callers through the same policy evaluation as
> everyone else — the migration's author chose to make that bypass explicit in
> SQL rather than rely on the implicit RLS-bypass Postgres already grants the
> service-role connection.

If any earlier framing of this migration read as though the RLS policies
close the gap **behind** the four routes while they still use a service-role
client, that framing overclaimed. The correct framing, going forward: RLS is
defence-in-depth against a **future code change** that swaps the client for a
non-service-role one (accidentally, or via a copy-pasted pattern from a
different route) — it protects nothing today that the route-level
`requireAdminPersona` gate wasn't already the sole enforcement for. The route
gate remains load-bearing and MUST NOT be removed or weakened on the theory
that "RLS covers it now" — it does not.

## Current state (why this isn't an open live exposure)

All four routes call `requireAdminPersona(request)` at the top of every
handler (fixed same-day, commit `7309f93ae`, extended to the aggregate route
in `b95be3388`). That application-layer gate is what authorizes the
cross-tenant admin view today. The RLS migration is additive safety net, not
a redundant-but-harmless enforcement layer — it currently enforces nothing
behind these four specific routes because they never reach it as anything
other than `service_role`.

## What to do (separately chartered — do not build speculatively)

Pick ONE of the two approaches below for the four routes' read (and, for
`/api/mvl/partners`, write) paths. Both give the database an actual floor
under these routes, closing the gap this note documents. This work has its
own testing and rollout surface and should not be bundled into a security-doc
correction commit.

### Option A — request-scoped Supabase client

Replace `getCrmClient()` (service-role) with a client constructed per-request
from the caller's own JWT (the same Bearer token `requireAdminPersona`
already validates), so Postgres evaluates the RLS policies as the actual
caller's `auth.uid()` / `auth.role()` — not as `service_role`. Requires:

- A `getCrmClientForRequest(request: NextRequest)` helper that extracts the
  Bearer token and constructs a `createClient(url, anonKey, { global: {
  headers: { Authorization: `Bearer ${token}` } } })` client — the anon key
  plus the caller's JWT, not the service-role key.
- Verifying every query path in the four routes (including the pagination
  loop in `GET /api/crm/investors` and `GET /api/crm/investors/aggregate`,
  and the bulk-write path in `POST /api/crm/investors/bulk`) still returns
  the full table for an admin caller under the new RLS policies — i.e. that
  `check_admin_access(auth.uid()::text, ...)` genuinely resolves TRUE for the
  operator's JWT-derived `auth.uid()` and not just for the service-role
  bypass path it's fallen back on until now.
- A rollback plan: if the request-scoped client returns fewer rows than the
  service-role client did for a legitimate admin (e.g. because the admin's
  `crm_admin_roles` row is keyed by `kybe_did = email` rather than
  `kybe_did = auth.uid()::text` — see the two-path provisioning comment in
  `20260405000000_grant_dele_uber_admin.sql`), that's a silent data-loss
  regression on the CRM dashboard, not a crash — needs a canary that asserts
  row-count parity between service-role and request-scoped reads for a known
  admin identity before this ships.

### Option B — constrained RPC / stored procedure

Add a `SECURITY DEFINER` Postgres function (mirroring `check_admin_access`'s
own pattern) that:
1. Takes the caller's `auth.uid()` implicitly (via `auth.uid()` inside the
   function body, not as a client-supplied argument — a client-supplied
   identity argument can be spoofed).
2. Re-checks `check_admin_access(auth.uid()::text, 'read', NULL, NULL, NULL)`
   server-side inside the function, independent of which Postgres role
   invoked it.
3. Returns only the aggregate/row shape the route needs, executed via
   `client.rpc('crm_investors_admin_read', {...})` instead of
   `client.from('nakamoto_knyt_personas').select(...)`.

This keeps the connecting client role irrelevant (RPC can run under
`service_role` OR a request-scoped client) because the admin check happens
**inside the function**, not via table-level RLS — closing the gap without
requiring the client-plumbing change Option A needs. Trade-off: every new
query shape needs its own RPC function (less flexible than ad-hoc
`.select()` chains); Option A is more general-purpose.

## Recommendation (non-binding — pick at implementation time)

Option B is lower-risk to ship (no client-swap regression surface, no
row-count-parity canary needed) but constrains future query flexibility on
these tables. Option A is more general but carries the regression risk
documented above. Either is acceptable; this note exists so a future session
can pick one up without re-deriving the analysis, not to pre-decide it.

## Done when

- One of the two options above is implemented for all four routes' read
  paths (and the `bulk` route's write path).
- A canary proves an admin caller sees the same data via the new path as via
  today's service-role path (row-count parity, or exact-set parity for small
  fixtures).
- A canary proves an ordinary authenticated (non-admin) caller and an
  anonymous caller get denied by the **database**, not just the route gate
  — i.e. temporarily bypass `requireAdminPersona` in a test harness and
  confirm the query itself still returns nothing for those identities.
- This backlog doc is updated to `Status: Closed` with the implementing
  commit referenced, or archived once no longer relevant.

## Related

- `supabase/migrations/20260901000000_crm_investors_partners_rls_defense_in_depth.sql`
  — the RLS migration this backlog item follows up on.
- `scripts/rls-integration-canary-check-admin-access.sh` — real local-Postgres
  integration canary proving `check_admin_access()` + the new RLS policies
  behave correctly for admin/ordinary/anonymous identities (verifies the
  policy layer this backlog item would finally put behind these routes).
- `tests/crm-investors-partners-rls.test.ts` — static consistency check over
  the migration SQL (not a substitute for the above).
