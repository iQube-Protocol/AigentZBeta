/**
 * GET /api/mobility/cases/[caseId]/locker-ref
 *
 * Returns a T2-safe locker reference for a mobility case.
 * The caseId is a T0 identifier and must never appear in locker item
 * display names, DVN receipts, or Walrus blob metadata.
 *
 * This endpoint computes a deterministic SHA-256 commitment:
 *   lockerRef = sha256('hms:locker:' + caseId).hex().slice(0, 16)
 *
 * The client uses this opaque ref as the locker tag prefix. It is:
 *   - Deterministic: same caseId always yields the same ref
 *   - One-way: the ref cannot be reversed to the caseId
 *   - T2-safe: suitable for DVN receipt payloads and chain metadata
 *
 * T0 discipline: caseId is used server-side only. Never serialised
 * into the response beyond the hash output.
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { caseId: string } }) {
  try {
    const { caseId } = params;

    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 500 });
    }

    // Verify caller has access to this case (owner or admin)
    const { data: row } = await admin
      .from('mobility_cases')
      .select('id, owner_persona_id')
      .eq('id', caseId)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });
    }

    const isAdmin = persona.cartridgeFlags?.isAdmin === true;
    if (row.owner_persona_id !== persona.personaId && !isAdmin) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Compute T2-safe commitment — caseId never leaves this function
    const lockerRef = createHash('sha256')
      .update('hms:locker:' + caseId)
      .digest('hex')
      .slice(0, 16);

    return NextResponse.json({ ok: true, lockerRef });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
