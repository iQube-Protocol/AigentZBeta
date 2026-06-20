/**
 * POST /api/mobility/cases/[caseId]/scores
 *
 * On-demand score recomputation for a mobility case.
 * Reads current profile state, runs computeScores, patches the case row.
 * Returns updated scores without requiring a full profile PATCH.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { computeScores } from '@/app/api/mobility/_lib/computeScores';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { caseId: string } }) {
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

    const { data: row } = await admin
      .from('mobility_cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ ok: false, error: 'Case not found' }, { status: 404 });
    }

    const isAdmin = persona.cartridgeFlags?.isAdmin === true;
    if (row.owner_persona_id !== persona.personaId && !isAdmin) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    const scores = computeScores(row);

    const { data: updated, error: updateErr } = await admin
      .from('mobility_cases')
      .update(scores)
      .eq('id', caseId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    return NextResponse.json({ ok: true, scores, case: updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
