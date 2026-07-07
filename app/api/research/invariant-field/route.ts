/**
 * /api/research/invariant-field — the Invariant Field Explorer's read surface
 * (CCRL Phase E first slice, CFS-019 §5 item 6).
 *
 * Computational Epistemology made queryable: the `enables / constrains /
 * contradicts` neighbourhood of an invariant, plus the consequence forecast
 * summary that answers "can knowledge compose?" over the LIVE substrate.
 *
 * READ-ONLY. No new write paths. Reuses the real substrate readers
 * (services/invariants/store) and the real forecaster
 * (services/consequence/stages.forecastConsequences) — never reimplements
 * edge SQL.
 *
 * T2-safe payloads: invariant ids / seed ids / statements / edge types /
 * Standing / Reach only. NO personaId, ever (the persona gate authorises the
 * read; it never appears in the response).
 *
 * Spine-gated: clients MUST call via personaFetch (Bearer token required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getInvariantById,
  getInvariantsByIds,
  getInvariantsBySeedIds,
  listEdgesForInvariants,
  listInvariants,
} from '@/services/invariants/store';
import { forecastConsequences } from '@/services/consequence/stages';
import {
  INVARIANT_NAMESPACES,
  type InvariantEdgeType,
  type InvariantNamespace,
  type InvariantRecord,
} from '@/types/invariants';

export const dynamic = 'force-dynamic';

// The three consequence-bearing edge types the field is defined over
// (CFS-006a). Everything else in the graph is out of scope for the forecaster.
const FIELD_EDGE_TYPES: InvariantEdgeType[] = ['enables', 'constrains', 'contradicts'];

function isNamespace(value: unknown): value is InvariantNamespace {
  return typeof value === 'string' && (INVARIANT_NAMESPACES as readonly string[]).includes(value);
}

/** T2-safe projection of an invariant record (no T0 fields — the mapper in
 *  the store already excludes creator_persona_id; we narrow further here). */
