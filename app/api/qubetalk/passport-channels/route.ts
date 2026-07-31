/**
 * GET /api/qubetalk/passport-channels
 *
 * Lists active QubeTalk channels for the active persona's passport.
 * Each channel links a citizen holder to a delegated agent. Enriched
 * with agent display names from agent_root_identity.
 *
 * Per hackathon plan §Sprint 4 — citizen ↔ agent messaging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { data: channels, error } = await admin
      .from('passport_qubetalk_channels')
      .select('channel_id, delegated_agent_root_id, delegation_grant_id, channel_status, created_at')
      .eq('holder_persona_id', persona.personaId)
      .eq('channel_status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('passport_qubetalk_channels')) {
        return NextResponse.json(
          { ok: true, channels: [], migrationPending: '20260613300000_passport_locker_qubetalk.sql' },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = channels ?? [];

    const agentIds = rows
      .map((r) => r.delegated_agent_root_id)
      .filter((id): id is string => typeof id === 'string');

    const agentById: Record<string, { display_name: string; agent_class: string; did_uri: string }> = {};
    if (agentIds.length > 0) {
      const { data: agents } = await admin
        .from('agent_root_identity')
        .select('id, display_name, agent_class, did_uri')
        .in('id', agentIds);
      for (const a of agents ?? []) {
        agentById[a.id] = a;
      }
    }

    const result = rows.map((ch) => {
      const agent = ch.delegated_agent_root_id ? agentById[ch.delegated_agent_root_id] : undefined;
      return {
        channelId: ch.channel_id,
        agentRootId: ch.delegated_agent_root_id,
        agentDisplayName: agent?.display_name ?? 'Delegated Agent',
        agentClass: agent?.agent_class ?? 'helper',
        agentDidUri: agent?.did_uri ?? null,
        delegationGrantId: ch.delegation_grant_id,
        status: ch.channel_status,
        createdAt: ch.created_at,
      };
    });

    return NextResponse.json(
      { ok: true, channels: result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Channel list failed' },
      { status: 500 },
    );
  }
}
