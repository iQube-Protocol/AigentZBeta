/**
 * /api/invariants/[id]/consequence — evolution events (CFS-003a §2.5).
 *
 * POST { outcome: 'confirmed' | 'contradicted', note?: string }
 *
 * Records an observed consequence against an invariant: adjusts confidence,
 * bumps the validation-class accumulators, and recomputes Standing (Law XII —
 * validation axis only; Reach is untouched by this event). This is the manual
 * evidence-entry surface for validation events that arrive OUTSIDE the
 * consequence runner — e.g. EXP-001's evaluation protocol, where a consistent,
 * hallucination-free answer across all artifacts is a validation event for its
 * cited invariants ("the evaluator just validated the compression").
 *
 * Admin-gated (Law XI — evidence ratification is a human act). Mirrors the
 * sibling advance route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { recordConsequence } from '@/services/invariants';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { outcome?: string; note?: string };
  try {
    body = (await request.json()) as { outcome?: string; note?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.outcome !== 'confirmed' && body.outcome !== 'contradicted') {
    return NextResponse.json(
      { error: "outcome must be 'confirmed' or 'contradicted'" },
      { status: 400 },
    );
  }

  try {
    const invariant = await recordConsequence(id, body.outcome, {
      note: typeof body.note === 'string' ? body.note.slice(0, 500) : undefined,
    });
    return NextResponse.json({ ok: true, invariant });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'consequence_failed';
    const status = message === 'invariant not found' ? 404 : 500;
    if (status === 500) console.error('[api/invariants/consequence] failed', error);
    return NextResponse.json({ error: message }, { status });
  }
}
