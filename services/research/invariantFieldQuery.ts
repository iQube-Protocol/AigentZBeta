/**
 * invariantFieldQuery — the shared, READ-ONLY core of the Invariant Field
 * Explorer's query surface (extracted 2026-07-17 from
 * app/api/research/invariant-field/route.ts so the spine-gated route and the
 * public IRL OS route call ONE module — Extend-Don't-Duplicate).
 *
 * Neither function resolves a persona or writes anything: they reuse the real
 * substrate readers (services/invariants/store) and the real forecaster
 * (services/consequence/stages.forecastConsequences), and compute the
 * counterfactual delta in the pure helper (services/consequence/counterfactual).
 * The persona GATE stays in the gated route (untouched); the public route
 * calls these with no gate. T2-safe by construction — invariant ids / seed
 * ids / statements / edge types / Standing / Reach only, NEVER a personaId.
 *
 * Each function returns `{ status, body }` so the caller does exactly
 * `NextResponse.json(result.body, { status: result.status })`.
 */

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

export interface FieldQueryResult {
  status: number;
  body: Record<string, unknown>;
}

// The three consequence-bearing edge types the field is defined over
// (CFS-006a). Everything else in the graph is out of scope for the forecaster.
const FIELD_EDGE_TYPES: InvariantEdgeType[] = ['enables', 'constrains', 'contradicts'];

function isNamespace(value: unknown): value is InvariantNamespace {
  return typeof value === 'string' && (INVARIANT_NAMESPACES as readonly string[]).includes(value);
}

/** T2-safe projection of an invariant record (no T0 fields). */
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

/**
 * GET core — neighbourhood mode (id/seedId given) or overview mode (neither).
 * Read-only; degrades honestly when the substrate is empty/unreachable.
 */
export async function queryInvariantField(input: {
  id?: string | null;
  seedId?: string | null;
  namespace?: string | null;
}): Promise<FieldQueryResult> {
  const { id, seedId, namespace } = input;

  if (namespace && !isNamespace(namespace)) {
    return {
      status: 400,
      body: { error: `namespace must be one of: ${INVARIANT_NAMESPACES.join(', ')}` },
    };
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
        return { status: 404, body: { error: 'invariant_not_found' } };
      }

      const edges = await listEdgesForInvariants([focus.id], 'both', FIELD_EDGE_TYPES);

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

      const forecast = await forecastConsequences([focus.id]);

      return {
        status: 200,
        body: {
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
        },
      };
    } catch (error) {
      console.error('[invariantFieldQuery] neighbourhood failed', error);
      return {
        status: 200,
        body: {
          ok: true,
          mode: 'neighbourhood',
          invariant: null,
          edges: [],
          forecast: null,
          note: 'invariant field unavailable — the edge substrate is empty or unreachable',
        },
      };
    }
  }

  // ── Overview mode: no seed — compact field summary ──────────────────────
  try {
    const invariants = await listInvariants({
      namespace: namespace ? (namespace as InvariantNamespace) : undefined,
      limit: 500,
    });
    if (invariants.length === 0) {
      return {
        status: 200,
        body: {
          ok: true,
          mode: 'overview',
          namespaceCounts: [],
          topConnected: [],
          note: 'no invariants match — the substrate is empty for this filter',
        },
      };
    }

    const ids = invariants.map((i) => i.id);
    const byId = new Map<string, InvariantRecord>();
    for (const inv of invariants) byId.set(inv.id, inv);

    const edges = await listEdgesForInvariants(ids, 'out', FIELD_EDGE_TYPES);

    const nsTally = new Map<string, { enables: number; constrains: number; contradicts: number }>();
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

    return {
      status: 200,
      body: {
        ok: true,
        mode: 'overview',
        totalInvariants: invariants.length,
        totalFieldEdges: edges.length,
        namespaceCounts,
        topConnected,
      },
    };
  } catch (error) {
    console.error('[invariantFieldQuery] overview failed', error);
    return {
      status: 200,
      body: {
        ok: true,
        mode: 'overview',
        namespaceCounts: [],
        topConnected: [],
        note: 'invariant field unavailable — the edge substrate is empty or unreachable',
      },
    };
  }
}

/**
 * POST core — counterfactual (what-if) projection. READ-ONLY: computes the
 * consequence field a hypothetical WOULD produce, in memory, writing nothing
 * (no insert/update/delete/upsert). The propose→see-consequences→ratify loop
 * (inv.cybernetics.111) made queryable without mutating the substrate.
 */
export async function projectInvariantFieldCounterfactual(
  body: Record<string, unknown>,
): Promise<FieldQueryResult> {
  const mode = body.mode;
  if (mode !== 'add-node' && mode !== 'remove-edge') {
    return { status: 400, body: { error: "mode must be 'add-node' or 'remove-edge'" } };
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
          return {
            status: 400,
            body: {
              error:
                'each proposedEdge needs a string toInvariantId and edgeType of enables|constrains|contradicts',
            },
          };
        }
        proposedEdges.push({ toInvariantId, edgeType });
      }
      if (proposedEdges.length === 0) {
        return { status: 400, body: { error: 'add-node needs at least one proposedEdge' } };
      }

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

      const forecast = await forecastConsequences(targetIds);

      return {
        status: 200,
        body: {
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
        },
      };
    }

    // ── remove-edge ─────────────────────────────────────────────────────
    const invariantId = body.invariantId;
    const edgeId = body.edgeId;
    if (typeof invariantId !== 'string' || typeof edgeId !== 'string') {
      return {
        status: 400,
        body: { error: 'remove-edge needs a string invariantId (the focus) and a string edgeId' },
      };
    }

    const focus = await getInvariantById(invariantId);
    if (!focus) {
      return { status: 404, body: { error: 'invariant_not_found' } };
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

    const forecast = await forecastConsequences([focus.id]);

    return {
      status: 200,
      body: {
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
      },
    };
  } catch (error) {
    console.error('[invariantFieldQuery] counterfactual failed', error);
    return {
      status: 200,
      body: {
        ok: true,
        mode,
        projection: null,
        forecast: null,
        note: 'counterfactual projection unavailable — the edge substrate is empty or unreachable',
      },
    };
  }
}
