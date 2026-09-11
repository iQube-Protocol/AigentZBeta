/**
 * /api/research/objects — persisted research objects (CFS-019 Phase C2.2).
 *
 * GET  — list the durable lab record (approved experiments / findings /
 *        publications). Admin-gated exactly like /api/research/lifecycle.
 * POST — persist an APPROVED copilot proposal. The server NEVER trusts the
 *        client-shaped object: it re-runs the pure applyResearchProposal
 *        (same coercion, same lifecycle-legality gate) against the PERSISTED
 *        state, enforces the T2-safety guard (findForbiddenIdentifierKey —
 *        any payload carrying a T0 identifier key is rejected), then upserts
 *        on (object_kind, object_id).
 *
 * ONE receipt path (services/research/lifecycle):
 *  - protocol_draft (a lifecycle TRANSITION designed → protocol-ratified) is
 *    receipted via recordExperimentTransition — the SAME path as
 *    operator-initiated transitions, never a parallel one.
 *  - create-kind proposals (experiment_proposal / finding / publication_draft)
 *    are receipted via recordResearchObjectCreated, which composes the same
 *    receipt constructor — creation is the entry transition.
 *
 * T0 discipline: persona.personaId is used server-side for the receipt call
 * exactly as /api/research/lifecycle does — it is never echoed in responses,
 * never stored in research_objects (the table has no identity columns).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  listResearchObjects,
  recordExperimentTransition,
  recordResearchObjectCreated,
  upsertResearchObject,
  type ResearchObjectKind,
} from '@/services/research/lifecycle';
import {
  applyResearchProposal,
  findForbiddenIdentifierKey,
  RESEARCH_PROPOSAL_EFFECT,
  type ResearchProposal,
  type ResearchProposalKind,
  type ResearchProposalState,
} from '@/services/research/proposals';
import type {
  ExperimentLifecycleState,
  ResearchExperiment,
  ResearchFinding,
  ResearchPublication,
} from '@/types/research';

export const dynamic = 'force-dynamic';

const PROPOSAL_KINDS: readonly string[] = [
  'experiment_proposal',
  'protocol_draft',
  'finding',
  'publication_draft',
];

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const result = await listResearchObjects();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
  }
  return NextResponse.json({ ok: true, objects: result.objects });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { kind?: string; proposal?: { summary?: string; data?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const kind =
    typeof body.kind === 'string' && PROPOSAL_KINDS.includes(body.kind)
      ? (body.kind as ResearchProposalKind)
      : null;
  const data = body.proposal?.data;
  if (!kind || !data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ ok: false, error: 'kind and proposal.data required' }, { status: 400 });
  }

  // T2 gate on the raw client payload BEFORE it touches anything else.
  const forbiddenRaw = findForbiddenIdentifierKey(data);
  if (forbiddenRaw) {
    return NextResponse.json(
      { ok: false, error: `t2_unsafe: payload carries forbidden identifier key '${forbiddenRaw}'` },
      { status: 400 },
    );
  }

  const proposal: ResearchProposal = {
    kind,
    summary: typeof body.proposal?.summary === 'string' && body.proposal.summary ? body.proposal.summary : kind,
    data: data as Record<string, unknown>,
  };

  // Seed the server-side state from the PERSISTED record — lifecycle legality
  // is checked against what is actually stored, never client-claimed state.
  const listed = await listResearchObjects();
  if (!listed.ok) {
    return NextResponse.json({ ok: false, error: listed.error }, { status: 503 });
  }
  const state: ResearchProposalState = {
    experiments: [],
    findings: [],
    publications: [],
    updatedAt: new Date().toISOString(),
  };
  for (const row of listed.objects) {
    if (row.objectKind === 'experiment') {
      state.experiments.push({
        experiment: row.payload as unknown as ResearchExperiment,
        lifecycle: row.lifecycleState as ExperimentLifecycleState,
      });
    } else if (row.objectKind === 'finding') {
      state.findings.push(row.payload as unknown as ResearchFinding);
    } else {
      state.publications.push(row.payload as unknown as ResearchPublication);
    }
  }

  // Re-run the PURE apply server-side (same coercion + legality as the tab).
  const applied = applyResearchProposal(state, proposal);
  if (!applied.committed) {
    return NextResponse.json({ ok: false, error: applied.rejection ?? 'proposal rejected' }, { status: 400 });
  }

  // The created/advanced object is the entry apply replaced or appended —
  // untouched entries keep their reference, changed ones are fresh objects.
  const effect = RESEARCH_PROPOSAL_EFFECT[kind];
  let objectKind: ResearchObjectKind;
  let objectId: string;
  let payload: Record<string, unknown>;
  let lifecycleState: string;
  let governingInvariants: string[];
  if (effect.object === 'experiment') {
    const entry = applied.state.experiments.find((e) => !state.experiments.includes(e));
    if (!entry) return NextResponse.json({ ok: false, error: 'apply produced no object' }, { status: 500 });
    objectKind = 'experiment';
    objectId = entry.experiment.id;
    payload = entry.experiment as unknown as Record<string, unknown>;
    lifecycleState = entry.lifecycle;
    governingInvariants = entry.experiment.governingInvariants;
  } else if (effect.object === 'finding') {
    const entry = applied.state.findings.find((f) => !state.findings.includes(f));
    if (!entry) return NextResponse.json({ ok: false, error: 'apply produced no object' }, { status: 500 });
    objectKind = 'finding';
    objectId = entry.id;
    payload = entry as unknown as Record<string, unknown>;
    lifecycleState = entry.lifecycle;
    governingInvariants = entry.governingInvariants;
  } else {
    const entry = applied.state.publications.find((p) => !state.publications.includes(p));
    if (!entry) return NextResponse.json({ ok: false, error: 'apply produced no object' }, { status: 500 });
    objectKind = 'publication';
    objectId = entry.id;
    payload = entry as unknown as Record<string, unknown>;
    lifecycleState = entry.lifecycle;
    governingInvariants = [];
  }

  // Belt over braces: the COERCED payload must be T2-safe too.
  const forbiddenCoerced = findForbiddenIdentifierKey(payload);
  if (forbiddenCoerced) {
    return NextResponse.json(
      { ok: false, error: `t2_unsafe: payload carries forbidden identifier key '${forbiddenCoerced}'` },
      { status: 400 },
    );
  }

  const persisted = await upsertResearchObject({ objectKind, objectId, payload, lifecycleState });
  if (!persisted.ok) {
    return NextResponse.json({ ok: false, error: persisted.error }, { status: 503 });
  }

  // Receipt — ONE path, services/research/lifecycle.
  const d = proposal.data;
  let receipt: { ok: boolean; error?: string; receiptId?: string | null };
  if (kind === 'protocol_draft') {
    const from =
      state.experiments.find((e) => e.experiment.id === objectId)?.lifecycle ??
      (effect.fromState as ExperimentLifecycleState);
    receipt = await recordExperimentTransition({
      personaId: persona.personaId,
      experimentId: objectId,
      from,
      to: effect.toState as ExperimentLifecycleState,
      evidence:
        typeof d.evidence === 'string' && d.evidence.trim() ? d.evidence : proposal.summary,
      fallbackExperiment: payload as unknown as ResearchExperiment,
    });
  } else {
    receipt = await recordResearchObjectCreated({
      personaId: persona.personaId,
      objectKind,
      objectId,
      entryState: lifecycleState,
      summary: proposal.summary,
      governingInvariants,
    });
  }

  if (receipt.ok && receipt.receiptId) {
    await upsertResearchObject({
      objectKind,
      objectId,
      payload,
      lifecycleState,
      receiptId: receipt.receiptId,
    });
  }

  return NextResponse.json({
    ok: true,
    objectKind,
    objectId,
    lifecycleState,
    receiptId: receipt.receiptId ?? null,
    ...(receipt.ok ? {} : { receiptError: receipt.error ?? 'receipt write failed' }),
  });
}
