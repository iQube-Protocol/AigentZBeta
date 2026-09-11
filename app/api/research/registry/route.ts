/**
 * /api/research/registry — the Experiment / Constitutional / Invariant
 * Registry + Research Backlog (CFS-051, Strand 1 build 2026-07-24).
 *
 * GET  — list all four registers (candidate experiments, candidate
 *        constitutional principles, candidate structural invariants,
 *        research backlog). Requires the `read` capability.
 * POST — action-based, each action mapped to ONE capability:
 *   { action: 'create', kind, fields }              → `propose`
 *   { action: 'edit', kind, id, patch }              → `curate`
 *   { action: 'transition-status', kind, id, status } → `curate`
 *   { action: 'add-review', kind, id, note, disposition } → `curate`
 *        (appends a review-history entry; reviewerRef derived server-side, T2-safe)
 *
 * ── Capabilities, not roles (CFS-051 gate widening, 2026-07-25) ─────────────
 *
 * All three capabilities resolve through the ONE gate module
 * (services/research/registryAccess.ts) — this route contains no access logic
 * of its own and the CRUD service (registryStore.ts) contains none either.
 * `read`/`propose` admit a platform admin, a CAS `research-lab` grant holder,
 * or a holder of the operator-configured gate token; `curate` remains PLATFORM
 * ADMIN ONLY, because the operator's widening framing was specifically to
 * "enable public users to propose". See the gate module's header.
 *
 * Gating mirrors /api/constitutional/capability-registry: 503 on identity-
 * spine timeout, 401 unauthenticated, 403 when the gate refuses.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { resolveRegistryAccess, type RegistryAccessDecision } from '@/services/research/registryAccess';
import {
  listCandidateExperiments,
  createCandidateExperiment,
  listCandidatePrinciples,
  createCandidatePrinciple,
  listCandidateInvariants,
  createCandidateInvariant,
  listBacklogItems,
  createBacklogItem,
  transitionRegistryStatus,
  addRegistryReviewNote,
  editRegistryItem,
} from '@/services/research/registryStore';
import type { RegistryKind } from '@/types/researchRegistry';

export const dynamic = 'force-dynamic';

type RegistryCapability = 'read' | 'propose' | 'curate';

/**
 * Resolve the caller ONCE (spine persona + registry capabilities). Deliberately
 * does not decide: POST must parse its body to learn which capability the
 * requested action needs, and resolving twice could — in principle — observe two
 * different answers. One resolution, one decision source.
 */
async function resolveCaller(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return { error: NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 }) };
  }
  if (pr.status === 'unauthenticated') {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  return { persona: pr.persona, access: await resolveRegistryAccess(pr.persona) };
}

function allows(access: RegistryAccessDecision, need: RegistryCapability): boolean {
  return need === 'read' ? access.canRead : need === 'propose' ? access.canPropose : access.canCurate;
}

/** 403 naming the capability that was missing, so the tab can render the right
 *  affordances (propose-only callers get the create form, not the editors).
 *  T1-safe: capability booleans and path labels only, never an identifier. */
function forbidden(need: RegistryCapability, access: RegistryAccessDecision) {
  return NextResponse.json(
    {
      error: 'forbidden',
      need,
      capabilities: { read: access.canRead, propose: access.canPropose, curate: access.canCurate },
    },
    { status: 403 },
  );
}

/** Which capability each POST action requires. The ONE place the action→
 *  capability mapping lives; adding an action means adding a row here. */
const ACTION_CAPABILITY: Record<string, RegistryCapability> = {
  'create': 'propose',
  'edit': 'curate',
  'transition-status': 'curate',
  'add-review': 'curate',
};

function isRegistryKind(v: unknown): v is RegistryKind {
  return v === 'experiment' || v === 'principle' || v === 'invariant' || v === 'backlog';
}

export async function GET(request: NextRequest) {
  const g = await resolveCaller(request);
  if ('error' in g) return g.error;
  if (!allows(g.access, 'read')) return forbidden('read', g.access);

  const [experiments, principles, invariants, backlog] = await Promise.all([
    listCandidateExperiments(),
    listCandidatePrinciples(),
    listCandidateInvariants(),
    listBacklogItems(),
  ]);
  // Capabilities travel with the payload so the tab renders exactly the
  // affordances the caller actually has, instead of guessing from isAdmin.
  return NextResponse.json({
    ok: true,
    experiments,
    principles,
    invariants,
    backlog,
    capabilities: { read: g.access.canRead, propose: g.access.canPropose, curate: g.access.canCurate },
    accessVia: g.access.via,
  });
}

