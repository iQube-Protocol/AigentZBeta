/**
 * /api/invariants/graph — graph traversal surface (CFS-003 §4).
 *
 * GET ?view=field                    — whole-field overview (Observatory Graph):
 *                                       top invariants by standing + their edges
 *     ?root=<id>[,<id>...]           — traversal roots (required unless view=field)
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
import {
  dependencyClosure,
  reasoningPath,
  traverse,
  listInvariants,
  listEdgesForInvariants,
} from '@/services/invariants';
import { INVARIANT_EDGE_TYPES, type InvariantEdgeType } from '@/types/invariants';

export const dynamic = 'force-dynamic';

const MAX_FIELD_NODES = 80;

/**
 * Whole-field overview for the Constitutional Observatory Graph perspective:
 * the top invariants by standing + the edges among them. T1-safe, bounded so the
 * client render stays light.
 */
async function fieldOverview() {
  const invariants = await listInvariants({ limit: MAX_FIELD_NODES });
  const ids = invariants.map((i) => i.id);
  const idSet = new Set(ids);
  const edgesRaw = ids.length > 0 ? await listEdgesForInvariants(ids, 'both').catch(() => []) : [];
  const edges = edgesRaw
    .filter((e) => idSet.has(e.fromInvariantId) && idSet.has(e.toInvariantId))
    .map((e) => ({ id: e.id, from: e.fromInvariantId, to: e.toInvariantId, type: e.edgeType, weight: e.weight }));
  const nodes = invariants.map((i) => ({
    id: i.id,
    seedId: i.seedId,
    namespace: i.namespace,
    semanticType: i.semanticType,
    status: i.status,
    standing: i.standing,
    reach: i.reach,
    label: i.seedId ?? i.id,
    statement: i.statement,
  }));
  return {
    ok: true,
    view: 'field' as const,
    generatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    capped: nodes.length >= MAX_FIELD_NODES,
    nodes,
    edges,
  };
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  // Whole-field overview (Observatory Graph perspective) — no root required.
  if (params.get('view') === 'field') {
    try {
      return NextResponse.json(await fieldOverview());
    } catch (error) {
      console.error('[api/invariants/graph] field overview failed', error);
      return NextResponse.json({ ok: false, error: 'field_overview_failed' }, { status: 500 });
    }
  }

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
