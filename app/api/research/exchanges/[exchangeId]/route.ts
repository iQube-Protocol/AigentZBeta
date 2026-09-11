/**
 * GET /api/research/exchanges/[exchangeId] — the gated view of one exchange.
 *
 * Fails CLOSED: a caller who is not initiator or counterparty gets 403, not
 * a redacted view. Counterparty artifact content is server-side gated per
 * the exchange's disclosure policy (services/research/reciprocalExchange.ts
 * `getExchangeView`) — never rely on the client to hide it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getExchangeView } from '@/services/research/reciprocalExchange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ exchangeId: string }> }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: noStore });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });

  const { exchangeId } = await ctx.params;
  const result = await getExchangeView(admin, { exchangeId, personaId: persona.personaId });
  if (!result.ok) {
    const status = result.error === 'not-a-party' ? 403 : result.error === 'exchange not found' ? 404 : 400;
    return NextResponse.json(result, { status, headers: noStore });
  }
  return NextResponse.json(result, { headers: noStore });
}
