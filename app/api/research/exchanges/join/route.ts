/**
 * POST /api/research/exchanges/join — the counterparty's side of a
 * Reciprocal Artifact Exchange invitation (PRD-IRL-AX-001 §13).
 *
 * Composes the existing Passport/persona resolution (getActivePersona) and
 * mirrors the trust model of /api/participation/claim: the code is an
 * unguessable capability string bound to exactly one exchange
 * (reciprocal_exchanges.invite_code_hash), and joining is a HUMAN
 * constitutional act — the caller must already be signed in with a
 * resolved Passport/persona. If they are not yet onboarded, the generic
 * /invite/<code> + Passport apply flow (unrelated to this route) handles
 * that first; this route only binds an ALREADY-resolved persona to the
 * exchange it names.
 *
 * Body: { code }. Response: the exchange (T2-safe view — see
 * getExchangeView; this route returns the raw joined record's public shape
 * only, no artifact content).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { findExchangeByInviteCode, joinExchange, getExchangeView } from '@/services/research/reciprocalExchange';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json(
      { ok: false, error: 'Not authenticated — sign in with your persona to join this exchange' },
      { status: 401, headers: noStore },
    );
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code?.trim()) return NextResponse.json({ ok: false, error: 'code is required' }, { status: 400, headers: noStore });

  const found = await findExchangeByInviteCode(admin, body.code);
  if (!found.ok) return NextResponse.json(found, { status: 404, headers: noStore });

  const joined = await joinExchange(admin, { exchangeId: found.exchange.id, rawCode: body.code, personaId: persona.personaId });
  if (!joined.ok) return NextResponse.json(joined, { status: 400, headers: noStore });

  const view = await getExchangeView(admin, { exchangeId: found.exchange.id, personaId: persona.personaId });
  return NextResponse.json(view.ok ? { ok: true, view: view.view } : joined, { headers: noStore });
}
