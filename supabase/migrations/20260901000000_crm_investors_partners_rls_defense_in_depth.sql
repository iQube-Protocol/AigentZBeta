-- ============================================================================
-- RLS defence-in-depth for the 2026-07-28 CRM PII incident tables
-- ============================================================================
--
-- BACKGROUND. GET/POST /api/crm/investors, PATCH /api/crm/investors/[id],
-- POST /api/crm/investors/bulk, and GET/POST/PATCH/DELETE /api/mvl/partners
-- served/mutated ~7,000 investors' PII (email, name, investment band,
-- KNYT-ID, shares, profession, city) plus partner contacts, with ZERO
-- application-layer authorization, via a SERVICE-ROLE Supabase client that
-- bypasses RLS entirely. The route-level fix (same day, commit 7309f93ae)
-- added requireAdminPersona to every handler. That closed the hole for
-- TODAY's code path.
--
-- Operator ruling (2026-07-28): "Route gate = authenticate and authorize the
-- request. RLS = constrain what the resulting database operation can
-- access. A service-role client bypasses RLS, so routes should avoid
-- service-role access for ordinary scoped reads and mutations wherever
-- possible. Where service role is unavoidable, explicit server-side scope
-- enforcement remains mandatory." And: "Yes, add RLS as defence in depth."
--
-- WHAT THIS MIGRATION DOES. Both tables below are queried by the incident
-- routes through a SERVICE-ROLE client today, by design — the admin CRM
-- dashboard is a legitimate cross-tenant, cross-person view that ordinary
-- row ownership can't express, and the route-level requireAdminPersona gate
-- is what authorizes that view. Service-role bypasses RLS regardless of
-- what policy is on the table, so these policies do NOT change today's
-- authorized behaviour. They exist for the FAILURE MODE the operator named:
-- a future code change that swaps the service-role client for an
-- anon/authenticated-role client (accidentally or via a copy-pasted
-- pattern from a different, non-admin route) without anyone noticing the
-- table had no floor under it. With these policies in place, that mistake
-- degrades to "the swapped client sees nothing" instead of "the swapped
-- client sees all ~7,000 investors."
--
-- Both policies gate on check_admin_access() — the same admin-role function
-- crm_admin_roles' own RLS policy uses (see admin_roles_access in
-- 20251128181400_agentiq_admin_roles.sql) — rather than inventing a new
-- authority check. Neither table has a natural per-row owner (these are
-- admin-managed CRM/partner records, not records a single end user owns),
-- so "restrict to what the caller's role should see" means "admin-only",
-- matching the application-layer gate exactly.
--
-- Idempotent via DROP POLICY IF EXISTS + CREATE POLICY, matching the
-- pattern already used in this repo (see e.g.
-- 20260427000000_root_did_persona_binding.sql). Postgres's CREATE POLICY
-- statement has no "IF NOT EXISTS" variant, unlike CREATE TABLE/INDEX.
--
-- SCOPE OF PROTECTION — READ THIS BEFORE CITING THIS MIGRATION AS "closing"
-- ANYTHING (Aletheon review correction, 2026-07-28). The policies below
-- protect DIRECT AUTHENTICATED ACCESS AND NON-SERVICE-ROLE CLIENTS ONLY.
-- They provide ZERO database-level defence behind the four routes named
-- above TODAY, because those four routes all read through getCrmClient()
-- (services/crm/crmDataAccess.ts), which connects with the Supabase
-- SERVICE-ROLE key — and service-role bypasses RLS unconditionally,
-- regardless of what policy is attached to the table. Do not describe this
-- migration, in a commit message, doc, or code comment, as having closed
-- the gap "behind" those four routes — it has not. The route-level
-- requireAdminPersona gate remains the ONLY enforcement behind those four
-- routes and MUST NOT be removed or weakened on the theory that "RLS covers
-- it now". The real fix — a request-scoped Supabase client or a constrained
-- admin-checking RPC for those four routes' read/write paths — is recorded
-- as a separately chartered backlog item, not built here:
-- codexes/packs/agentiq/updates/2026-07-28_crm-investors-service-role-rls-gap-backlog.md
-- ============================================================================

-- ── nakamoto_knyt_personas — previously had NO RLS policy at all ──────────────

ALTER TABLE public."nakamoto_knyt_personas" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nakamoto_knyt_personas_admin_read" ON public."nakamoto_knyt_personas";
CREATE POLICY "nakamoto_knyt_personas_admin_read"
  ON public."nakamoto_knyt_personas" FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR check_admin_access(auth.uid()::text, 'read', NULL, NULL, NULL)
  );

DROP POLICY IF EXISTS "nakamoto_knyt_personas_admin_write" ON public."nakamoto_knyt_personas";
CREATE POLICY "nakamoto_knyt_personas_admin_write"
  ON public."nakamoto_knyt_personas" FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR check_admin_access(auth.uid()::text, 'write', NULL, NULL, NULL)
  );

