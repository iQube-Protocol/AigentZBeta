/**
 * /api/admin/access-requests
 *
 *  - POST: the active persona submits a request for cartridge admin
 *    access. Subject to a unique-pending-row constraint so the same
 *    persona can't spam duplicate requests for the same cartridge.
 *
 *  - GET: a global admin (uber / platform_super / category_uber) lists
 *    pending + recently-decided requests. Each row is enriched inline
 *    with T1-safe CRM context (existing admin grants, active
 *    cartridges, basic CRM identity) so the reviewer doesn't have to
 *    leave the tab to make a decision.
 *
 * Spine contract: every read of "who is the caller?" goes through
 * getActivePersona — never trust client-supplied claims. Write access
 * is service-role only (table policy); the admin gate is enforced at
 * the route layer via cartridgeFlags.isAdmin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AdminAccessRequestRow {
  id: string;
  persona_id: string;
  auth_profile_id: string | null;
  requester_display_label: string | null;
  requester_email: string | null;
  requested_cartridge_slug: string | null;
  request_type: 'cartridge_access' | 'cartridge_admin' | 'global_admin';
  message: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  requested_at: string;
  decided_at: string | null;
  decided_by_persona_id: string | null;
  decision_reason: string | null;
  granted_role_id: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// POST — submit a request.
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: {
    requestedCartridgeSlug?: string | null;
    message?: string | null;
    requestType?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  // Null slug = a platform-wide (global) admin request. UI defaults to
  // a specific cartridge slug; the operator must opt in to the
  // global path explicitly.
  const requestedCartridgeSlug =
    typeof body.requestedCartridgeSlug === 'string' && body.requestedCartridgeSlug.trim().length > 0
      ? body.requestedCartridgeSlug.trim().toLowerCase()
      : null;
  const message =
    typeof body.message === 'string'
      ? body.message.trim().slice(0, 2000)
      : null;

  // Request type — default to cartridge_access (the dominant path).
  // The UI surfaces an explicit "with admin privileges" toggle for the
  // less-common cartridge_admin path. Global admin requests are
  // implied by null cartridge slug + request_type = 'global_admin'.
  const rawRequestType = typeof body.requestType === 'string' ? body.requestType.trim() : 'cartridge_access';
  const requestType: 'cartridge_access' | 'cartridge_admin' | 'global_admin' = (() => {
    if (rawRequestType === 'cartridge_admin') return 'cartridge_admin';
    if (rawRequestType === 'global_admin') return 'global_admin';
    return 'cartridge_access';
  })();
  // Sanity: global_admin must have null slug; cartridge_* must have a slug.
  if (requestType === 'global_admin' && requestedCartridgeSlug !== null) {
    return NextResponse.json(
      { error: 'inconsistent-request', message: 'Global admin requests must have no cartridge slug.' },
      { status: 400 },
    );
  }
  if (requestType !== 'global_admin' && requestedCartridgeSlug === null) {
    return NextResponse.json(
      { error: 'inconsistent-request', message: 'Cartridge access/admin requests require a cartridge slug.' },
      { status: 400 },
    );
  }

  // A persona that already holds the requested grant has no reason
  // to submit a request — short-circuit with a 409 so the UI can show
  // a clear "you already have this" affordance.
  //
  // Global-admin requesters are already global admins → block.
  // Cartridge-admin requesters who already have THAT cartridge admin
  // grant → block. Cartridge-access requesters fall through — we
  // don't currently check persona_activations here because the access
  // gate may live elsewhere (cohort, payment) and the activation
  // resolver runs at request-decision time, not here.
  if (requestType === 'global_admin' && persona.cartridgeFlags.isAdmin) {
    return NextResponse.json(
      { error: 'already-global-admin', message: 'You already have global admin access.' },
      { status: 409 },
    );
  }
  if (
    requestType === 'cartridge_admin' &&
    requestedCartridgeSlug &&
    persona.cartridgeFlags.adminCartridges.includes(requestedCartridgeSlug)
  ) {
    return NextResponse.json(
      {
        error: 'already-cartridge-admin',
        message: `You already have admin access on cartridge '${requestedCartridgeSlug}'.`,
      },
      { status: 409 },
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  // Email comes from the caller identity context — never from a
  // client-supplied value. The display label is best-effort: look up
  // the persona row for a label; fall back to the email local-part.
  // Both columns carry T1-safe content (the requester knows their own
  // email; the reviewer needs SOMETHING to address them by).
  const caller = await getCallerIdentityContext(req);
  const callerEmail = caller?.email ?? null;
  let displayLabel: string | null = null;
  try {
    const { data: personaRow } = await admin
      .from('personas')
      .select('display_label')
      .eq('id', persona.personaId)
      .maybeSingle();
    displayLabel = (personaRow as { display_label?: string | null } | null)?.display_label ?? null;
  } catch {
    displayLabel = null;
  }
  if (!displayLabel && callerEmail) {
    displayLabel = callerEmail.split('@')[0] ?? null;
  }

  const insertRow = {
    persona_id: persona.personaId,
    auth_profile_id: persona.authProfileId,
    requester_display_label: displayLabel,
    requester_email: callerEmail,
    requested_cartridge_slug: requestedCartridgeSlug,
    request_type: requestType,
    message,
    status: 'pending' as const,
  };

  const { data, error } = await admin
    .from('admin_access_requests')
    .insert(insertRow)
    .select('*')
    .single();

  if (error) {
    // Unique-pending index trip = duplicate request still open. Return
    // a 409 so the UI can re-fetch the existing one and surface it
    // rather than create a noise row.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate-pending', message: 'A pending request for this cartridge already exists.' },
        { status: 409 },
      );
    }
    console.error('[access-requests] insert error', error);
    return NextResponse.json({ error: 'insert-failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, request: toResponseShape(data as AdminAccessRequestRow) });
}

// ─────────────────────────────────────────────────────────────────────
// GET — admin lists requests + inline enrichment per row.
// ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);

  let query = admin
    .from('admin_access_requests')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(limit);
  if (statusFilter && ['pending', 'approved', 'denied', 'cancelled'].includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error('[access-requests] list error', error);
    return NextResponse.json({ error: 'list-failed' }, { status: 500 });
  }

  const typedRows = (rows ?? []) as AdminAccessRequestRow[];

  // Inline enrichment — for each requester, pull a minimal T1-safe
  // snapshot of what CRM/other tables already know about them so the
  // reviewer has context without leaving the tab. Single batched call
  // per row group keeps the response fast even with 50+ rows.
  const authProfileIds = Array.from(
    new Set(typedRows.map((r) => r.auth_profile_id).filter((id): id is string => !!id)),
  );
  const personaIds = Array.from(
    new Set(typedRows.map((r) => r.persona_id).filter((id): id is string => !!id)),
  );

  // Existing admin grants per requester — flags whether they already
  // hold OTHER admin scopes that the reviewer should be aware of.
  const adminGrantsByProfile = new Map<string, Array<{ role_type: string; tenant_id: string | null }>>();
  if (authProfileIds.length > 0) {
    const { data: roleRows } = await admin
      .from('crm_admin_roles')
      .select('auth_profile_id, role_type, tenant_id, is_active')
      .in('auth_profile_id', authProfileIds)
      .eq('is_active', true);
    for (const row of (roleRows ?? []) as Array<{ auth_profile_id: string; role_type: string; tenant_id: string | null }>) {
      const list = adminGrantsByProfile.get(row.auth_profile_id) ?? [];
      list.push({ role_type: row.role_type, tenant_id: row.tenant_id });
      adminGrantsByProfile.set(row.auth_profile_id, list);
    }
  }

  // Active runtime activations per requester — gives the reviewer a
  // quick read of which cartridge surfaces the requester is already
  // using (e.g. they're an active KNYT investor → likely safe to
  // approve KNYT cartridge admin).
  const activationsByPersona = new Map<string, string[]>();
  if (personaIds.length > 0) {
    const { data: actRows } = await admin
      .from('persona_activations')
      .select('persona_id, activation_id')
      .in('persona_id', personaIds)
      .eq('status', 'active');
    for (const row of (actRows ?? []) as Array<{ persona_id: string; activation_id: string }>) {
      const list = activationsByPersona.get(row.persona_id) ?? [];
      list.push(row.activation_id);
      activationsByPersona.set(row.persona_id, list);
    }
  }

  // Investor flag — table is set up per the CRM model. Lookup via
  // auth_profile_id when present. Defensive: any failure here yields
  // an empty set rather than blocking the list response.
  const investorProfileIds = new Set<string>();
  if (authProfileIds.length > 0) {
    try {
      const { data: invRows } = await admin
        .from('crm_investors')
        .select('auth_profile_id')
        .in('auth_profile_id', authProfileIds);
      for (const row of (invRows ?? []) as Array<{ auth_profile_id?: string }>) {
        if (row.auth_profile_id) investorProfileIds.add(row.auth_profile_id);
      }
    } catch {
      // crm_investors may not exist in every environment — skip enrichment silently.
    }
  }

  const requests = typedRows.map((row) => {
    const grants = row.auth_profile_id ? adminGrantsByProfile.get(row.auth_profile_id) ?? [] : [];
    const activations = activationsByPersona.get(row.persona_id) ?? [];
    return {
      ...toResponseShape(row),
      enrichment: {
        existingAdminGrants: grants,
        existingAdminGrantCount: grants.length,
        activeActivationIds: activations,
        activeActivationCount: activations.length,
        isInvestor: row.auth_profile_id ? investorProfileIds.has(row.auth_profile_id) : false,
      },
    };
  });

  return NextResponse.json(
    { ok: true, requests },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// ─────────────────────────────────────────────────────────────────────
// Response shaping — strips T0 leakage. persona_id + auth_profile_id
// are server-internal; the reviewer surface only needs the request id,
// the display label, and the requested cartridge.
// ─────────────────────────────────────────────────────────────────────
function toResponseShape(row: AdminAccessRequestRow) {
  return {
    id: row.id,
    requesterDisplayLabel: row.requester_display_label,
    requesterEmail: row.requester_email,
    requestedCartridgeSlug: row.requested_cartridge_slug,
    requestType: row.request_type,
    message: row.message,
    status: row.status,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    grantedRoleId: row.granted_role_id,
  };
}
