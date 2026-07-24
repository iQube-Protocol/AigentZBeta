/**
 * /api/research/registry — the Experiment / Constitutional / Invariant
 * Registry + Research Backlog (CFS-051, Strand 1 build 2026-07-24).
 *
 * GET  — list all four registers (candidate experiments, candidate
 *        constitutional principles, candidate structural invariants,
 *        research backlog). Gated by `canManageRegistry` (today: platform
 *        admin — a swappable, documented follow-on point, see
 *        services/research/registryAccess.ts).
 * POST — action-based, same gate:
 *   { action: 'create', kind, fields }              → create an entry
 *   { action: 'edit', kind, id, patch }              → edit editable fields
 *   { action: 'transition-status', kind, id, status } → change status
 *   { action: 'add-review', kind, id, note, disposition } → append a
 *        review-history entry (reviewerRef derived server-side, T2-safe)
 *
 * Gating mirrors /api/constitutional/capability-registry: 503 on identity-
 * spine timeout, 401 unauthenticated, 403 when canManageRegistry() refuses.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolvePersonaOrTimeout,
  PERSONA_TIMEOUT_MESSAGE,
} from '@/app/api/dev-command-center/_lib/persona';
import { canManageRegistry } from '@/services/research/registryAccess';
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

async function gate(request: NextRequest) {
  const pr = await resolvePersonaOrTimeout(request);
  if (pr.status === 'timeout') {
    return { error: NextResponse.json({ ok: false, error: PERSONA_TIMEOUT_MESSAGE }, { status: 503 }) };
  }
  if (pr.status === 'unauthenticated') {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }
  if (!canManageRegistry(pr.persona)) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { persona: pr.persona };
}

function isRegistryKind(v: unknown): v is RegistryKind {
  return v === 'experiment' || v === 'principle' || v === 'invariant' || v === 'backlog';
}

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if ('error' in g) return g.error;

  const [experiments, principles, invariants, backlog] = await Promise.all([
    listCandidateExperiments(),
    listCandidatePrinciples(),
    listCandidateInvariants(),
    listBacklogItems(),
  ]);
  return NextResponse.json({ ok: true, experiments, principles, invariants, backlog });
}

export async function POST(request: NextRequest) {
  const g = await gate(request);
  if ('error' in g) return g.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'action required: create | edit | transition-status | add-review' },
      { status: 400 },
    );
  }

  if (body.action === 'create') {
    const kind = body.kind;
    if (kind === 'experiment') {
      const fields = (body.fields ?? {}) as Record<string, unknown>;
      const result = await createCandidateExperiment({
        title: String(fields.title ?? ''),
        hypothesis: String(fields.hypothesis ?? ''),
        family: typeof fields.family === 'string' ? fields.family : undefined,
        layer: fields.layer === 'I' || fields.layer === 'II' || fields.layer === 'III' ? fields.layer : undefined,
        seriesId: typeof fields.seriesId === 'string' ? fields.seriesId : undefined,
        charterRef: typeof fields.charterRef === 'string' ? fields.charterRef : undefined,
        status: typeof fields.status === 'string' ? (fields.status as never) : undefined,
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
        status: typeof fields.status === 'string' ? (fields.status as never) : undefined,
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
        status: typeof fields.status === 'string' ? (fields.status as never) : undefined,
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
        status: typeof fields.status === 'string' ? (fields.status as never) : undefined,
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
