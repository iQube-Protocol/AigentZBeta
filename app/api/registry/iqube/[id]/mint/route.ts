/**
 * POST /api/registry/iqube/[id]/mint
 *
 * Stage 5 C21. Starts (or resumes) a mint saga for the given iqube.
 * Idempotent — if a non-terminal saga already exists for the iqube, the
 * route returns its snapshot instead of creating a duplicate.
 *
 * Admin-gated. Saga driver (services/registry/mintSaga.ts) executes the
 * full state machine; this route just initiates + drives to a stable
 * state (terminal / failure / pending).
 *
 * Authority: handler delegates to mintSaga.ts. Never calls evaluateAccess
 * (mint authority is governance-level, not access-level — covered by the
 * admin gate). Never writes receipts directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { startSaga, driveSagaToCompletion } from '@/services/registry/mintSaga';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const iqubeId = params.id;
  if (!iqubeId) {
    return NextResponse.json({ error: 'iqube_id required' }, { status: 400 });
  }

  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const initial = await startSaga({
      iqube_id: iqubeId,
      initiated_by_persona_id: persona.personaId,
    });
    const final = await driveSagaToCompletion(initial.saga_id);
    return NextResponse.json({
      saga_id: final.saga_id,
      iqube_id: final.iqube_id,
      current_state: final.current_state,
      retry_count: final.retry_count,
      last_error: final.last_error,
      is_terminal: final.is_terminal,
      is_failure: final.is_failure,
      is_pending: final.is_pending,
      idempotency_keys: final.idempotency_keys,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'saga_failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
