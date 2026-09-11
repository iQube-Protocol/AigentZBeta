/**
 * /api/ontology — the Invariant Ontology surface (CFS-002).
 *
 * GET  — list active ontology classes, optionally by namespace, as a tree
 * POST — create/update a class (admin-gated; extensibility is a
 *        constitutional act, CFS-002 §7)
 *
 * Spine-gated (personaFetch required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listOntologyClasses, upsertOntologyClass } from '@/services/invariants';
import {
  INVARIANT_NAMESPACES,
  type InvariantNamespace,
  type InvariantSemanticType,
  type OntologyClassRecord,
} from '@/types/invariants';

export const dynamic = 'force-dynamic';

interface OntologyTreeNode extends OntologyClassRecord {
  children: OntologyTreeNode[];
}

function buildTree(classes: OntologyClassRecord[]): OntologyTreeNode[] {
  const byId = new Map<string, OntologyTreeNode>(
    classes.map((c) => [c.id, { ...c, children: [] }]),
  );
  const roots: OntologyTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const namespace = request.nextUrl.searchParams.get('namespace');
  if (namespace && !(INVARIANT_NAMESPACES as string[]).includes(namespace)) {
    return NextResponse.json(
      { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const classes = await listOntologyClasses(
      (namespace as InvariantNamespace) ?? undefined,
    );
    return NextResponse.json({ ok: true, count: classes.length, tree: buildTree(classes) });
  } catch (error) {
    console.error('[api/ontology] list failed', error);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

interface CreateClassBody {
  namespace?: string;
  slug?: string;
  name?: string;
  parentId?: string;
  semanticType?: InvariantSemanticType;
  description?: string;
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: CreateClassBody;
  try {
    body = (await request.json()) as CreateClassBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.namespace || !(INVARIANT_NAMESPACES as string[]).includes(body.namespace)) {
    return NextResponse.json(
      { error: `namespace is required and must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }
  if (!body.slug || !body.name) {
    return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
  }

  try {
    const ontologyClass = await upsertOntologyClass({
      namespace: body.namespace as InvariantNamespace,
      slug: body.slug,
      name: body.name,
      parentId: body.parentId ?? null,
      semanticType: body.semanticType ?? null,
      description: body.description ?? null,
    });
    return NextResponse.json({ ok: true, class: ontologyClass }, { status: 201 });
  } catch (error) {
    console.error('[api/ontology] upsert failed', error);
    return NextResponse.json({ error: 'upsert_failed' }, { status: 500 });
  }
}
