/**
 * POST /api/agents/[id]/revoke — agent lifecycle / revocation control.
 *
 * `id` is the agent_root_identity id. Sets the revocation state (Agent Charter
 * §Revocation): pause · suspend · revoke · quarantine · destroy. Revocation
 * takes effect immediately. Authority: platform admin OR the agent's recorded
 * revocation_authority_persona_id (the sponsor). Terminal states
 * (revoked / destroyed) cannot be transitioned out of.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { PASSPORT_BUREAU_CARTRIDGE_SLUG } from '@/services/passport/issuanceService';
import { REVOCATION_STATES, TERMINAL_REVOCATION_STATES, type RevocationState } from '@/services/polity/constitution';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

interface RevokeBody {
  state: RevocationState;
  reason?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentRootId } = await params;
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as RevokeBody;
    const next = body.state;
    if (!next || !REVOCATION_STATES.includes(next)) {
      return NextResponse.json(
        { ok: false, error: `state must be one of: ${REVOCATION_STATES.join(', ')}` },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { data: agent, error: loadErr } = await admin
      .from('agent_root_identity')
      .select('id, display_name, agent_class, revocation_state, revocation_authority_persona_id, sponsor_persona_id')
      .eq('id', agentRootId)
      .maybeSingle();
    if (loadErr) {
      if (loadErr.message.includes('revocation_state')) {
        return NextResponse.json(
          { ok: false, error: 'Pending migration: 20260617100000_agent_constitutional_binding.sql must be applied before revocation control.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });
    }
    if (!agent) {
      return NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });
    }

    // Authority: platform admin OR the recorded revocation authority / sponsor.
    const isAdmin =
      persona.cartridgeFlags.isAdmin ||
      persona.cartridgeFlags.adminCartridges.includes(PASSPORT_BUREAU_CARTRIDGE_SLUG);
    const isAuthority =
      agent.revocation_authority_persona_id === persona.personaId ||
      agent.sponsor_persona_id === persona.personaId;
    if (!isAdmin && !isAuthority) {
      return NextResponse.json(
        { ok: false, error: 'Only an admin or the agent revocation authority may change its state.' },
        { status: 403 },
      );
    }

    const current = (agent.revocation_state ?? 'active') as RevocationState;
    if (TERMINAL_REVOCATION_STATES.includes(current)) {
      return NextResponse.json(
        { ok: false, code: 'terminal_state', error: `Agent is in terminal state '${current}' and cannot be changed.` },
        { status: 409 },
      );
    }

    const { data: updated, error: updErr } = await admin
      .from('agent_root_identity')
      .update({
        revocation_state: next,
        revocation_state_at: new Date().toISOString(),
        revocation_reason: body.reason ?? null,
      })
      .eq('id', agentRootId)
      .select('id, display_name, revocation_state, revocation_state_at, revocation_reason')
      .single();
    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    // DVN-anchorable receipt for the lifecycle transition (Agent Charter
    // §Receipts). Awaited so it persists before the response returns — on
    // serverless a fire-and-forget write is cut off when the function freezes.
    // Identifiers kept agent-scoped (agent_root_id, agent class), not the
    // sponsor's raw persona id.
    try {
      await createActivityReceipt({
        personaId: persona.personaId,
        activeCartridge: PASSPORT_BUREAU_CARTRIDGE_SLUG,
        actionType: 'agent_revocation_state_changed',
        summary: `Agent "${agent.display_name}" ${current} → ${next}${body.reason ? `: ${body.reason}` : ''}`,
        actionInput: {
          agent_root_id: agentRootId,
          agent_class: agent.agent_class,
          previous_state: current,
          revocation_state: next,
          reason: body.reason ?? null,
        },
      });
    } catch {
      // Receipt is best-effort — never fail the revocation over the audit write.
    }

    return NextResponse.json({
      ok: true,
      agent: {
        agentRootId: String(updated.id),
        displayName: updated.display_name,
        revocationState: updated.revocation_state,
        revocationStateAt: updated.revocation_state_at,
        revocationReason: updated.revocation_reason,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Revocation failed' },
      { status: 500 },
    );
  }
}
