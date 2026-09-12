/**
 * GET /api/research/exchanges/[exchangeId]/artifact-content?party=A|B —
 * the actual readable content of one party's deposited artifact.
 *
 * `/api/research/exchanges/[exchangeId]` already discloses the artifact's
 * METADATA (hash, title, class) once the exchange's disclosure policy
 * permits it. This route is the first to dereference sourceReference /
 * storageReference into real bytes/text — see
 * services/research/reciprocalExchange.ts::resolveExchangeArtifactContent
 * for the extraction mechanism and its authorization note.
 *
 * Fails CLOSED via the SAME gated projection (getExchangeView) the metadata
 * route uses — never a second, independently-derived disclosure check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveExchangeArtifactContent } from '@/services/research/reciprocalExchange';
import type { PartySlot } from '@/types/reciprocalExchange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ exchangeId: string }> }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: noStore });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });

  const { exchangeId } = await ctx.params;
  const partyParam = req.nextUrl.searchParams.get('party');
  if (partyParam !== 'A' && partyParam !== 'B') {
    return NextResponse.json({ ok: false, error: "party must be 'A' or 'B'" }, { status: 400, headers: noStore });
  }
  const party: PartySlot = partyParam;

  const result = await resolveExchangeArtifactContent(admin, { exchangeId, personaId: persona.personaId, party });
  if (!result.ok) {
    const status = result.error === 'not-a-party' ? 403 : result.error === 'exchange not found' ? 404 : 400;
    return NextResponse.json(result, { status, headers: noStore });
  }
  return NextResponse.json(result, { headers: noStore });
}
