# Backlog — RLS for Community-Generated Content tables

**Date logged:** 2026-04-29
**Status:** Backlog — to revisit before the wallet alias refactor sprint closes
**Severity:** Privacy / defence-in-depth
**Touches:** `community_generated_content`, `community_content_quotas`, `community_content_settings`

---

## Why

The phase 1 migration (`supabase/migrations/20260429000000_community_generated_content.sql`) creates three tables but does **not** attach Row Level Security policies. Today's API routes use the service-role key, so RLS is effectively bypassed for legitimate access — but that means:

- Any future direct-from-browser supabase-js call (e.g. a realtime subscription, a Studio inspector, a debug tool) would either be wide open (if RLS stays disabled) or fail with no fallback (if RLS is enabled later without policies). Both are bad outcomes.
- Defence-in-depth: a leak of the anon key currently exposes nothing on these tables because no policies grant access — but a leak of the service-role key (or a misconfigured route) currently exposes everything. RLS won't stop a service-role key, but it does stop an anon-key escalation if the routes are ever rewritten to use it.
- The plaintext-wallet refactor (`2026-04-29_plaintext-wallet-address-deprecation.md`) treats every table that touches persona-linkable data as RLS-required. The community-content tables qualify (creator_persona_id is a direct linkage).

## What to do

Add a follow-up migration (suggested name `20260430000000_community_content_rls.sql`) that:

1. Enables RLS on all three tables:
   ```sql
   ALTER TABLE community_generated_content   ENABLE ROW LEVEL SECURITY;
   ALTER TABLE community_content_quotas      ENABLE ROW LEVEL SECURITY;
   ALTER TABLE community_content_settings    ENABLE ROW LEVEL SECURITY;
   ```
2. Adds policies that match the public surface of the API:
   - **`community_generated_content` SELECT** — allow when `status IN ('shared', 'runtime_promoted')` for any role; allow when `creator_persona_id` matches the authed user's persona for self-drafts. Keep `service_role` unrestricted for the API routes.
   - **`community_generated_content` INSERT/UPDATE/DELETE** — service_role only. (User actions all flow through API routes that use the service-role client.)
   - **`community_content_quotas`** — service_role only for read + write. The quota API never returns this row directly to the browser; it returns derived values.
   - **`community_content_settings`** — public SELECT (it's tunable pricing the user already sees in the remix dialog), service_role-only WRITE.
3. Documents the policy intent inline in the migration so future changes don't drop it accidentally.

## Why we deferred

RLS on these tables is not a gating prerequisite for the launch flow — every existing read path uses the service-role key and is already gated by the API routes. Adding policies before the cartridge ships would have been speculative and CLAUDE.md flags speculative work. Logging it here so it isn't forgotten when the wallet alias sprint adds its own RLS changes (cohort tables, alias commitments) and we want them to ship together.

## Related

- `2026-04-29_plaintext-wallet-address-deprecation.md` — the parent privacy refactor; RLS for cohort/alias tables lands in steps 2-3 of that sprint
- Phase-5 admin endpoint hardening (`/api/community-content/[id]/{promote,reject}` + `/settings`) — already deployed server-side admin check via `crm_admin_roles`; RLS would be the second layer

## Done when

- Migration file added and applied to Supabase
- API routes still pass smoke tests (generate / publish / list / promote / reject / settings GET+POST)
- Public viewer at `/community-content/[id]` continues to load shared + runtime-promoted rows for unauthed visitors
- An anon-key direct query against `community_generated_content` returns only public-status rows
