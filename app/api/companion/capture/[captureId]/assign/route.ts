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
 * Fails closed: `getActivePersona` returning null produces a 401 with NO
 * Supabase read/write attempted.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { CaptureAssignDestination } from '@/types/companionCapture';
import { createIntentQube, getIntentQube } from '@/services/iqube/intentQube';
import { createVentureQube, getVentureQube } from '@/services/venture/ventureQubeService';
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
      refId = existingIntent.id;
    } else {
      const existingVenture = await getVentureQube(persona.personaId, existingId);
      if (!existingVenture) {
        return badRequest('venture-not-found', 'not found or not owned by you');
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
