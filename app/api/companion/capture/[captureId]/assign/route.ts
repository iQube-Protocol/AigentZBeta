/**
 * POST /api/companion/capture/[captureId]/assign
 *
 * PRD-MMC-IMPL-003 Increment 2, DESIGN — awaiting operator ratification.
 * The two "assign" quick-actions this pass supports (§0.3): binding an
 * already-constitutionalized capture to a real destination by composing the
 * EXISTING `createIntentQube` / `createVentureQube` constructors directly —
 * never a parallel "capture version" of either.
 *
 * Only these two destinations are supported. `destination: 'research' |
 * 'workspace' | 'story' | 'ledger' | 'cartridge' | 'canvas'` returns 400
 * "destination not yet supported" — never a silent no-op (PRD-MMC-IMPL-003
 * §2 Increment 2 explicit non-goals).
 *
 * A capture-driven venture creation is NOT exempt from `createVentureQube`'s
 * existing plan-tier limit (PRD-MMC-IMPL-003 §5.4) — same function, same
 * failure mode as any other venture creation.
 *
 * ATTACH TO AN EXISTING OBJECT (2026-07-24 follow-on): body may carry an
 * optional `existingId`. When present, creation is skipped entirely and the
 * capture is bound to that already-existing Intent/Venture instead — this
 * closes the gap where every "Bring into Venture" was needlessly minting a
 * new venture (and hitting the plan-tier cap) even when the operator
 * already had one to land the capture in. Ownership of `existingId` is
 * verified server-side (`getIntentQube` + a manual persona check;
 * `getVentureQube` is already persona-scoped) — never trusted from the
 * client's claim alone. See `GET /api/companion/capture/destinations` for
 * the picker list this id comes from.
 *
 * THE CAPTURED CONTENT LANDS IN THE OBJECT (2026-07-27, operator ruling:
 * *"that's half the point of it — to add content to in flight projects. The
 * other half is to add to new projects or projects perhaps inspired via
 * browsing"*). The attach-to-existing branch previously resolved `refId` and
 * wrote NOTHING ELSE: the capture left the Inbox and its text landed nowhere,
 * so the operator's actual purpose — pulling something across INTO live work —
 * silently failed while every UI signal said success. The two create branches
 * always carried the text (`rationale`, `seed.problemStatement`); only attach
 * dropped it.
 *
 * Each destination takes the content in ITS OWN idiom rather than a new
 * capture-shaped field on either primitive:
 *
 *   Intent  → a CHILD IntentQube under the target (`parentIntentId`). That is
 *             the codebase's existing model for derived work, and the receipts
 *             enrichment already folds a child into its parent's capsule — so
 *             the capture renders INSIDE the in-flight intent, satisfying the
 *             Content Capsule Containment rule rather than spawning an orphan.
 *   Venture → a SIGNAL EVIDENCE item on the venture's Layer 4. Pulling
 *             something across from the web into a venture IS evidence about
 *             that venture; `signalSource` carries the origin URL and `note`
 *             the captured text.
 *
 * Attachment is best-effort in ONE direction only: if the write fails the
 * route does NOT mark the capture assigned, so the item stays in the Inbox and
 * can be retried. Losing the capture silently is the defect being fixed here —
 * it must not be reintroduced as an error path.
 *
 * Fails closed: `getActivePersona` returning null produces a 401 with NO
 * Supabase read/write attempted.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { CaptureAssignDestination } from '@/types/companionCapture';
import { createIntentQube, getIntentQube } from '@/services/iqube/intentQube';
import { createVentureQube, getVentureQube, updateVentureQube } from '@/services/venture/ventureQubeService';
import { getCapturedObjectForPersona, markCapturedObjectAssigned } from '../../_lib/store';

export const dynamic = 'force-dynamic';

const SUPPORTED_DESTINATIONS: CaptureAssignDestination[] = ['intent', 'venture'];

function unauthenticated(): NextResponse {
  return NextResponse.json(
    { error: 'unauthenticated' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

function badRequest(error: string, detail?: string): NextResponse {
  return NextResponse.json(
    { error, ...(detail ? { detail } : {}) },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ captureId: string }> },
): Promise<NextResponse> {
  const persona = await getActivePersona(request);
  if (!persona?.personaId) return unauthenticated();

  const { captureId } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest('invalid-json-body');
  }
  const body = (rawBody ?? {}) as Record<string, unknown>;
  const destination = body.destination as CaptureAssignDestination | undefined;
  // 2026-07-24: attach-to-an-existing-object follow-on (operator-reported
  // gap — this route previously always minted a NEW Intent/Venture, with
  // no way to land a capture in something the persona already has, which
  // also meant every "Bring into Venture" click was needlessly subject to
  // the venture-tier creation cap even when the operator already had a
  // venture to attach to). When present, `existingId` skips creation
  // entirely -- ownership is verified server-side, never trusted from the
  // client's claim alone.
  const existingId =
    typeof body.existingId === 'string' && body.existingId.trim().length > 0
      ? body.existingId.trim()
      : undefined;

  if (!destination || !SUPPORTED_DESTINATIONS.includes(destination)) {
    return badRequest(
      'destination-not-yet-supported',
      `only 'intent' and 'venture' are supported in this pass; got '${String(destination)}'`,
    );
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json(
      { error: 'supabase-configuration-missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const capture = await getCapturedObjectForPersona(admin, persona.personaId, captureId);
  if (!capture) return badRequest('capture-not-found', 'not found, not owned by you, or already assigned');
  if (capture.status !== 'inbox') return badRequest('capture-already-assigned');

  let refId: string;

  if (existingId) {
    if (destination === 'intent') {
      const existingIntent = await getIntentQube(existingId);
      if (!existingIntent || existingIntent.personaId !== persona.personaId) {
        return badRequest('intent-not-found', 'not found or not owned by you');
      }
      // The capture becomes a child of the target intent — the existing model
      // for derived work, and the one the ledger already folds into the
      // parent's capsule. The parent is never mutated.
      const child = await createIntentQube({
        personaId: persona.personaId,
        intentName: capture.title ?? 'Captured item',
        intentType: 'create_artifact',
        activeCartridge: 'companion',
        rationale: capture.contentText?.slice(0, 500),
        parentIntentId: existingIntent.id,
      }).catch(() => null);
      if (!child) {
        return NextResponse.json(
          { error: 'capture-attach-failed', detail: 'could not attach the capture to that intent' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      refId = existingIntent.id;
    } else {
      const existingVenture = await getVentureQube(persona.personaId, existingId);
      if (!existingVenture) {
        return badRequest('venture-not-found', 'not found or not owned by you');
      }
      // The capture becomes signal evidence on the venture's Layer 4, carrying
      // both where it came from and what it said.
      const evidence = existingVenture.layers.signalEvidence;
      const attached = await updateVentureQube(persona.personaId, existingVenture.id, {
        ...existingVenture.layers,
        signalEvidence: {
          ...evidence,
          items: [
            ...evidence.items,
            {
              signalId: `companion-capture:${capture.id}`,
              signalType: 'companion-capture',
              signalSource: (capture.sourceUrl ?? capture.title ?? 'companion').slice(0, 200),
              note: capture.contentText?.slice(0, 2000),
              confidenceScore: 0,
              standingScore: 0,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });
      if (!attached.ok) {
        return NextResponse.json(
          { error: 'capture-attach-failed', detail: attached.error },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      refId = existingVenture.id;
    }
  } else if (destination === 'intent') {
    // NOTE: no IntentType value literally means "captured" -- 'create_artifact'
    // is the closest existing fit (a capture becoming something to act on),
    // per PRD-MMC-IMPL-003's own honest scoping. Never fork a new IntentType
    // for this.
    const intentName = typeof body.intentName === 'string' && body.intentName.trim() ? body.intentName : (capture.title ?? 'Captured item');
    const intent = await createIntentQube({
      personaId: persona.personaId,
      intentName,
      intentType: 'create_artifact',
      activeCartridge: 'companion',
      rationale: capture.contentText?.slice(0, 500),
    });
    refId = intent.id;
  } else {
    const name = typeof body.name === 'string' && body.name.trim() ? body.name : (capture.title ?? 'Captured venture');
    const result = await createVentureQube({
      personaId: persona.personaId,
      name,
      seed: { problemStatement: capture.contentText?.slice(0, 1000) },
    });
    if (!result.ok) return badRequest('venture-creation-failed', result.error);
    refId = result.record.id;
  }

  const { error: assignError } = await markCapturedObjectAssigned(
    admin,
    persona.personaId,
    captureId,
    destination,
    refId,
  );
  if (assignError) {
    return NextResponse.json(
      { error: 'assign-persist-failed', detail: assignError },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { ok: true, destination, refId },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