DROP POLICY IF EXISTS "nakamoto_knyt_personas_admin_update" ON public."nakamoto_knyt_personas";
CREATE POLICY "nakamoto_knyt_personas_admin_update"
  ON public."nakamoto_knyt_personas" FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR check_admin_access(auth.uid()::text, 'write', NULL, NULL, NULL)
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR check_admin_access(auth.uid()::text, 'write', NULL, NULL, NULL)
  );

DROP POLICY IF EXISTS "nakamoto_knyt_personas_admin_delete" ON public."nakamoto_knyt_personas";
CREATE POLICY "nakamoto_knyt_personas_admin_delete"
  ON public."nakamoto_knyt_personas" FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR check_admin_access(auth.uid()::text, 'delete', NULL, NULL, NULL)
  );

COMMENT ON POLICY "nakamoto_knyt_personas_admin_read" ON public."nakamoto_knyt_personas" IS
  'Defence-in-depth added 2026-07-28 after the unauthenticated-access incident. '
  'This table previously had RLS disabled entirely. Service-role (today''s '
  'authorized path, gated at the route layer by requireAdminPersona) bypasses '
  'this regardless; the policy exists to fail closed if a client ever swaps to '
  'anon/authenticated role.';

-- ── avl_partner_contacts — previously "any authenticated user" ────────────────
-- The original 20260417000002_avl_partner_contacts.sql policy was
-- `auth.role() = 'authenticated'` for SELECT: any signed-in user, not just
-- admins, could read partner contact emails if a client ever queried this
-- table directly instead of through the admin-gated /api/mvl/partners route.
-- Tightened to admin-only, matching the route-level gate.

DROP POLICY IF EXISTS "avl_partners_read_authenticated" ON public.avl_partner_contacts;
DROP POLICY IF EXISTS "avl_partners_admin_read" ON public.avl_partner_contacts;
CREATE POLICY "avl_partners_admin_read"
  ON public.avl_partner_contacts FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR check_admin_access(auth.uid()::text, 'read', NULL, NULL, NULL)
  );

-- "avl_partners_write_service" (service_role FOR ALL) already exists from the
-- original migration and is left in place — INSERT/UPDATE/DELETE were never
-- opened to plain 'authenticated', only SELECT was. Re-asserted here
-- idempotently so this migration is a complete, self-contained statement of
-- the table's intended policy set.
DROP POLICY IF EXISTS "avl_partners_write_service" ON public.avl_partner_contacts;
CREATE POLICY "avl_partners_write_service"
  ON public.avl_partner_contacts FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON POLICY "avl_partners_admin_read" ON public.avl_partner_contacts IS
  'Tightened 2026-07-28 from auth.role() = ''authenticated'' (any signed-in '
  'user) to admin-only, matching the requireAdminPersona gate on '
  'GET /api/mvl/partners. Defence-in-depth against a client ever querying '
  'this table with a non-service-role client.';

-- ============================================================================
-- Service-role scoping assessment (operator ruling: "routes should avoid
-- service-role access for ordinary scoped reads and mutations wherever
-- possible")
-- ============================================================================
--
-- The four routes fixed in the 2026-07-28 incident intentionally keep using
-- a service-role client and are NOT switched to a non-service-role client by
-- this migration:
--
--   GET/POST /api/crm/investors, PATCH /api/crm/investors/[id],
--   POST /api/crm/investors/bulk, GET/POST/PATCH/DELETE /api/mvl/partners
--
-- All four are legitimate cross-tenant, cross-person ADMIN views: an admin
-- browsing the full investor directory or the full partner list is not
-- "this row belongs to the caller" in any sense RLS ownership can express —
-- there is no single auth.uid() an investor row or partner contact row
-- belongs to. The routes' authorization already comes from
-- requireAdminPersona (spine-resolved: getActivePersona ->
-- cartridgeFlags.isAdmin) at the application layer; that is the correct
-- place for "is this caller allowed to see the whole table" to live, and
-- switching these specific routes to an authenticated-role client would only
-- work if RLS also encoded "is admin" — which the policies above now do, so
-- a future switch is possible without a regression, but is not made here
-- because it is a separate, larger change (each route would need a
-- request-scoped Supabase client carrying the caller's JWT instead of the
-- shared service-role client from getCrmClient()) that is out of scope for
-- this RLS-only migration. Flagging for a follow-up rather than bundling an
-- untested client-plumbing change into a security migration.
--
-- This follow-up is now tracked as a separately chartered backlog item, not
-- a vague "flag for later": see
-- codexes/packs/agentiq/updates/2026-07-28_crm-investors-service-role-rls-gap-backlog.md
-- for the two candidate fixes (request-scoped client vs. a constrained
-- admin-checking RPC), the regression risk each carries, and the "done when"
-- checklist for whoever picks this up. Until that lands, restate plainly:
-- the policies in this migration enforce NOTHING behind these four routes
-- today — they are defence-in-depth against a future client-swap bug, not
-- database-level enforcement of the routes' current admin-only behaviour.
-- ============================================================================
