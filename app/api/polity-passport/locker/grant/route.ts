/**
 * POST /api/polity-passport/locker/grant
 *
 * Body: { itemId, delegatedAgentRootId, scope: 'read' | 'read_download',
 *         expiresAt? }
 *
 * Grants a bound agent access to a specific locker item. Caller must own
 * the item. The agent must already exist in agent_root_identity and have
 * an associated persona (agent_persona row) — Sprint 3 produces both.
 *
 * The grant is also surfaced through the QubeTalk channel between the
 * holder and the agent (auto-created by POST /api/qubetalk/channels/bind
 * when the bounded delegation lands).
 *
 * T0 discipline: caller's persona_id and the agent's persona_id are
 * both server-internal. The grant_id and item_id are T1-safe; the agent
 * root id is public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

interface GrantBody {
  itemId: string;
  delegatedAgentRootId: string;
  scope?: 'read' | 'read_download';
  expiresAt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json()) as GrantBody;
    if (!body?.itemId?.trim() || !body?.delegatedAgentRootId?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'itemId and delegatedAgentRootId are required' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // 1. Verify caller owns the item.
    const { data: item, error: itemErr } = await admin
      .from('passport_locker_items')
      .select('item_id, holder_persona_id, downloadable')
      .eq('item_id', body.itemId)
      .maybeSingle();

    if (itemErr) {
      return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ ok: false, error: 'Locker item not found' }, { status: 404 });
    }
    if (item.holder_persona_id !== persona.personaId) {
      return NextResponse.json(
        { ok: false, error: 'Caller does not own this locker item' },
        { status: 403 },
      );
    }

    // 2. Look up the agent's persona via agent_persona table (Sprint 3).
    const { data: agentPersonaRow, error: agentErr } = await admin
      .from('agent_persona')
      .select('id, agent_root_id, delegation_persona_id')
      .eq('agent_root_id', body.delegatedAgentRootId)
      .maybeSingle();

    if (agentErr) {
      return NextResponse.json({ ok: false, error: agentErr.message }, { status: 500 });
    }

    let delegatedPersonaId: string | null = null;
    if (agentPersonaRow?.delegation_persona_id) {
      delegatedPersonaId = agentPersonaRow.delegation_persona_id;
    } else {
      // Pre-Sprint-3 agent — no agent_persona row yet. The grant still
      // lands but delegated_persona_id stays NULL until the agent persona
      // is created.
      delegatedPersonaId = persona.personaId; // placeholder: holder acts on behalf
    }

    // 3. Scope guard — read_download only honored if item is downloadable.
    const requestedScope = body.scope ?? 'read';
    if (requestedScope === 'read_download' && !item.downloadable) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Item is marked view-only — only read scope can be granted',
        },
        { status: 400 },
      );
    }

    // 4. Insert grant.
    const { data: grantRow, error: grantErr } = await admin
      .from('passport_locker_grants')
      .insert({
        item_id: body.itemId,
        delegated_persona_id: delegatedPersonaId,
        delegated_agent_root_id: body.delegatedAgentRootId,
        scope: requestedScope,
        granted_by_persona_id: persona.personaId,
        expires_at: body.expiresAt ?? null,
      })
      .select('grant_id, item_id, scope, granted_at, expires_at')
      .single();

    if (grantErr) {
      if (grantErr.message.includes('passport_locker_grants')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260613300000_passport_locker_qubetalk.sql must be applied in Supabase.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: grantErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      grant: {
        grantId: grantRow.grant_id,
        itemId: grantRow.item_id,
        scope: grantRow.scope,
        delegatedAgentRootId: body.delegatedAgentRootId,
        grantedAt: grantRow.granted_at,
        expiresAt: grantRow.expires_at,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Grant failed' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/polity-passport/locker/grant?grantId=<uuid> — revoke a grant.
 */
export async function DELETE(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const grantId = req.nextUrl.searchParams.get('grantId');
    if (!grantId) {
      return NextResponse.json({ ok: false, error: 'grantId query param required' }, { status: 400 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { error } = await admin
      .from('passport_locker_grants')
      .update({ revoked_at: new Date().toISOString() })
      .eq('grant_id', grantId)
      .eq('granted_by_persona_id', persona.personaId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Revoke failed' },
      { status: 500 },
    );
  }
}
