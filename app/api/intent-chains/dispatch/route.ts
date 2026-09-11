/**
 * POST /api/intent-chains/dispatch — start a new intent chain from a CTA.
 *
 * Spec §7 + §6.5 (Q¢ check) + §6.6 (Factory Ingestion).
 *
 * Auth: spine — any signed-in persona that can see the originating CTA.
 * The orchestrator (aigentMe + its server-side delegate) is the authority
 * here; per-step actor authorization is handled by the advancer.
 *
 * Body:
 *   {
 *     template_id: string,
 *     initiating_nbe_id?: string,
 *     nbe_seed?: Record<string, unknown>,    // $nbe.X resolves to this
 *     context_seed?: Record<string, unknown>,// initial $chain.X values
 *     cartridge?: string,                    // workspace filter scope
 *   }
 *
 * Returns: { chain_id, template_id, template_version, status,
 *            current_step_id, current_step_kind, cost_qc, dispatch_hint }
 *
 * Errors: 401/403 on auth; 404 template_not_found; 422 on scope/nbe
 *         guards; 503 storage_unavailable; 500 on persist failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { dispatchChain, DispatchError, type DispatchInput } from '@/services/intentChains/dispatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let body: DispatchInput;
  try {
    body = (await request.json()) as DispatchInput;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (
    (!body?.template_id || typeof body.template_id !== 'string') &&
    (!body?.initiating_nbe_id || typeof body.initiating_nbe_id !== 'string')
  ) {
    return NextResponse.json(
      { error: 'template_id_or_initiating_nbe_id_required' },
      { status: 400 },
    );
  }

  try {
    const result = await dispatchChain(persona, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DispatchError) {
      const status =
        err.code === 'template_not_found' ? 404
        : err.code === 'cartridge_scope_mismatch' || err.code === 'nbe_not_authorized' ? 422
        : err.code === 'chain_spend_denied' ? 402
        : err.code === 'storage_unavailable' ? 503
        : err.code === 'unknown_step_kind' ? 400
        : 500;
      return NextResponse.json({ error: err.code, detail: err.detail }, { status });
    }
    return NextResponse.json({ error: 'internal_error', detail: (err as Error).message }, { status: 500 });
  }
}
