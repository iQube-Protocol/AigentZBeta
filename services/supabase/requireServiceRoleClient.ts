/**
 * requireServiceRoleClient — Turn F (2026-09-02), operator directive:
 * "/api/moneypenny/learn-content must report configuration, authorization
 * or database failures accurately. Do not silently fall back to an
 * anonymous client and translate unreadable rows into 'not published.'"
 *
 * The defect this closes: `getCommunityContentSupabase()`
 * (app/api/community-content/_lib/personaContext.ts) falls back to
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` when `SUPABASE_SERVICE_ROLE_KEY` is
 * absent. For a table whose RLS restricts reads to `service_role`
 * (`bridge_content_placements`, confirmed via `pg_policies` — zero anon/
 * authenticated policies exist, and RLS is enabled with no BYPASSRLS for
 * those roles), an anon-key client's SELECT does not error — Postgres RLS
 * silently filters the result set to zero rows. That is INDISTINGUISHABLE,
 * from inside the query, from "genuinely nothing has been published yet."
 * A route that can't tell the two apart must not guess "not published" —
 * it must refuse to run the query at all when it knows it cannot possibly
 * get an authoritative answer.
 *
 * This module is the affirmative pre-check: verify SUPABASE_SERVICE_ROLE_KEY
 * is actually present BEFORE constructing a client or running a query,
 * rather than trying to infer the gap after the fact (which is provably
 * impossible for RLS-filtered reads — they never surface as a query error).
 *
 * Scope: used by callers that read/write tables gated to `service_role`
 * only (bridge_content_placements today). NOT a blanket replacement for
 * `getCommunityContentSupabase()` — routes that only need anon-level access
 * should keep using that function unchanged.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class SupabaseConfigurationError extends Error {
  constructor(context: string, missing: string) {
    super(`${context}: ${missing} is not configured in this environment.`);
  }
}

export class SupabaseServiceRoleMissingError extends Error {
  constructor(context: string) {
    super(
      `${context}: SUPABASE_SERVICE_ROLE_KEY is not configured in this environment. This read/write ` +
        'requires elevated access — falling back to the anon key would silently return zero rows for ' +
        'a table whose Row Level Security restricts access to service_role, which is indistinguishable ' +
        'from "nothing published yet." Refusing rather than guessing.',
    );
  }
}

/**
 * Returns a real service-role-authenticated client, or throws a named,
 * catchable error identifying exactly which piece of configuration is
 * missing. Never returns a degraded (anon-key) client silently.
 */
export function getServiceRoleSupabaseOrThrow(context: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new SupabaseConfigurationError(context, 'SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new SupabaseServiceRoleMissingError(context);
  return createClient(url, key);
}
