/**
 * POST /api/qubetalk/channels/bind
 *
 * Provisions a QubeTalk channel between the active citizen persona and
 * a delegated agent's persona. Called when a bounded-delegation grant
 * lands — the channel is the conduit through which the citizen and
 * agent exchange locker items, instructions, and receipts.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 4.
 *
 * Body: { delegatedAgentRootId, delegationGrantId? }
 *
 * Returns the existing active channel if one already exists for the
 * (holder, agent) pair — idempotent.
 *
 * T0 discipline: holder_persona_id and delegated_persona_id stay
 * server-internal. Response carries channel_id only — the QubeTalk
 * runtime infrastructure does the actual message routing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

interface BindBody {
  delegatedAgentRootId: string;
  delegationGrantId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json()) as BindBody;
    if (!body?.delegatedAgentRootId?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'delegatedAgentRootId is required' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // Resolve agent's persona via agent_persona.
    const { data: agentPersona, error: agentErr } = await admin
      .from('agent_persona')
      .select('id, agent_root_id, delegation_persona_id')
      .eq('agent_root_id', body.delegatedAgentRootId)
      .maybeSingle();

    if (agentErr) {
      return NextResponse.json({ ok: false, error: agentErr.message }, { status: 500 });
    }

    // Pre-Sprint-3-agent-persona fallback: bind channel with NULL
    // delegated_persona_id so the row exists; UI can show "channel
    // pending agent persona creation".
    const delegatedPersonaId = agentPersona?.delegation_persona_id ?? null;

    // Idempotent: check for an active channel first.
    if (delegatedPersonaId) {
      const { data: existing } = await admin
        .from('passport_qubetalk_channels')
        .select('channel_id, channel_status, created_at')
        .eq('holder_persona_id', persona.personaId)
        .eq('delegated_persona_id', delegatedPersonaId)
        .eq('channel_status', 'active')
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          ok: true,
          channel: {
            channelId: existing.channel_id,
            status: existing.channel_status,
            createdAt: existing.created_at,
            preexisting: true,
          },
        });
      }
    }

    const { data: row, error: insertErr } = await admin
      .from('passport_qubetalk_channels')
      .insert({
        holder_persona_id: persona.personaId,
        delegated_persona_id: delegatedPersonaId ?? persona.personaId, // self-bound placeholder
        delegated_agent_root_id: body.delegatedAgentRootId,
        delegation_grant_id: body.delegationGrantId ?? null,
        channel_status: 'active',
      })
      .select('channel_id, channel_status, created_at')
      .single();

    if (insertErr) {
      if (insertErr.message.includes('passport_qubetalk_channels')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260613300000_passport_locker_qubetalk.sql must be applied in Supabase.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      channel: {
        channelId: row.channel_id,
        status: row.channel_status,
        createdAt: row.created_at,
        preexisting: false,
        delegatedPersonaPending: delegatedPersonaId === null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Channel bind failed' },
      { status: 500 },
    );
  }
}