export async function POST(request: NextRequest) {
  const g = await resolveCaller(request);
  if ('error' in g) return g.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'action required: create | edit | transition-status | add-review' },
      { status: 400 },
    );
  }

  // Capability check happens HERE — after the action is known, before any
  // store call. Every branch below is unreachable without the right capability.
  const need = ACTION_CAPABILITY[body.action];
  if (!need) {
    return NextResponse.json({ ok: false, error: `unknown action "${String(body.action)}"` }, { status: 400 });
  }
  if (!allows(g.access, need)) return forbidden(need, g.access);

  if (body.action === 'create') {
    const kind = body.kind;
    // GATE-BYPASS GUARD (found while widening, 2026-07-25): `create` accepts a
    // client-supplied `status`. Before the widening every caller was an admin,
    // so it was harmless; now a propose-only caller could have created a row
    // already at `published` / `promoted` / `ratified` / `canonized` — the exact
    // transitions the `curate` capability exists to withhold. A non-curator's
    // status is dropped, so the store applies its own default (`proposed` /
    // `candidate` / `backlog`) and every advance must go through
    // `transition-status`, which is curate-gated.
    const requestedStatus = (f: Record<string, unknown>) =>
      g.access.canCurate && typeof f.status === 'string' ? (f.status as never) : undefined;
    if (kind === 'experiment') {
      const fields = (body.fields ?? {}) as Record<string, unknown>;
      const result = await createCandidateExperiment({
        title: String(fields.title ?? ''),
        hypothesis: String(fields.hypothesis ?? ''),
        family: typeof fields.family === 'string' ? fields.family : undefined,
        layer: fields.layer === 'I' || fields.layer === 'II' || fields.layer === 'III' ? fields.layer : undefined,
        seriesId: typeof fields.seriesId === 'string' ? fields.seriesId : undefined,
        charterRef: typeof fields.charterRef === 'string' ? fields.charterRef : undefined,
        status: requestedStatus(fields),
        governingInvariants: Array.isArray(fields.governingInvariants) ? (fields.governingInvariants as string[]) : undefined,
        dependsOn: Array.isArray(fields.dependsOn) ? (fields.dependsOn as string[]) : undefined,
        sourceNote: typeof fields.sourceNote === 'string' ? fields.sourceNote : undefined,
      });
      if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
      return NextResponse.json({ ok: true, item: result.item });
    }
    if (kind === 'principle') {
      const fields = (body.fields ?? {}) as Record<string, unknown>;
      const result = await createCandidatePrinciple({
        statement: String(fields.statement ?? ''),
        rationale: typeof fields.rationale === 'string' ? fields.rationale : undefined,
        status: requestedStatus(fields),
        dependsOn: Array.isArray(fields.dependsOn) ? (fields.dependsOn as string[]) : undefined,
        charterRef: typeof fields.charterRef === 'string' ? fields.charterRef : undefined,
        sourceNote: typeof fields.sourceNote === 'string' ? fields.sourceNote : undefined,
      });
      if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
      return NextResponse.json({ ok: true, item: result.item });
    }
    if (kind === 'invariant') {
      const fields = (body.fields ?? {}) as Record<string, unknown>;
      const result = await createCandidateInvariant({
        statement: String(fields.statement ?? ''),
        namespace: typeof fields.namespace === 'string' ? fields.namespace : undefined,
        rationale: typeof fields.rationale === 'string' ? fields.rationale : undefined,
        status: requestedStatus(fields),
        dependsOn: Array.isArray(fields.dependsOn) ? (fields.dependsOn as string[]) : undefined,
        sourceNote: typeof fields.sourceNote === 'string' ? fields.sourceNote : undefined,
      });
      if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
      return NextResponse.json({ ok: true, item: result.item });
    }
    if (kind === 'backlog') {
      const fields = (body.fields ?? {}) as Record<string, unknown>;
      const result = await createBacklogItem({
        title: String(fields.title ?? ''),
        description: typeof fields.description === 'string' ? fields.description : undefined,
        priority: fields.priority === 'low' || fields.priority === 'medium' || fields.priority === 'high' ? fields.priority : undefined,
        status: requestedStatus(fields),
        linkedExperimentIds: Array.isArray(fields.linkedExperimentIds) ? (fields.linkedExperimentIds as string[]) : undefined,
        linkedHypothesisIds: Array.isArray(fields.linkedHypothesisIds) ? (fields.linkedHypothesisIds as string[]) : undefined,
        sourceNote: typeof fields.sourceNote === 'string' ? fields.sourceNote : undefined,
      });
      if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
      return NextResponse.json({ ok: true, item: result.item });
    }
    return NextResponse.json({ ok: false, error: `unknown kind "${String(kind)}"` }, { status: 400 });
  }

  if (!isRegistryKind(body.kind)) {
    return NextResponse.json({ ok: false, error: 'kind required: experiment | principle | invariant | backlog' }, { status: 400 });
  }
  const kind = body.kind;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  if (body.action === 'edit') {
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const result = await editRegistryItem(kind, id, patch);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'transition-status') {
    const status = typeof body.status === 'string' ? body.status : '';
    if (!status) return NextResponse.json({ ok: false, error: 'status required' }, { status: 400 });
    const result = await transitionRegistryStatus(kind, id, status);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'add-review') {
    const note = typeof body.note === 'string' ? body.note : '';
    const disposition = typeof body.disposition === 'string' ? body.disposition : '';
    const result = await addRegistryReviewNote(kind, id, g.persona.personaId, { note, disposition });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    return NextResponse.json({ ok: true, entry: result.entry });
  }

  return NextResponse.json({ ok: false, error: `unknown action "${String(body.action)}"` }, { status: 400 });
}
