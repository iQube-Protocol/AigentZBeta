/**
 * /api/registry/invariant-qube — InvariantQube publication (CFS-004 §3, CFS-005).
 *
 * GET  — list published InvariantQubes, ranked by aggregate standing
 * POST — { collectionId, title? } publish a collection as an InvariantQube (admin)
 *
 * Publishing registers a DataQube in the registry (Stage 1) and emits a
 * DVN-anchorable invariant_qube_published receipt. Spine-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listInvariantQubes, publishInvariantQube } from '@/services/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const invariantQubes = await listInvariantQubes();
    return NextResponse.json({ ok: true, count: invariantQubes.length, invariantQubes });
  } catch (error) {
    console.error('[api/registry/invariant-qube] list failed', error);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

interface PublishBody {
  collectionId?: string;
  title?: string;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.collectionId) {
    return NextResponse.json({ error: 'collectionId is required' }, { status: 400 });
  }

  try {
    const result = await publishInvariantQube({
      collectionId: body.collectionId,
      title: body.title,
      actor: { personaId: persona.personaId },
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'publish_failed';
    const status = message.startsWith('incoherent:')
      ? 409
      : message.includes('not found') || message.includes('empty collection')
        ? 400
        : 500;
    if (status === 500) console.error('[api/registry/invariant-qube] publish failed', error);
    return NextResponse.json({ error: message }, { status });
  }
}
