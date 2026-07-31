/**
 * POST /api/billing/comp-request
 *
 * A persona requests COMPLIMENTARY / admin-granted access to a plan tier
 * (e.g. a qualified user who can't pay but should be granted Sovereignty,
 * Stewardship, or a Founder Office tier). This does NOT grant anything — it
 * files a row into the SAME admin approval queue used by cartridge access
 * requests (admin_access_requests), so the existing metaMe Admin → Access
 * Requests tab surfaces it and an admin approves/denies it there.
 *
 * The requested tier is encoded as a `plan:<tierKey>` cartridge slug so the
 * decide route can fulfil it by writing persona_plans (see the decide route's
 * `plan:` branch). Encoding in the slug means it works whether or not the
 * `request_type` column migration has been applied.
 *
 * Spine: caller resolved via getActivePersona (Bearer token). T0 personaId
 * never leaves the server beyond the admin queue row it already keys on.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { isValidTierKey, tierLabel } from '@/services/billing/planCheckout';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  }

  let body: { tierKey?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400, headers: NO_STORE });
  }

  const tierKey = typeof body.tierKey === 'string' ? body.tierKey : '';
  if (!isValidTierKey(tierKey)) {
    return NextResponse.json({ ok: false, error: 'invalid tierKey' }, { status: 400, headers: NO_STORE });
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : '';
  if (!reason) {
    return NextResponse.json({ ok: false, error: 'A reason is required for a complimentary access request.' }, { status: 400, headers: NO_STORE });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 500, headers: NO_STORE });
  }

  // Resolve a human-readable label + email for the admin queue row.
  const caller = await getCallerIdentityContext(req);
  let displayLabel: string | null = null;
  try {
    const { data: personaRow } = await admin
      .from('personas')
      .select('display_label')
      .eq('id', context.personaId)
      .maybeSingle();
    displayLabel = (personaRow as { display_label?: string | null } | null)?.display_label ?? null;
  } catch {
    displayLabel = null;
  }
  if (!displayLabel && caller?.email) displayLabel = caller.email.split('@')[0] ?? null;

  const label = tierLabel(tierKey);
  const insertRow: Record<string, unknown> = {
    persona_id: context.personaId,
    auth_profile_id: context.authProfileId ?? null,
    requester_display_label: displayLabel,
    requester_email: caller?.email ?? null,
    // plan:<tierKey> — decoded by the decide route's plan-grant branch.
    requested_cartridge_slug: `plan:${tierKey}`,
    request_type: 'plan_grant',
    message: `Complimentary ${label} request: ${reason}`,
    status: 'pending',
  };

  let { error } = await admin.from('admin_access_requests').insert(insertRow);
  // request_type column may not exist yet (migration 20260526020000) — retry
  // without it. The plan:<tierKey> slug still carries the grant target.
  if (error && (error.code === '42703' || /column .*request_type/i.test(error.message ?? ''))) {
    const { request_type, ...rowSansType } = insertRow;
    const retry = await admin.from('admin_access_requests').insert(rowSansType);
    error = retry.error;
  }
  // 23505 = duplicate pending request — idempotent, treat as success.
  if (error && error.code !== '23505') {
    console.error('[comp-request] insert error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, tierKey, tierLabel: label }, { headers: NO_STORE });
}
