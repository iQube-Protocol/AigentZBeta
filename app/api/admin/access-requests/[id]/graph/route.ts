/**
 * GET /api/admin/access-requests/[id]/graph
 *
 * Lazy-loaded persona asset graph for the access-requests reviewer.
 * The list endpoint carries the lightweight alpha enrichment; the UI
 * calls this route when the reviewer expands a specific row so the
 * full identity / asset graph lands on demand instead of being shipped
 * for every row up front.
 *
 * Gated by the spine's global `cartridgeFlags.isAdmin` flag — same
 * gate as the list + decide routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getPersonaAssetGraph } from '@/services/identity/personaAssetGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 500 });
  }

  // Resolve the request row → requester persona_id. We never accept a
  // client-supplied persona_id here; the reviewer can only resolve the
  // graph for a persona that has a corresponding access-request row.
  const { data: row } = await admin
    .from('admin_access_requests')
    .select('persona_id')
    .eq('id', id)
    .maybeSingle();
  const requesterPersonaId = (row as { persona_id?: string } | null)?.persona_id ?? null;
  if (!requesterPersonaId) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const graph = await getPersonaAssetGraph(requesterPersonaId);
  return NextResponse.json(
    { ok: true, graph },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