function projectInvariant(inv: InvariantRecord) {
  return {
    id: inv.id,
    seedId: inv.seedId,
    statement: inv.statement,
    namespace: inv.namespace,
    status: inv.status,
    standing: inv.standing,
    reach: inv.reach,
  };
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const id = params.get('id');
  const seedId = params.get('seedId');
  const namespace = params.get('namespace');

  if (namespace && !isNamespace(namespace)) {
    return NextResponse.json(
      { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
      { status: 400 },
    );
  }

  // ── Neighbourhood mode: a specific invariant is selected ────────────────
  if (id || seedId) {
    try {
      let focus: InvariantRecord | null = null;
      if (id) {
        focus = await getInvariantById(id);
      } else if (seedId) {
        const bySeed = await getInvariantsBySeedIds([seedId]);
        focus = bySeed[0] ?? null;
      }
      if (!focus) {
        return NextResponse.json({ error: 'invariant_not_found' }, { status: 404 });
      }

      // Edge neighbourhood over the field edge types, both directions.
      const edges = await listEdgesForInvariants([focus.id], 'both', FIELD_EDGE_TYPES);

      // Resolve every endpoint touched by an edge (for readable from → to rows).
      const neighbourIds = new Set<string>();
      for (const e of edges) {
        neighbourIds.add(e.fromInvariantId);
        neighbourIds.add(e.toInvariantId);
      }
      neighbourIds.delete(focus.id);
      const neighbours = neighbourIds.size ? await getInvariantsByIds([...neighbourIds]) : [];
      const byId = new Map<string, InvariantRecord>();
      byId.set(focus.id, focus);
      for (const n of neighbours) byId.set(n.id, n);

      const edgeRows = edges.map((e) => {
        const from = byId.get(e.fromInvariantId);
        const to = byId.get(e.toInvariantId);
        return {
          id: e.id,
          edgeType: e.edgeType,
          weight: e.weight,
          direction: e.fromInvariantId === focus!.id ? ('out' as const) : ('in' as const),
          from: {
            id: e.fromInvariantId,
            seedId: from?.seedId ?? null,
            statement: from?.statement ?? '(unresolved)',
            namespace: from?.namespace ?? null,
          },
          to: {
            id: e.toInvariantId,
            seedId: to?.seedId ?? null,
            statement: to?.statement ?? '(unresolved)',
            namespace: to?.namespace ?? null,
          },
        };
      });

      // The real forecaster — enables/constrains/contradicts counts +
      // forcesEscalation, computed by traversing the live edge graph.
      const forecast = await forecastConsequences([focus.id]);

      return NextResponse.json({
        ok: true,
        mode: 'neighbourhood',
        invariant: projectInvariant(focus),
        edges: edgeRows,
        forecast: {
          enables: forecast.enables,
          constrains: forecast.constrains,
          contradicts: forecast.contradicts,
          forcesEscalation: forecast.forcesEscalation,
          constitutionalConstraint: forecast.constitutionalConstraint,
          nodeCount: forecast.nodes.length,
          rationale: forecast.rationale,
        },
      });
    } catch (error) {
      // Degrade honestly — the substrate may be empty or unreachable.
      console.error('[api/research/invariant-field] neighbourhood failed', error);
      return NextResponse.json({
        ok: true,
        mode: 'neighbourhood',
        invariant: null,
        edges: [],
        forecast: null,
        note: 'invariant field unavailable — the edge substrate is empty or unreachable',
      });
    }
  }

  // ── Overview mode: no seed — compact field summary ──────────────────────
  try {
    const invariants = await listInvariants({
      namespace: namespace ? (namespace as InvariantNamespace) : undefined,
      limit: 500,
    });
    if (invariants.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: 'overview',
        namespaceCounts: [],
        topConnected: [],
        note: 'no invariants match — the substrate is empty for this filter',
      });
    }

    const ids = invariants.map((i) => i.id);
    const byId = new Map<string, InvariantRecord>();
    for (const inv of invariants) byId.set(inv.id, inv);

    // All field edges once (direction 'out' over every id = the full edge set,
    // since each edge's from-endpoint is in the id set).
    const edges = await listEdgesForInvariants(ids, 'out', FIELD_EDGE_TYPES);

    // Per-namespace edge tallies (attributed to the from-invariant's namespace)
    // and degree per invariant (both endpoints count toward degree).
    const nsTally = new Map<
      string,
      { enables: number; constrains: number; contradicts: number }
    >();
    const degree = new Map<string, number>();
    for (const e of edges) {
      const fromNs = byId.get(e.fromInvariantId)?.namespace ?? 'unknown';
      const t = nsTally.get(fromNs) ?? { enables: 0, constrains: 0, contradicts: 0 };
      if (e.edgeType === 'enables') t.enables++;
      else if (e.edgeType === 'constrains') t.constrains++;
      else if (e.edgeType === 'contradicts') t.contradicts++;
      nsTally.set(fromNs, t);
      degree.set(e.fromInvariantId, (degree.get(e.fromInvariantId) ?? 0) + 1);
      degree.set(e.toInvariantId, (degree.get(e.toInvariantId) ?? 0) + 1);
    }

    const namespaceCounts = [...nsTally.entries()]
      .map(([ns, t]) => ({
        namespace: ns,
        enables: t.enables,
        constrains: t.constrains,
        contradicts: t.contradicts,
        total: t.enables + t.constrains + t.contradicts,
      }))
      .sort((a, b) => b.total - a.total);

    const topConnected = [...degree.entries()]
      .map(([invId, d]) => {
        const inv = byId.get(invId);
        return inv ? { ...projectInvariant(inv), degree: d } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 12);

    return NextResponse.json({
      ok: true,
      mode: 'overview',
      totalInvariants: invariants.length,
      totalFieldEdges: edges.length,
      namespaceCounts,
      topConnected,
    });
  } catch (error) {
    console.error('[api/research/invariant-field] overview failed', error);
    return NextResponse.json({
      ok: true,
      mode: 'overview',
      namespaceCounts: [],
      topConnected: [],
      note: 'invariant field unavailable — the edge substrate is empty or unreachable',
    });
  }
}
