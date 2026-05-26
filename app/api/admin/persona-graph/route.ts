/**
 * GET /api/admin/persona-graph?personaId=<uuid>
 *
 * Read-side resolver for the Persona 360 inspector tab. Returns the
 * full T1-safe identity / asset graph for the supplied personaId.
 *
 * Gated by the spine's global `cartridgeFlags.isAdmin`. Per-cartridge
 * admins do NOT have access here yet — global-only for alpha. Once the
 * PII consent surface lands, cartridge admins can call this with the
 * spine masking PII per the consent layer.
 *
 * The Persona 360 tab supports lookup by display label / email; that
 * lookup uses the companion route POST /api/admin/persona-graph/search.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getPersonaAssetGraph } from '@/services/identity/personaAssetGraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const personaId = url.searchParams.get('personaId');
  if (!personaId) {
    return NextResponse.json({ error: 'missing-personaId' }, { status: 400 });
  }

  const graph = await getPersonaAssetGraph(personaId);
  return NextResponse.json(
    { ok: true, graph, personaId },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
