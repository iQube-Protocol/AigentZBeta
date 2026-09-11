/**
 * POST /api/composition/publish — the Studio → Artifact-Runtime publish seam
 * (CFS-025/026). The ROUTE layer the Composition engine's PUBLISH SEAM
 * anticipated: `composeArtifact` (services/composition/composeArtifact.ts
 * ~L449-456) leaves `provenance.receiptId` null in propose-mode with the note
 * that the receipt "would be written at the ROUTE layer" — this is that layer.
 *
 * Spine-guarded + admin-gated identically to /api/artifact/produce-research:
 * the caller is resolved through `getActivePersona` and must be an admin. The
 * T0 personaId is resolved HERE, under the gate, and used ONLY to write the
 * publish receipt; everything the engine/object/response express is the
 * server-computed one-way T2 `actorCommitment`.
 *
 * Modes:
 *   • default / `{ mode: 'propose' }` — run the engine's own propose semantics,
 *     write NO receipt, persist the composition as an OPERATIONAL artifact
 *     record. receiptId null.
 *   • `{ mode: 'publish' }` — gated: on a validation-passing composition, emit
 *     ONE `artifact_published` receipt (DVN-anchorable) via the unified writer,
 *     fold its id into the returned provenance (a projection — the engine is
 *     untouched), and persist as a CONSTITUTIONAL artifact record.
 *
 * Body: `{ goal: string, mode?: 'propose'|'publish', interpretationId?,
 * delta?, grounding? }` — coerced into the engine's real `CompositionRequest`
 * by `buildStudioCompositionRequest` (services/artifact/compositionPublish.ts).
 *
 * The response is T1-safe — `findForbiddenObjectKey` is the exit guard; a T0
 * leak returns 500, never the payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { composeArtifact } from '@/services/composition/composeArtifact';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { saveArtifactRecord } from '@/services/artifact/artifactRecordStore';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import { mirrorLifecycleToLinear } from '@/services/linear/lifecycleMirror';
import {
  STUDIO_COMPOSITION_PROFILE,
  STUDIO_COMPOSITION_DELEGATE,
  buildStudioCompositionRequest,
  projectPublishedProvenance,
  compositionRecordBody,
  publishSummaryFor,
} from '@/services/artifact/compositionPublish';

export const dynamic = 'force-dynamic';

/** Server-computed, one-way, T2-safe commitment to the acting subject — the ONLY
 *  subject handle the engine/record/response see. Same namespace as the other
 *  artifact routes so one operator maps to one commitment across the runtime. */
function actorCommitmentFor(personaId: string): string {
  return createHash('sha256').update(`artifact:actor:${personaId}`).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    goal?: unknown;
    mode?: unknown;
    interpretationId?: unknown;
    delta?: unknown;
    grounding?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  if (!goal) {
    return NextResponse.json({ ok: false, error: 'goal (string) is required' }, { status: 400 });
  }

  const mode = body.mode === 'publish' ? 'publish' : 'propose';

  // Resolve the T0 personaId under the gate and derive its T2 commitment. The
  // personaId is used ONLY as the publish receipt writer id below; the
  // commitment is what the engine + record + response express.
  const personaId = persona.personaId;
  const actorCommitment = actorCommitmentFor(personaId);

  const compositionRequest = buildStudioCompositionRequest({
    goal,
    mode,
    actorCommitment,
    interpretationId: typeof body.interpretationId === 'string' ? body.interpretationId : undefined,
    delta: body.delta,
    grounding:
      body.grounding && typeof body.grounding === 'object'
        ? (body.grounding as { domains?: string[]; ontologyClassIds?: string[]; invariantRefs?: string[] })
        : undefined,
  });

  // Run the engine under ITS OWN propose semantics — composeArtifact never
  // writes a receipt regardless of mode; the timestamp is stamped here (the
  // engine never reads the clock).
  let result = await composeArtifact(compositionRequest, undefined, {
    composedAt: new Date().toISOString(),
  });

  // ── The publish seam: ONE artifact_published receipt, route-minted ──
  let receiptId: string | null = null;
  let publishError: string | undefined;
  if (mode === 'publish') {
    if (!result.ok) {
      // Fail-closed: a composition that failed validation is never published.
      publishError = 'composition failed validation (fail-closed) — nothing published';
    } else {
      const receipt = await createActivityReceipt({
        personaId,
        activeCartridge: 'studio',
        actionType: 'artifact_published',
        summary: publishSummaryFor(result.provenance.contentHash),
        contextShared: ['studio', 'artifact-runtime'],
        artifactsCreated: [result.provenance.publicRef],
      }).catch(() => null);
      receiptId = receipt?.id ?? null;
      if (receiptId) {
        // Fold the receipt into the provenance — a projection of the engine's
        // result (composeArtifact stays propose-only; see its PUBLISH SEAM).
        result = projectPublishedProvenance(result, receiptId);
      } else {
        // Receipt write failed — do NOT claim publication (honest refusal).
        publishError = 'publish receipt write failed — composition left proposed';
      }
    }
  }
  const published = mode === 'publish' && receiptId !== null;

  // Persist the composition as a durable artifact record (best-effort +
  // soft-fail, the artifactRecordStore pattern). Published ⇒ constitutional;
  // proposed ⇒ operational. Failed compositions are never persisted.
  let recordId: string | null = null;
  if (result.ok && result.artefact) {
    recordId = await saveArtifactRecord({
      artifactId: result.provenance.publicRef,
      profile: STUDIO_COMPOSITION_PROFILE,
      consequenceClass: published ? 'constitutional' : 'operational',
      delegate: STUDIO_COMPOSITION_DELEGATE,
      title: goal.slice(0, 120),
      brief: goal,
      body: compositionRecordBody(result),
      receiptId,
      sovereignty: {
        engine: 'composeArtifact',
        target: result.target,
        interpretationId: result.artefact.interpretationId,
        canonVersion: result.provenance.canonVersion,
        actorCommitment,
        mode: published ? 'publish' : 'propose',
      },
    });
  }

  // Linear mirror (observe-mode, soft-fail): studio compositions track in the
  // same cycle — published lands Done, proposed lands In Progress. T2-safe
  // note only (public ref, hash prefix, receipt/record ids).
  const linear = result.ok
    ? await mirrorLifecycleToLinear({
        delegate: STUDIO_COMPOSITION_DELEGATE,
        profile: STUDIO_COMPOSITION_PROFILE,
        brief: goal,
        phase: published ? 'published' : 'artifact_produced',
        note: [
          `Studio composition ${published ? 'published' : 'proposed'} — \`${result.provenance.publicRef}\`, sha256 \`${result.provenance.contentHash.slice(0, 16)}\``,
          recordId ? `record \`${recordId}\`` : null,
          receiptId ? `receipt \`${receiptId}\`` : null,
        ]
          .filter(Boolean)
          .join(' — '),
      })
    : { mirrored: false, reason: 'composition failed validation — not mirrored' };

  const payload = {
    ok: result.ok,
    mode: published ? ('publish' as const) : ('propose' as const),
    published,
    recordId,
    receiptId,
    linear,
    result,
    ...(publishError ? { error: publishError } : {}),
  };

  // Exit guard: the response must be T1-safe — no T0 identifier anywhere.
  const leak = findForbiddenObjectKey(payload);
  if (leak) {
    console.error(`[composition publish] response leaked a T0 identifier at '${leak}' — withheld`);
    return NextResponse.json({ ok: false, error: 'response failed tier-safety guard' }, { status: 500 });
  }

  return NextResponse.json(payload, { status: 200 });
}
