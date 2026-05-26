/**
 * POST /api/admin/access-requests/[id]/decide
 *
 * A global admin approves or denies a pending admin-access request.
 * Approval writes the matching crm_admin_roles row (tenant-scoped or
 * platform-wide). Denial just records the reason on the request row.
 *
 * Spine: caller resolved via getActivePersona; gate is
 * `cartridgeFlags.isAdmin` (global). Per-cartridge admins cannot yet
 * approve requests for their own cartridge — that's a follow-up to
 * delegate review to franchise/tenant admins. For now the alpha scope
 * is intentionally global-only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DecideBody {
  decision?: 'approve' | 'deny';
  reason?: string | null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: 'missing-id' }, { status: 400 });
  }

  let body: DecideBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const decision = body.decision;
  if (decision !== 'approve' && decision !== 'deny') {
    return NextResponse.json({ error: 'invalid-decision' }, { status: 400 });
  }
  const reason =
    typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : null;

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  // Load the request row + verify it's still pending.
  const { data: existing, error: loadErr } = await admin
    .from('admin_access_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: 'not-pending', currentStatus: existing.status },
      { status: 409 },
    );
  }

  if (decision === 'deny') {
    const { data: updated, error: updErr } = await admin
      .from('admin_access_requests')
      .update({
        status: 'denied',
        decided_at: new Date().toISOString(),
        decided_by_persona_id: persona.personaId,
        decision_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (updErr) {
      console.error('[access-requests/decide] deny update error', updErr);
      return NextResponse.json({ error: 'update-failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, decision: 'denied', request: updated });
  }

  // === Approve path ===
  // Resolve the requested cartridge slug → tenant id (or treat as a
  // platform-wide grant when slug is null). The slug-to-tenant
  // direction is the inverse of the alias map in
  // services/access/cartridgeAdminGrants.ts; the simplest correct
  // resolver is "look up the tenant whose slug matches, or whose alias
  // produces this cartridge slug." Alpha-scope: walk crm_tenants
  // directly. If the cartridge has no matching tenant (e.g. metame),
  // fall back to a global platform_super_admin grant on the requester.
  const cartridgeSlug = existing.requested_cartridge_slug as string | null;

  let grantedRoleId: string | null = null;
  if (!cartridgeSlug) {
    // Platform-wide request — create a platform_super_admin row.
    if (!existing.auth_profile_id) {
      return NextResponse.json(
        { error: 'requester-missing-auth-profile', message: 'Requester has no auth_profile_id; cannot grant.' },
        { status: 422 },
      );
    }
    const { data: roleRow, error: roleErr } = await admin
      .from('crm_admin_roles')
      .insert({
        auth_profile_id: existing.auth_profile_id,
        role_type: 'platform_super_admin',
        tenant_id: null,
        franchise_id: null,
        is_active: true,
      })
      .select('id')
      .single();
    if (roleErr) {
      console.error('[access-requests/decide] platform grant insert error', roleErr);
      return NextResponse.json({ error: 'grant-failed', detail: roleErr.message }, { status: 500 });
    }
    grantedRoleId = (roleRow as { id?: string })?.id ?? null;
  } else {
    // Per-cartridge request — find a tenant whose slug maps to this
    // cartridge slug. The map in cartridgeAdminGrants is
    // tenant.slug -> cartridge.slug. Inverse: any tenant whose
    // mapped cartridge equals this cartridgeSlug. For the alpha set
    // we resolve in code rather than another join — keeps the lookup
    // simple even when the map grows.
    const tenantSlugCandidates = inverseCartridgeSlugToTenantSlugs(cartridgeSlug);
    const { data: tenantRows } = await admin
      .from('crm_tenants')
      .select('id, slug')
      .in('slug', tenantSlugCandidates);
    const tenantId =
      Array.isArray(tenantRows) && tenantRows.length > 0
        ? (tenantRows[0] as { id?: string }).id ?? null
        : null;
    if (!tenantId) {
      return NextResponse.json(
        {
          error: 'tenant-not-found',
          message: `Could not resolve cartridge slug '${cartridgeSlug}' to a CRM tenant. Tried slugs: ${tenantSlugCandidates.join(', ')}.`,
        },
        { status: 422 },
      );
    }
    if (!existing.auth_profile_id) {
      return NextResponse.json(
        { error: 'requester-missing-auth-profile', message: 'Requester has no auth_profile_id; cannot grant.' },
        { status: 422 },
      );
    }
    const { data: roleRow, error: roleErr } = await admin
      .from('crm_admin_roles')
      .insert({
        auth_profile_id: existing.auth_profile_id,
        role_type: 'tenant_super_admin',
        tenant_id: tenantId,
        franchise_id: null,
        is_active: true,
      })
      .select('id')
      .single();
    if (roleErr) {
      console.error('[access-requests/decide] tenant grant insert error', roleErr);
      return NextResponse.json({ error: 'grant-failed', detail: roleErr.message }, { status: 500 });
    }
    grantedRoleId = (roleRow as { id?: string })?.id ?? null;
  }

  const { data: updated, error: updErr } = await admin
    .from('admin_access_requests')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      decided_by_persona_id: persona.personaId,
      decision_reason: reason,
      granted_role_id: grantedRoleId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (updErr) {
    console.error('[access-requests/decide] approve update error', updErr);
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, decision: 'approved', request: updated, grantedRoleId });
}

// Inverse of TENANT_SLUG_TO_CARTRIDGE_SLUG in services/access/cartridgeAdminGrants.ts.
// Returns the tenant slug(s) that map to the given cartridge slug. The
// cartridge slug is the canonical input; for slugs that pass through
// unchanged (metame, marketa, agentiq-os, venture-lab) we also include
// the cartridge slug itself.
function inverseCartridgeSlugToTenantSlugs(cartridgeSlug: string): string[] {
  const inverse: Record<string, string[]> = {
    'knyt-codex': ['knyt'],
    qripto: ['qriptopian'],
    'agentiq-os': ['agentiq-os'],
    'venture-lab': ['venture-lab'],
    metame: ['metame'],
    marketa: ['marketa'],
  };
  return inverse[cartridgeSlug] ?? [cartridgeSlug];
}
