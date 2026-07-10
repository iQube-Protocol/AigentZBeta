/**
 * POST /api/artifact/produce-research — the CCRL `research` pilot's route
 * (CFS-025 Phase 2). Shepherds a CCRL experiment into a constitutional-tier
 * `research` artifact via the Artifact Runtime.
 *
 * Spine-guarded + admin-gated identically to /api/research/lifecycle: the caller
 * is resolved through `getActivePersona` and must be an admin. This route is the
 * SEAM that closes the T2-seam mismatch `receiptReconciliation.md` flagged — it
 * resolves the operator's real T0 personaId server-side under the gate and
 * threads it to the pilot's receipt writer, while the ArtifactContext the runtime
 * sees stays T2-only (the pilot receives a server-computed one-way
 * `actorCommitment`, never the personaId).
 *
 * Modes:
 *   • default / `{ mode: 'propose' }` — drafts the ConstitutionalObject, writes
 *     nothing. receiptId null.
 *   • `{ mode: 'publish' }` — gated: emits ONE `artifact_published` receipt
 *     (DVN-anchorable) and returns the published object.
 *
 * The response is the pilot's T1-projected `ArtifactResult` — no T0 identifiers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { produceCcrlResearchArtifact } from '@/services/artifact/pilots/ccrlResearchPilot';

export const dynamic = 'force-dynamic';

/** Server-computed, one-way, T2-safe commitment to the acting subject — the ONLY
 *  subject handle the runtime/object see. Namespaced so it cannot collide with a
 *  locker/other commitment derived from the same personaId. */
function actorCommitmentFor(personaId: string): string {
  return createHash('sha256').update(`artifact:actor:${personaId}`).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { experimentId?: string; intentRef?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const mode = body.mode === 'publish' ? 'publish' : 'propose';
  const intentRef =
    typeof body.intentRef === 'string' && body.intentRef.trim()
      ? body.intentRef.trim()
      : `intent:ccrl-research:${body.experimentId ?? 'EXP-001'}`;

  // Resolve the T0 personaId under the gate and derive its T2 commitment. The
  // personaId is passed ONLY as the publish receipt writer id; the commitment is
  // what the runtime + object express.
  const personaId = persona.personaId;
  const result = await produceCcrlResearchArtifact({
    actorCommitment: actorCommitmentFor(personaId),
    intentRef,
    experimentId: typeof body.experimentId === 'string' ? body.experimentId : undefined,
    mode,
    ...(mode === 'publish' ? { personaId } : {}),
  });

  // The pilot returns a T1-projected ArtifactResult (no T0 ids). An honest
  // ok:false (e.g. receipt write failed on publish) is still a resolved result
  // the caller surfaces inline — 200, with ok reflecting the outcome.
  return NextResponse.json(result, { status: result.ok ? 200 : 200 });
}
