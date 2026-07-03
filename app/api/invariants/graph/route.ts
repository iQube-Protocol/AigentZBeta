/**
 * /api/invariants/graph — graph traversal surface (CFS-003 §4).
 *
 * GET ?root=<id>[,<id>...]           — traversal roots (required)
 *     &edges=<type>[,<type>...]      — edge-type filter
 *     &direction=out|in|both         — default out
 *     &depth=N                       — default 4, cap 8
 *     &domain=<context-domain>       — context-scoped filter
 *     &path=reasoning                — reasoning path preset (explainability)
 *     &path=dependencies             — dependency closure preset
 *
 * Spine-gated (personaFetch required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { dependencyClosure, reasoningPath, traverse } from '@/services/invariants';
import { INVARIANT_EDGE_TYPES, type InvariantEdgeType } from '@/types/invariants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const roots = (params.get('root') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (roots.length === 0) {
    return NextResponse.json({ error: 'root is required (invariant id[,id...])' }, { status: 400 });
  }

  const preset = params.get('path');
  const domain = params.get('domain') ?? undefined;

  try {
    if (preset === 'reasoning') {
      return NextResponse.json({ ok: true, result: await reasoningPath(roots[0]) });
    }
    if (preset === 'dependencies') {
      return NextResponse.json({ ok: true, result: await dependencyClosure(roots, domain) });
    }

    const edgeTypesRaw = params.get('edges');
    let edgeTypes: InvariantEdgeType[] | undefined;
    if (edgeTypesRaw) {
      const parsed = edgeTypesRaw.split(',').map((s) => s.trim());
      const invalid = parsed.filter((t) => !(INVARIANT_EDGE_TYPES as string[]).includes(t));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `unknown edge types: ${invalid.join(', ')}` },
          { status: 400 },
        );
      }
      edgeTypes = parsed as InvariantEdgeType[];
    }

    const directionRaw = params.get('direction') ?? 'out';
    if (!['out', 'in', 'both'].includes(directionRaw)) {
      return NextResponse.json({ error: 'direction must be out|in|both' }, { status: 400 });
    }

    const result = await traverse(roots, {
      edgeTypes,
      direction: directionRaw as 'out' | 'in' | 'both',
      maxDepth: Number(params.get('depth') ?? 4),
      contextDomain: domain,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[api/invariants/graph] traversal failed', error);
    return NextResponse.json({ error: 'traversal_failed' }, { status: 500 });
  }
}
