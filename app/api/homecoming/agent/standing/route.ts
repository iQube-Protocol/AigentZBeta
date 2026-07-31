/**
 * /api/homecoming/agent/standing — delegate standing: read + admin acceleration.
 *
 * Operator decision 2026-07-12 (grant-gate option (c) + accelerator): the dual
 * grant gate makes L3+ delegation bands EARNED via the delegate's own standing —
 * and admins (high system trust) can ACCELERATE a delegate's standing so tests
 * and drills don't wait on organic production. Same shape as the admin path
 * that lets admins give agents Polity sponsorship without a bound citizen: an
 * explicit, receipted, admin-only act — never a silent bypass of the gate.
 *
 * POST { delegate: <agent_card_slug>, cvs?: number (1–50, default 10) }
 *   → writes an `approval_granted` receipt naming the acceleration, then
 *     accrues through the ONE canonical standing service (delegated lane).
 *     The receipt is written FIRST so every acceleration is attributable.
 * GET  ?delegate=<slug> → the delegate's current standing + earned ceiling.
 *
 * Admin-gated (spine). T2-safe: responses carry the delegate slug, scores,
 * band labels, and receipt id — never a persona identifier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import {
  resolveDelegateAgentId,
  readDelegateStanding,
  accrueDelegateStanding,
} from '@/services/homecoming/delegateStanding';

export const dynamic = 'force-dynamic';

const MAX_ACCELERATION_CVS = 50;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { delegate?: string; cvs?: number };
  const delegate = body.delegate?.trim();
  if (!delegate) return NextResponse.json({ ok: false, error: 'delegate (agent_card_slug) is required' }, { status: 400 });
  const cvs = Math.min(Math.max(Math.round(typeof body.cvs === 'number' ? body.cvs : 10), 1), MAX_ACCELERATION_CVS);

  const agentId = await resolveDelegateAgentId(delegate);
  if (!agentId) {
    return NextResponse.json(
      { ok: false, error: `no seeded RootDID for '${delegate}' — stand the delegate up first` },
      { status: 404 },
    );
  }

  // The acceleration is itself a receipted act — written BEFORE the accrual so
  // every admin boost is attributable in the trail (never a silent bypass).
  const receipt = await createActivityReceipt({
    personaId: persona.personaId,
    activeCartridge: 'agentiq',
    actionType: 'approval_granted',
    summary: `delegate standing accelerated by admin — ${delegate} +${cvs} CVS (testing/acceleration)`,
    contextShared: ['delegate-standing', 'admin-acceleration'],
  }).catch(() => null);
  if (!receipt?.id) {
    return NextResponse.json(
      { ok: false, error: 'acceleration receipt write failed — standing left unchanged (honest: no unreceipted boost)' },
      { status: 502 },
    );
  }

  const standing = await accrueDelegateStanding({
    delegateAgentId: agentId,
    cvs,
    receiptId: receipt.id,
  });

  return NextResponse.json({ ok: standing.accrued, delegate, cvs, receiptId: receipt.id, standing });
}

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });

  const delegate = new URL(req.url).searchParams.get('delegate')?.trim();
  if (!delegate) return NextResponse.json({ ok: false, error: 'delegate query param is required' }, { status: 400 });

  const agentId = await resolveDelegateAgentId(delegate);
  const standing = agentId ? await readDelegateStanding(agentId) : null;
  return NextResponse.json(
    { ok: true, delegate, standing },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
