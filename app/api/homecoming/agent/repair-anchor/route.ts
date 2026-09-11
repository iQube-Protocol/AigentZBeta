/**
 * POST /api/homecoming/agent/repair-anchor — Chrysalis Homecoming (CFS-023)
 * constitutional anchoring repair, operator-directed 2026-08-15.
 *
 * For a legacy polity-bound delegate whose mechanical stand-up already
 * completed (agent_root_identity + agent_persona both seeded) but whose
 * delegation_user_root_id / delegation_persona_id were left NULL because the
 * original sponsor's identity never resolved through
 * provisionAgentPersona.ts's root_did string match — see
 * services/agents/repairDelegationAnchor.ts for the full model and every
 * guarantee (never rewrites sponsor provenance, never touches
 * delegation_grants, never overwrites a conflicting non-null anchor, never
 * reruns genesis or recreates/revokes the delegate).
 *
 * Body: { delegate: HomecomingDelegateId } — resolves the delegate's
 * agent_root_identity by its card slug. Admin-gated.
 *
 * Response carries everything needed to verify the repair in one call:
 * before/after anchor state, the repair receipt id (or null if nothing was
 * written / already anchored), and a fresh Constitutional Presence
 * assessment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { repairDelegationAnchor } from '@/services/agents/repairDelegationAnchor';
import { assessDelegate } from '@/services/homecoming/constitutionalPresence';
import { HOMECOMING_DELEGATE_SPECS } from '@/services/homecoming/agentHomecoming';
import { HOMECOMING_DELEGATES, type HomecomingDelegateId } from '@/types/homecoming';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  let body: { delegate?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const delegate = body.delegate as HomecomingDelegateId;
  if (!delegate || !(HOMECOMING_DELEGATES as readonly string[]).includes(delegate)) {
    return NextResponse.json(
      { ok: false, error: `delegate must be one of: ${HOMECOMING_DELEGATES.join(', ')}` },
      { status: 400 },
    );
  }
  const spec = HOMECOMING_DELEGATE_SPECS[delegate];
  if (!spec) {
    return NextResponse.json({ ok: false, error: `No stand-up spec for '${delegate}' — cannot resolve its card slug` }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

  const { data: rootRow, error: rootErr } = await admin
    .from('agent_root_identity')
    .select('id')
    .eq('agent_card_slug', spec.slug)
    .maybeSingle();
  if (rootErr) return NextResponse.json({ ok: false, error: rootErr.message }, { status: 500 });
  if (!rootRow) {
    return NextResponse.json(
      { ok: false, error: `No agent_root_identity found for '${delegate}' — nothing to repair. Run stand-up first.` },
      { status: 404 },
    );
  }

  const result = await repairDelegationAnchor(admin, String(rootRow.id), persona.personaId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, delegate, error: result.reason, detail: result.detail }, { status: 422 });
  }

  const presence = await assessDelegate(admin, delegate).catch(() => null);

  return NextResponse.json({
    ok: true,
    delegate,
    agentRootId: result.agentRootId,
    agentPersonaId: result.agentPersonaId,
    alreadyAnchored: result.alreadyAnchored,
    delegationUserRootId: result.delegationUserRootId,
    delegationPersonaId: result.delegationPersonaId,
    rootAnchorFilledThisCall: result.rootAnchorFilledThisCall,
    personaBridgeFilledThisCall: result.personaBridgeFilledThisCall,
    receiptId: result.receiptId,
    presence,
    note: result.alreadyAnchored
      ? 'Both anchor fields were already set — no write performed (idempotent).'
      : 'Anchor repair written. sponsor_persona_id/sponsor_passport_id, timestamps, and delegation_grants are untouched.',
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    note:
      'POST { delegate } (admin) to repair a legacy polity-bound delegate\'s delegation_user_root_id/delegation_persona_id ' +
      'via the canonical personhood/Passport continuity path. Never rewrites sponsor provenance or delegation_grants.',
    repairable: Object.keys(HOMECOMING_DELEGATE_SPECS),
  });
}
