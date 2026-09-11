/**
 * GET /api/admin/diag/persona-resolution
 *
 * Read-only diagnostic for the active-persona resolver. Returns:
 *   - the caller's auth_profile_id resolved by getCallerIdentityContext
 *   - linked auth_profile_ids via the merge view
 *   - the full set of "owned" personas across all linked profiles, with
 *     id, fio_handle, status, created_at, auth_profile_id, AND a
 *     sort-index so we can see which one wins the created_at ASC tie
 *   - what getActivePersona() actually returned + which priority step
 *
 * Built because the symptoms (devagent persistently winning step 4
 * despite being the user's MOST recently created persona) didn't match
 * any of the obvious hypotheses (created_at backdating from the
 * consolidation migration, multi-profile linking, status filter). The
 * only way to figure out the actual mechanism is to dump the rows the
 * resolver sees and compare to the user's expectation.
 *
 * ROOT CAUSE FOUND (2026-07-28): "devagent"-class rows are delegated
 * agent personas (app_origin === AIGENT_ME_APP_ORIGIN,
 * services/agents/provisionAigentMePersona.ts) owned by the SAME
 * auth_profile_id as the citizen's own personas, by design, so they
 * appear in the wallet persona switcher. listOwnedPersonas' created_at
 * ASC sort had no app_origin awareness, so an agent row with an earlier
 * (or merely tied) created_at could win step 4 ahead of the citizen's
 * real persona. Fixed by sortOwnedPersonaRowsAgentLast, which the
 * resolver now applies before step 4 picks index 0 — this route mirrors
 * that same sort below so its diagnostic view matches what the resolver
 * ACTUALLY consumes, not the raw created_at-only order.
 *
 * Admin-only (uses the same crm_admin_roles check as other admin
 * endpoints). Never returns persona_session_tokens or any other T1/T0
 * material — just the integrity-of-data signals needed for diagnosis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona, sortOwnedPersonaRowsAgentLast } from '@/services/identity/getActivePersona';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { AIGENT_ME_APP_ORIGIN } from '@/services/agents/provisionAigentMePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAdminCaller(authProfileId: string, email: string | null): Promise<boolean> {
  const admin = getSupabaseServer();
  if (!admin) return false;
  try {
    const { data } = await admin
      .from('crm_admin_roles')
      .select('id')
      .eq('auth_profile_id', authProfileId)
      .eq('is_active', true)
      .limit(1);
    if (Array.isArray(data) && data.length > 0) return true;
    if (email) {
      const { data: aliasRows } = await admin
        .from('crm_auth_profile_emails')
        .select('auth_profile_id')
        .eq('email_normalized', email.trim().toLowerCase())
        .eq('status', 'active');
      const aliasIds = ((aliasRows || []) as Array<{ auth_profile_id?: string }>)
        .map((r) => r.auth_profile_id)
        .filter((id): id is string => !!id);
      if (aliasIds.length > 0) {
        const { data: roles } = await admin
          .from('crm_admin_roles')
          .select('id')
          .in('auth_profile_id', aliasIds)
          .eq('is_active', true)
          .limit(1);
        if (Array.isArray(roles) && roles.length > 0) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const caller = await getCallerIdentityContext(req);
  if (!caller) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Admin gate — this diag exposes integrity-of-data signals across
  // every linked profile; restrict to admins per CLAUDE.md.
  if (!(await isAdminCaller(caller.authProfileId, caller.email))) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  // Mirror exactly what listOwnedPersonas does inside getActivePersona —
  // same IN clause, same status filter, same sort, same agent-last
  // reorder — so we see EXACTLY what the resolver sees, in the order it
  // sees it.
  let linkedAuthProfileIds: string[] = [];
  try { linkedAuthProfileIds = await getMergedLinkedAuthProfileIds(caller.authProfileId); }
  catch { linkedAuthProfileIds = []; }
  const visibleAuthProfileIds = Array.from(new Set([caller.authProfileId, ...linkedAuthProfileIds]));

  // SAME query the resolver runs.
  const { data: personasAscData, error: ascErr } = await admin
    .from('personas')
    .select('id, fio_handle, status, default_identity_state, created_at, updated_at, auth_profile_id, display_name, app_origin')
    .in('auth_profile_id', visibleAuthProfileIds)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  // SAME reorder the resolver applies before step 4 picks index 0.
  const personasResolverOrder = sortOwnedPersonaRowsAgentLast(
    (personasAscData ?? []) as Array<{ app_origin: string | null; id: string }>,
  );

  // Side-by-side DESC view — if devagent is the youngest, DESC will put
  // it FIRST. Helps spot whether the actual sort somehow inverts.
  const { data: personasDescData } = await admin
    .from('personas')
    .select('id, fio_handle, status, created_at, auth_profile_id')
    .in('auth_profile_id', visibleAuthProfileIds)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // ALSO query without the status filter — to see if "non-active"
  // personas exist that the resolver ignores. If only devagent has
  // status='active', the resolver picks it trivially regardless of
  // created_at.
  const { data: allStatusData } = await admin
    .from('personas')
    .select('id, fio_handle, status, created_at, auth_profile_id')
    .in('auth_profile_id', visibleAuthProfileIds)
    .order('created_at', { ascending: true });

  // What did getActivePersona ACTUALLY return for this caller?
  const resolved = await getActivePersona(req);

  // crm_auth_profile_links — show the merge edges so we can see what's
  // tying separate profiles together.
  const { data: linkRows } = await admin
    .from('crm_auth_profile_links')
    .select('owner_auth_profile_id, linked_auth_profile_id, relationship_mode, active, created_at')
    .or(`owner_auth_profile_id.eq.${caller.authProfileId},linked_auth_profile_id.eq.${caller.authProfileId}`);

  return NextResponse.json(
    {
      ok: true,
      caller: {
        authProfileId: caller.authProfileId,
        email: caller.email,
      },
      linkage: {
        linkedAuthProfileIds,
        visibleAuthProfileIds,
        crmAuthProfileLinkRows: linkRows ?? [],
      },
      personas_active_asc: {
        // Raw created_at ASC — NOT what step 4 picks from since the
        // 2026-07-28 fix. Kept for visibility into the underlying order
        // before the agent-last reorder is applied.
        rows: personasAscData ?? [],
        error: ascErr?.message ?? null,
      },
      personas_resolver_order: {
        // The ACTUAL view the resolver consumes for step 4: created_at ASC
        // with app_origin === AIGENT_ME_APP_ORIGIN rows moved to the end.
        // Index 0 here — not in personas_active_asc — wins step 4.
        rows: personasResolverOrder,
      },
      personas_active_desc: {
        // Same rows, opposite sort — for visually confirming which is
        // newest vs oldest.
        rows: personasDescData ?? [],
      },
      personas_all_statuses_asc: {
        // Includes archived / inactive — to see if a status filter is
        // why devagent appears to win.
        rows: allStatusData ?? [],
      },
      resolver_output: {
        personaId: resolved?.personaId ?? null,
        source: resolved?.source ?? null,
        cartridgeFlags: resolved?.cartridgeFlags ?? null,
        identifiability: resolved?.identifiability ?? null,
      },
      // Compact hint for the operator: comparing resolver output to
      // personas_resolver_order[0] tells us whether step 4 is firing
      // (==) or one of steps 1–3 (!=). Also flags the specific historical
      // symptom directly: an agent-origin persona resolved via step 4.
      hint: (() => {
        if (!resolved) return 'resolver returned null (likely caller not yet bound to any persona)';
        const winner = personasResolverOrder[0] as { id?: string; app_origin?: string | null } | undefined;
        if (winner?.id !== resolved.personaId) {
          return 'resolver picked a different persona than personas_resolver_order[0] — step 1, 2, or 3 fired';
        }
        if (winner?.app_origin === AIGENT_ME_APP_ORIGIN) {
          return 'BUG: step 4 (default first-owned) fired AND resolved to an agent-origin (aigentMe) persona — sortOwnedPersonaRowsAgentLast is not excluding it as expected';
        }
        return 'resolver picked personas_resolver_order[0] — step 4 (default first-owned) is firing, correctly landing on a non-agent persona';
      })(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
