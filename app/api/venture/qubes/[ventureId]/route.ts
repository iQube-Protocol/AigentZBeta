/**
 * /api/venture/qubes/[ventureId] — read + update a single VentureQube.
 *
 * GET   → the VentureQube record (ownership-checked).
 * PATCH → merge a partial layered patch + re-calibrate. Body:
 *         { layers?: Partial<VentureQubeV1>, stage?, path? }.
 *
 * Sprint 4: on every PATCH that touches signalEvidence or thesis, recomputes
 * Capability Standing so the front-half agency signal stays in sync with live
 * VentureQube data (not just the portfolio save event).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import {
  getVentureQube,
  updateVentureQube,
} from '@/services/venture/ventureQubeService';
import {
  accrueCapabilityStanding,
  computeIntentClarity,
  computeIdentityDepth,
} from '@/services/crm/standingAccrualService';
import type { VentureQubeV1, VentureStage, FounderPath } from '@/types/ventureQube';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ventureId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { ventureId } = await params;
  const record = await getVentureQube(persona.personaId, ventureId);
  if (!record) {
    return NextResponse.json({ ok: false, error: 'Venture not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, venture: record });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ventureId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { ventureId } = await params;
  let body: {
    layers?: Partial<VentureQubeV1>;
    stage?: VentureStage;
    path?: FounderPath;
    name?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const result = await updateVentureQube(persona.personaId, ventureId, body.layers ?? {}, {
    stage: body.stage,
    path: body.path,
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // Sprint 4 — recompute Capability Standing when signal evidence or thesis
  // layers are part of the patch. Best-effort, never blocks the response.
  const touchesSignal = Boolean(body.layers?.signalEvidence || body.layers?.thesis);
  if (touchesSignal && result.record) {
    void recomputeVentureCapabilityStanding(persona.personaId, result.record).catch(() => {});
  }

  return NextResponse.json({ ok: true, venture: result.record });
}

async function recomputeVentureCapabilityStanding(
  personaId: string,
  venture: { layers?: VentureQubeV1 | null },
): Promise<void> {
  const crm = getCrmClient();
  const { data: crmPersona } = await crm
    .from('crm_personas')
    .select('id')
    .eq('identity_persona_id', personaId)
    .maybeSingle();
  const crmPersonaId = crmPersona?.id ? String(crmPersona.id) : null;
  if (!crmPersonaId) return;

  const admin = getSupabaseServer();
  const layers = (venture.layers ?? {}) as VentureQubeV1;
  const signalEvidence = layers.signalEvidence ?? null;
  const thesisLayer = layers.thesis ?? null;

  const { data: passport } = await admin!
    .from('polity_passport_records')
    .select('issued_at, world_id_verified_at, passport_grade')
    .eq('persona_id', personaId)
    .eq('passport_class', 'citizen')
    .maybeSingle();

  const identityDepth = computeIdentityDepth(
    passport
      ? {
          issued: Boolean(passport.issued_at),
          worldIdVerified: Boolean(passport.world_id_verified_at),
          gradeA: passport.passport_grade === 'A',
        }
      : null,
  );

  // Count populated intent strings across both intent lists as "active objectives".
  const intentLayer = layers.intent ?? null;
  const founderIntents = Array.isArray(intentLayer?.founderIntents) ? intentLayer.founderIntents : [];
  const ventureIntents = Array.isArray(intentLayer?.ventureIntents) ? intentLayer.ventureIntents : [];
  const activeObjectiveCount = [...founderIntents, ...ventureIntents].filter(
    (s) => typeof s === 'string' && s.trim().length > 0,
  ).length;
  const intentClarity = computeIntentClarity(thesisLayer, activeObjectiveCount);

  await accrueCapabilityStanding(crmPersonaId, {
    demandConfidence: signalEvidence?.demandConfidence ?? null,
    opportunityConfidence: signalEvidence?.opportunityConfidence ?? null,
    capabilityConfidence: signalEvidence?.capabilityConfidence ?? null,
    intentClarity,
    identityDepth,
  });
}
