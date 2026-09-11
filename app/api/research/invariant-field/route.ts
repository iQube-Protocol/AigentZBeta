/**
 * /api/research/invariant-field — the Invariant Field Explorer's read surface
 * (IRL Phase E first slice, CFS-019 §5 item 6).
 *
 * Computational Epistemology made queryable: the `enables / constrains /
 * contradicts` neighbourhood of an invariant, plus the consequence forecast
 * summary that answers "can knowledge compose?" over the LIVE substrate, and
 * the counterfactual (what-if) projection loop.
 *
 * READ-ONLY. No write paths.
 *
 * SPINE-GATED (this route): clients MUST call via personaFetch (Bearer token
 * required). The persona gate authorises the read; it never appears in the
 * response. The read/projection LOGIC lives in the shared, persona-free module
 * `services/research/invariantFieldQuery` — the public IRL OS route
 * (/api/public/irl/invariant-field) calls the SAME module with no gate
 * (Extend-Don't-Duplicate; the data is T2-safe published canon). This route's
 * only job is the gate + the delegation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  queryInvariantField,
  projectInvariantFieldCounterfactual,
} from '@/services/research/invariantFieldQuery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const result = await queryInvariantField({
    id: params.get('id'),
    seedId: params.get('seedId'),
    namespace: params.get('namespace'),
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const result = await projectInvariantFieldCounterfactual(body);
  return NextResponse.json(result.body, { status: result.status });
}
