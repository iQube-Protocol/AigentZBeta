/**
 * GET  /api/mycanvas/entries/[id]/invite — list invites for an entry (owner only)
 * POST /api/mycanvas/entries/[id]/invite — invite a persona to this entry
 *
 * Body accepts EITHER:
 *   { invitedPersonaId: string, role?: 'viewer'|'commenter' }   — T0 path (legacy)
 *   { invitedHandle: string,    role?: 'viewer'|'commenter' }   — T1 path (preferred)
 *
 * The T1 path keeps persona_id off the wire — clients send a handle
 * (@knyt, name@fio-domain, 0x address, did:iq:<id>) and the server
 * resolves to persona_id internally before recording the invite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { inviteToEntry, listInvites } from '@/services/mycanvas/canvasService';

export const dynamic = 'force-dynamic';

const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Resolves a handle / DID / UUID / EVM address to a persona_id without
 * ever returning the persona_id to the browser. Used by the invite
 * endpoint so clients can send T1 identifiers and the server keeps
 * the T0 mapping internal. Mirrors /api/identity/resolve-recipient
 * but returns the persona_id (T0) instead of the EVM address.
 */
async function resolveHandleToPersonaId(rawHandle: string): Promise<string | null> {
  const q = rawHandle.trim();
  if (!q) return null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  const sb = createClient(supabaseUrl, serviceKey);

  const normalised = q.startsWith('@') ? q.slice(1) : q;
  const localPart = normalised.includes('@') ? normalised.split('@')[0] : normalised;

  // 1) Direct UUID — caller already knows the persona_id
  const uuidMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalised);
  if (uuidMatch) {
    const { data } = await sb.from('personas').select('id').eq('id', normalised).maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  // 2) did:iq:<32-hex> → reinsert hyphens → personas.id
  const didMatch = /^did:iq:([0-9a-f]{32})$/i.exec(q);
  if (didMatch) {
    const h = didMatch[1];
    const didUuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    const { data } = await sb.from('personas').select('id').eq('id', didUuid).maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  // 3) fio_handle on personas (full + local-part + fuzzy)
  for (const variant of [normalised, localPart, `%${localPart}%`]) {
    const { data } = await sb
      .from('personas')
      .select('id')
      .ilike('fio_handle', variant)
      .limit(1)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  // 4) 0x EVM address → personas.evm_address
  if (EVM_RE.test(q)) {
    const { data } = await sb
      .from('personas')
      .select('id')
      .ilike('evm_address', q)
      .limit(1)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }

  // 5) Fall back to agent_keys (covers personas the platform custodies
  // a key for but that may not yet have a personas row populated).
  // The persona_id column on agent_keys references personas.id.
  for (const variant of [normalised, localPart]) {
    const { data } = await sb
      .from('agent_keys')
      .select('persona_id')
      .ilike('fio_handle', variant)
      .limit(1)
      .maybeSingle();
    if (data && (data as { persona_id?: string }).persona_id) {
      return (data as { persona_id: string }).persona_id;
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;
  const invites = await listInvites(context.personaId, id);
  return NextResponse.json({ invites }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  let body: { invitedPersonaId?: unknown; invitedHandle?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  // T1 path: client sent a handle; resolve server-side. persona_id never
  // travels in browser-bound JSON for this flow.
  let invitedPersonaId = typeof body.invitedPersonaId === 'string' ? body.invitedPersonaId.trim() : '';
  if (!invitedPersonaId && typeof body.invitedHandle === 'string') {
    const resolved = await resolveHandleToPersonaId(body.invitedHandle);
    if (!resolved) {
      return NextResponse.json(
        { error: `couldn't resolve "${body.invitedHandle}" to a persona — accepted: @handle, name@fio-domain, did:iq:<id>, 0x address, or persona UUID` },
        { status: 404 },
      );
    }
    invitedPersonaId = resolved;
  }
  if (!invitedPersonaId) {
    return NextResponse.json({ error: 'invitedHandle-or-invitedPersonaId-required' }, { status: 400 });
  }

  const role = body.role === 'commenter' ? 'commenter' : 'viewer';
  const { id } = await ctx.params;
  const invite = await inviteToEntry(context.personaId, id, invitedPersonaId, role);
  if (!invite) return NextResponse.json({ error: 'not-found-or-forbidden' }, { status: 404 });
  return NextResponse.json({ invite }, { headers: { 'Cache-Control': 'no-store' } });
}
