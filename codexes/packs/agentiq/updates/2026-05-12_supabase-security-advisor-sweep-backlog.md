# Backlog — Supabase Security Advisor: 128 Errors / 190 Warnings

**Date:** 2026-05-12
**Status:** Deferred to a dedicated security session (operator instruction)
**Trigger:** Supabase Advisor surfaced 128 errors + 190 warnings + 18 suggestions on the `Aigent Z / main` project (`bsjhfvctmduxhohtllly`).
**Workstream:** Adjacent to Aigent Me; separate concern. Do **not** bundle with Aigent Me phase commits.

---

## Why this is a backlog, not a blocker

None of the flagged tables or views were introduced by Aigent Me. Both new tables in this workstream — `assistant_sessions` and `experience_qubes` — have RLS **enabled** with service-role policies and are not flagged.

The 128 errors and 190 warnings predate this workstream. Aigent Me functions correctly with them in place.

---

## What the advisor is flagging (categories)

### Category A — Security Definer Views

Views defined with the `SECURITY DEFINER` property. They run with the permissions of whoever created them (an admin), bypassing the querying user's RLS policies.

Examples visible in the dashboard:

- `public.v_week_progress_summary`
- `public.persona`
- `public.codex_kb_document_stats`
- `marketa.v_tenant_partners`
- `public.crm_personas_with_ide...` (truncated)
- `public.persona_with_fio_stat...` (truncated)
- `public.v_marketa_today`
- `public.persona_sharing_leader...` (truncated)
- `public.v_channel_summary`

These are typically operator/admin dashboards and cross-tenant analytics. Created intentionally to bypass RLS for aggregate views.

**Remediation strategies (pick per view):**

1. Convert to `SECURITY INVOKER` + add an `is_admin()` function gate inside the view definition.
2. Move the view into a private schema (e.g. `admin.*`) and revoke `public.SELECT` from the `anon` and `authenticated` roles.
3. Wrap the view body in a function that does its own `auth.role()` / `auth.uid()` check and call the function via RPC instead of a direct view.

### Category B — RLS Disabled in Public

Tables in the `public` schema with no Row Level Security. Visible in the screenshot:

- `public.access_requests`
- `public.campaign_events`
- `public.campaign_states`
- `public.canonical_bundles`
- `public.codex_episode_credits`
- `public.codex_characters`
- `public.codex_cluster_children`
- `public.codex_cluster_qubes`
- `public.codex_episodes`
- `public.codex_kb_chunks`
- `public.codex_kb_documents`
- (more — full list available via Advisor → Export)

Two sub-cases:

1. **Service-role-only tables** (CRM events, campaign state, codex KB chunks, etc.): only accessed by server code via `SUPABASE_SERVICE_ROLE_KEY`. `service_role` bypasses RLS regardless, so adding RLS is "free" — silences the advisor without changing behaviour.
2. **Tables that PostgREST clients legitimately read** (e.g. codex content tables): need a real RLS policy keyed on `auth.uid()` or a persona-linked column. This is real engineering work.

**Remediation strategies:**

- Service-role-only → `ALTER TABLE … ENABLE ROW LEVEL SECURITY;` + a single restrictive policy (`USING (auth.role() = 'service_role')`). One-line per table; ~30 min sweep for all such tables.
- PostgREST-read → real policy, requires understanding the persona/auth model for each table. ~1-2 days.

---

## Why these have accumulated

The advisor surfaces these because Supabase's posture defaults to "everything in `public` should have RLS." The codebase has a different posture: many internal tables are intentionally service-role-only, and many views are intentionally `SECURITY DEFINER` because they aggregate across tenants for operator dashboards.

The remediation is policy + view rewrites, not a wholesale architectural change.

---

## Proposed workplan (when scheduled)

| Pass | Scope | Effort | Risk |
|---|---|---|---|
| **P1 — Silence service-role-only tables** | Add RLS + `service_role` policy to each table only reached server-side. Sweep ~50-80 tables. | ~4 hours | Low — service_role bypasses, no behaviour change |
| **P2 — Audit SECURITY DEFINER views** | For each view: decide if it should stay (cross-tenant analytics) or be rewritten (`SECURITY INVOKER` + admin gate). | ~1 day | Medium — wrong choice breaks operator dashboards |
| **P3 — Real RLS on PostgREST-read tables** | Codex content tables that anon/authenticated clients legitimately read need persona-linked policies. | ~2 days | High — requires understanding each table's access pattern; mistakes leak or break content |
| **P4 — Function-level security hardening** | Functions called via RPC need explicit `SECURITY` declarations + parameter validation. | ~0.5 day | Low |
| **P5 — Re-run advisor + close ticket** | Verify count goes to 0 errors. Document any intentionally-deferred items. | ~0.5 hour | None |

Total: ~4 days for a single engineer running through all five passes.

---

## What's safe to skip

- The 18 "Info" suggestions from the advisor are noise — naming conventions, optional indexes, etc. Skip unless they appear in production query plans.
- Some warnings (~50 of 190) are "function search_path not set" — these are low-priority hardening; address only if a real security review surfaces them.

---

## How to verify Aigent Me tables are clean

```sql
-- Both should show rowsecurity = true
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('assistant_sessions', 'experience_qubes');

-- Each should have exactly two policies (read_service + write_service)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('assistant_sessions', 'experience_qubes')
ORDER BY tablename, policyname;
```

If either reports `rowsecurity = false` or fewer than two policies → flag back to this workstream; the Aigent Me migrations did not apply cleanly.

---

## Cross-references

- `docs/architecture/persona-spine-client-protocol.md` — client-side T0/T1/T2 contract Aigent Me follows.
- `types/access.ts` — T0/T1/T2 type definitions.
- `services/identity/getActivePersona.ts` — server-side persona resolver (the spine).
- `services/access/evaluateAccess.ts` — canonical access gate.

The advisor's findings do not contradict the spine — they reflect tables/views that pre-date the spine and haven't yet been brought under its policy. The security sweep is the migration path to alignment.

---

## Owner

Unassigned. Operator decision: separate session, separate workstream. This doc is the work-intake brief for whoever picks it up.
