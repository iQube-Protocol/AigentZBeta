/**
 * /api/research/invariant-field — the Invariant Field Explorer's read surface
 * (IRL Phase E first slice, CFS-019 §5 item 6).
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
  isFieldEdgeType,
  projectCounterfactual,
  type CounterfactualEdge,
  type Hypothetical,
  type ProposedEdge,
} from '@/services/consequence/counterfactual';
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

// ─────────────────────────────────────────────────────────────────────────
// POST — counterfactual (what-if) projection over the field.
//
// READ-ONLY. This route computes — IN MEMORY — the consequence field a
// hypothetical WOULD produce, and writes NOTHING: no insert, no update, no
// delete, no upsert. It fetches the REAL neighbourhood (read functions only),
// reuses the real forecaster for the live baseline context, and does the
// counterfactual delta in the pure helper (services/consequence/counterfactual).
//
// This is the propose→see-consequences→ratify loop (inv.cybernetics.111):
// the researcher SEES the projected field before anything is ratified.
//
// Body:
//   { mode: 'add-node',    proposedEdges: [{ toInvariantId, edgeType }], invariantId? }
//   { mode: 'remove-edge', invariantId, edgeId }
// ─────────────────────────────────────────────────────────────────────────
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

  const mode = body.mode;
  if (mode !== 'add-node' && mode !== 'remove-edge') {
    return NextResponse.json(
      { error: "mode must be 'add-node' or 'remove-edge'" },
      { status: 400 },
    );
  }

  try {
    if (mode === 'add-node') {
      const raw = Array.isArray(body.proposedEdges) ? body.proposedEdges : [];
      const proposedEdges: ProposedEdge[] = [];
      for (const item of raw) {
        const rec = item as Record<string, unknown>;
        const toInvariantId = rec.toInvariantId;
        const edgeType = rec.edgeType;
        if (typeof toInvariantId !== 'string' || !isFieldEdgeType(edgeType)) {
          return NextResponse.json(
            {
              error:
                'each proposedEdge needs a string toInvariantId and edgeType of enables|constrains|contradicts',
            },
            { status: 400 },
          );
        }
        proposedEdges.push({ toInvariantId, edgeType });
      }
      if (proposedEdges.length === 0) {
        return NextResponse.json(
          { error: 'add-node needs at least one proposedEdge' },
          { status: 400 },
        );
      }

      // The referenced invariants define the field the proposed node lands in.
      const targetIds = [...new Set(proposedEdges.map((e) => e.toInvariantId))];
      const baselineEdges = await listEdgesForInvariants(targetIds, 'both', FIELD_EDGE_TYPES);
      const touchedIds = new Set<string>(targetIds);
      for (const e of baselineEdges) {
        touchedIds.add(e.fromInvariantId);
        touchedIds.add(e.toInvariantId);
      }
      const touched = await getInvariantsByIds([...touchedIds]);

      const hypothetical: Hypothetical = { mode: 'add-node', proposedEdges };
      const projection = projectCounterfactual(
        baselineEdges as CounterfactualEdge[],
        hypothetical,
        touched.map((inv) => ({ id: inv.id, status: inv.status })),
      );

      // Live forecast over the referenced invariants — the real forecaster,
      // for context alongside the pure projection (read-only).
      const forecast = await forecastConsequences(targetIds);

      return NextResponse.json({
        ok: true,
        mode: 'add-node',
        projection,
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
    }

    // ── remove-edge ─────────────────────────────────────────────────────
    const invariantId = body.invariantId;
    const edgeId = body.edgeId;
    if (typeof invariantId !== 'string' || typeof edgeId !== 'string') {
      return NextResponse.json(
        { error: 'remove-edge needs a string invariantId (the focus) and a string edgeId' },
        { status: 400 },
      );
    }

    const focus = await getInvariantById(invariantId);
    if (!focus) {
      return NextResponse.json({ error: 'invariant_not_found' }, { status: 404 });
    }

    const baselineEdges = await listEdgesForInvariants([focus.id], 'both', FIELD_EDGE_TYPES);
    const present = baselineEdges.some((e) => e.id === edgeId);

    const touchedIds = new Set<string>([focus.id]);
    for (const e of baselineEdges) {
      touchedIds.add(e.fromInvariantId);
      touchedIds.add(e.toInvariantId);
    }
    const touched = await getInvariantsByIds([...touchedIds]);

    const hypothetical: Hypothetical = { mode: 'remove-edge', edgeId };
    const projection = projectCounterfactual(
      baselineEdges as CounterfactualEdge[],
      hypothetical,
      touched.map((inv) => ({ id: inv.id, status: inv.status })),
    );

    // Live forecast over the focus invariant — the real forecaster, for context.
    const forecast = await forecastConsequences([focus.id]);

    return NextResponse.json({
      ok: true,
      mode: 'remove-edge',
      projection,
      forecast: {
        enables: forecast.enables,
        constrains: forecast.constrains,
        contradicts: forecast.contradicts,
        forcesEscalation: forecast.forcesEscalation,
        constitutionalConstraint: forecast.constitutionalConstraint,
        nodeCount: forecast.nodes.length,
        rationale: forecast.rationale,
      },
      note: present
        ? undefined
        : 'edge not found in this invariant’s field — projection is a no-op (zero delta)',
    });
  } catch (error) {
    console.error('[api/research/invariant-field] counterfactual failed', error);
    return NextResponse.json({
      ok: true,
      mode,
      projection: null,
      forecast: null,
      note: 'counterfactual projection unavailable — the edge substrate is empty or unreachable',
    });
  }
}
