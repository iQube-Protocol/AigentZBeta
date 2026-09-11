/**
 * /api/invariants/[id]/edges — record a relationship between two invariants
 * (CFS-003 §3 / CFS-003a §2.6). Admin-gated, mirroring `[id]/advance`.
 *
 * GET  — the invariant's edges (both directions) + neighbour summaries.
 * POST — create one edge, or PREVIEW one without writing.
 *
 * ── Why this route exists (audit finding, 2026-08-02; operator ruling) ──────
 *
 * `addEdge()` — the cycle-guarded, quarantine-enforcing edge writer exported
 * from `services/invariants/index.ts` — had **no caller anywhere**. The only
 * edges the platform could produce came as side effects of the discovery
 * pipeline: `promoteCandidate`'s parent linking and `materializeCompressionEdges`,
 * both of which write `specializes` ONLY, both keyed by a discovery-candidate id
 * rather than an invariant id, and neither offering a relation type, a rationale
 * or evidence references.
 *
 * That is not merely inconvenient. Three of the nine Crystal Intrinsic Readiness
 * checks — relationship-density, graph-connectivity, orphan-detection — read
 * `invariant_edges`. A crystal assembled from independently discovered
 * invariants would be **all orphans**, and those three checks would fail with no
 * operator path to fix them. Corpus acquisition would have produced a crystal
 * that could never pass readiness, and the failure would have looked like a
 * defect in the crystal rather than a missing seam.
 *
 * ── This route holds NO rule of its own ────────────────────────────────────
 *
 * Every constraint on an edge lives in `addEdge`:
 *   · the CFS-003 §3 cycle guard for acyclic edge types (`wouldCreateCycle`);
 *   · the CFS-003a §2.6 conflict rule — a `contradicts` edge touching a
 *     canonical invariant quarantines the non-canonical side back to `proposed`
 *     and logs `[INVARIANT CONFLICT]`;
 *   · standing recomputation on the target.
 *
 * The route validates only the SHAPE of the request (ids present and distinct,
 * a declared relation type, a stated rationale) and then calls the service. The
 * preview path calls the SAME exported `wouldCreateCycle` the service uses — it
 * does not re-derive the answer, and it is advisory: the authoritative refusal
 * still happens inside `addEdge` at write time, so a race between preview and
 * confirm cannot slip a cycle through.
 *
 * ── Evidence and attribution ───────────────────────────────────────────────
 *
 * A relationship is a structural CLAIM about the corpus, so it carries a
 * rationale (required — an unexplained edge is a stray click in a graph that
 * three readiness checks read) and optional evidence references. Attribution is
 * the T2-safe `personaPublicRef`, never the raw personaId: `invariant_edges`
 * provenance is durable, widely read and receipt-adjacent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { addEdge, getInvariantById, getInvariantsByIds, listEdgesForInvariants, wouldCreateCycle } from '@/services/invariants';
import { INVARIANT_EDGE_TYPES, type InvariantEdgeType } from '@/types/invariants';

export const dynamic = 'force-dynamic';

function isEdgeType(v: unknown): v is InvariantEdgeType {
  return typeof v === 'string' && (INVARIANT_EDGE_TYPES as readonly string[]).includes(v);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const { id } = await context.params;
  try {
    const edges = await listEdgesForInvariants([id], 'both');
    const neighbourIds = [
      ...new Set(edges.flatMap((e) => [e.fromInvariantId, e.toInvariantId]).filter((n) => n !== id)),
    ];
    const neighbours = neighbourIds.length
      ? (await getInvariantsByIds(neighbourIds)).map((n) => ({
          id: n.id,
          statement: n.statement,
          namespace: n.namespace,
          status: n.status,
        }))
      : [];
    return NextResponse.json({ ok: true, edges, neighbours });
  } catch (error) {
    console.error('[api/invariants/edges] read failed', error);
    return NextResponse.json({ ok: false, error: 'read_failed' }, { status: 500 });
  }
}

interface CreateEdgeBody {
  toInvariantId?: unknown;
  /** The operator's word for the edge type. Validated against CFS-003's list. */
  relation?: unknown;
  rationale?: unknown;
  evidenceRefs?: unknown;
  /** Evaluate and report; write nothing. Default FALSE — POST means write. */
  preview?: unknown;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  // Law XI — humans define semantics. An edge is a semantic claim about the
  // corpus, so it sits behind the same gate as a lifecycle transition.
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  }

  const { id: fromInvariantId } = await context.params;
  let body: CreateEdgeBody;
  try {
    body = (await request.json()) as CreateEdgeBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const toInvariantId = typeof body.toInvariantId === 'string' ? body.toInvariantId.trim() : '';
  if (!toInvariantId) {
    return NextResponse.json({ ok: false, error: 'toInvariantId is required' }, { status: 400 });
  }
  if (toInvariantId === fromInvariantId) {
    return NextResponse.json(
      { ok: false, error: 'an invariant cannot relate to itself — a self-loop is not a relationship' },
      { status: 400 },
    );
  }
  if (!isEdgeType(body.relation)) {
    return NextResponse.json(
      { ok: false, error: `relation must be one of: ${INVARIANT_EDGE_TYPES.join(', ')}` },
      { status: 400 },
    );
  }
  const rationale = typeof body.rationale === 'string' ? body.rationale.trim() : '';
  if (!rationale) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'rationale is required — three readiness checks read this graph, and an unexplained edge is a claim ' +
          'nobody can assess later',
      },
      { status: 400 },
    );
  }
  const evidenceRefs = Array.isArray(body.evidenceRefs)
    ? body.evidenceRefs.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
    : [];

  // Both endpoints must exist. A dangling edge would be counted by the density
  // check and resolve to nothing in every reader.
  const [from, to] = await Promise.all([
    getInvariantById(fromInvariantId).catch(() => null),
    getInvariantById(toInvariantId).catch(() => null),
  ]);
  if (!from) return NextResponse.json({ ok: false, error: `invariant '${fromInvariantId}' not found` }, { status: 404 });
  if (!to) return NextResponse.json({ ok: false, error: `invariant '${toInvariantId}' not found` }, { status: 404 });

  // ADVISORY preview. Calls the same guard the service calls; the service still
  // refuses at write time, so this can never be the only check that ran.
  const cycle = await wouldCreateCycle(fromInvariantId, toInvariantId, body.relation).catch(() => false);
  const quarantineWarning =
    body.relation === 'contradicts' && (from.status === 'canonical' || to.status === 'canonical')
      ? `this contradicts edge touches a canonical invariant — the non-canonical side will be quarantined back ` +
        `to 'proposed' and an operator ratification will be required (CFS-003a §2.6)`
      : null;

  if (body.preview === true) {
    return NextResponse.json({
      ok: true,
      preview: true,
      from: { id: from.id, statement: from.statement, status: from.status },
      to: { id: to.id, statement: to.statement, status: to.status },
      relation: body.relation,
      wouldCreateCycle: cycle,
      quarantineWarning,
      wouldSucceed: !cycle,
      note: 'PREVIEW — nothing was written. The service re-checks every rule at write time.',
    });
  }

  try {
    const edge = await addEdge({
      fromInvariantId,
      toInvariantId,
      edgeType: body.relation,
      rationale,
      provenance: {
        // T2-safe attribution only — `invariant_edges.provenance` is durable and
        // widely read (Identity & Access Spine, T0 rule).
        recordedBy: personaPublicRef(persona.personaId),
        recordedAt: new Date().toISOString(),
        ...(evidenceRefs.length > 0 ? { evidenceRefs } : {}),
      },
    });
    return NextResponse.json({ ok: true, edge, quarantineWarning }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'edge_create_failed';
    // The service's own refusals are the rule speaking — surfaced verbatim.
    const status = message.includes('cycle') ? 409 : 500;
    if (status === 500) console.error('[api/invariants/edges] create failed', error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
