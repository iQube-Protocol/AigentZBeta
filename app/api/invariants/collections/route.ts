/**
 * /api/invariants/collections — Invariant Collections (CFS-001 §1, Level 2).
 *
 * GET  — list active collections (any authenticated persona)
 * POST — create a collection, optionally with inline member ids (admin)
 *
 * Spine-gated (personaFetch required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { createCollection, listCollections } from '@/services/invariants';
import { INVARIANT_NAMESPACES, type InvariantNamespace } from '@/types/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const namespace = request.nextUrl.searchParams.get('namespace');
  if (namespace && !(INVARIANT_NAMESPACES as string[]).includes(namespace)) {
    return NextResponse.json(
      { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const collections = await listCollections((namespace as InvariantNamespace) ?? undefined);
    return NextResponse.json({ ok: true, count: collections.length, collections });
  } catch (error) {
    console.error('[api/invariants/collections] list failed', error);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

interface CreateBody {
  name?: string;
  slug?: string;
  namespace?: string;
  description?: string;
  memberInvariantIds?: string[];
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required (string)' }, { status: 400 });
  }
  if (body.namespace && !(INVARIANT_NAMESPACES as string[]).includes(body.namespace)) {
    return NextResponse.json(
      { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const collection = await createCollection({
      name: body.name,
      slug: body.slug,
      namespace: (body.namespace as InvariantNamespace) ?? null,
      description: body.description ?? null,
      curatorPersonaId: persona.personaId,
      curatorAliasCommitment: null,
      memberInvariantIds: body.memberInvariantIds,
    });
    return NextResponse.json({ ok: true, collection }, { status: 201 });
  } catch (error) {
    console.error('[api/invariants/collections] create failed', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
