/**
 * /api/invariants — the Invariant Service HTTP surface (CFS-003a).
 *
 * GET  — list/filter invariants (any authenticated persona; T1-safe records)
 * POST — discover (create draft) an invariant (admin-gated; Law XI)
 *
 * Spine-gated: clients MUST call via personaFetch (Bearer token required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  discoverInvariant,
  listInvariants,
} from '@/services/invariants';
import {
  INVARIANT_NAMESPACES,
  type InvariantNamespace,
  type InvariantSemanticType,
  type InvariantStatus,
} from '@/types/invariants';

export const dynamic = 'force-dynamic';

function isNamespace(value: unknown): value is InvariantNamespace {
  return typeof value === 'string' && (INVARIANT_NAMESPACES as string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const namespace = params.get('namespace');
  const status = params.get('status');
  const domain = params.get('domain');
  const q = params.get('q');
  const ontologyClassId = params.get('ontology');
  const limit = Number(params.get('limit') ?? 100);

  if (namespace && !isNamespace(namespace)) {
    return NextResponse.json(
      { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const invariants = await listInvariants({
      namespace: (namespace as InvariantNamespace) ?? undefined,
      status: status ? (status.split(',') as InvariantStatus[]) : undefined,
      domain: domain ?? undefined,
      q: q ?? undefined,
      ontologyClassId: ontologyClassId ?? undefined,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return NextResponse.json({ ok: true, count: invariants.length, invariants });
  } catch (error) {
    console.error('[api/invariants] list failed', error);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

interface CreateInvariantBody {
  statement?: string;
  namespace?: string;
  semanticType?: InvariantSemanticType;
  ontologyClassId?: string;
  contexts?: { domain: string; interpretation?: string }[];
  provenance?: Record<string, unknown>;
  reasoningProvenance?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: CreateInvariantBody;
  try {
    body = (await request.json()) as CreateInvariantBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.statement || typeof body.statement !== 'string') {
    return NextResponse.json({ error: 'statement is required (string)' }, { status: 400 });
  }
  if (!isNamespace(body.namespace)) {
    return NextResponse.json(
      { error: `namespace is required and must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const result = await discoverInvariant(
      {
        statement: body.statement,
        namespace: body.namespace,
        semanticType: body.semanticType ?? null,
        ontologyClassId: body.ontologyClassId ?? null,
        provenance: body.provenance ?? { source: 'api', discovered_by: 'operator' },
        reasoningProvenance: body.reasoningProvenance ?? {},
        creatorPersonaId: persona.personaId,
        contexts: body.contexts,
      },
      { personaId: persona.personaId },
    );
    // result carries only T1-safe records (mapper excludes creator_persona_id).
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_failed';
    const status = message.startsWith('duplicate:') ? 409 : 500;
    if (status === 500) console.error('[api/invariants] create failed', error);
    return NextResponse.json({ error: message }, { status });
  }
}
