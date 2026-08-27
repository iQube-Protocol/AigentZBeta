/**
 * POST /api/adaptive/financial-services/handoffs — issue a single-use native
 * handoff for one capability in the CURRENT, freshly-built Financial
 * Services `ExperienceProjection` (operator ruling, 2026-08-27, Differ FS
 * pilot reconciliation).
 *
 * Same authentication posture as the projection route (see its header):
 * fails closed on the `differ-fs-pilot` integration's `enabled: false` until
 * Q7 is settled. `capabilityId` and `returnUrl` are the only caller-
 * supplied values that matter — everything else (journeyId, stageId,
 * nativeSurfaceRef, whether the capability is actually handoff-eligible
 * right now) is re-derived server-side from a fresh projection, never
 * trusted from the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveExternalExperienceIntegration } from '@/services/adaptive/externalIntegrationRegistry';
import { buildExternalExperienceProjection } from '@/services/adaptive/externalExperienceProjection';
import { FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST } from '@/services/adaptive/applicationProjectionManifest';
import { issueNativeActionHandoff } from '@/services/adaptive/nativeHandoff';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const INTEGRATION_ID = 'differ-fs-pilot';

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: NextRequest) {
  const integration = resolveExternalExperienceIntegration(INTEGRATION_ID);
  if (!integration || !integration.enabled) {
    return NextResponse.json(
      { ok: false, error: `Integration '${INTEGRATION_ID}' is not enabled.` },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const persona = await getActivePersona(req);
  if (!persona?.personaId || !persona.authProfileId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: { capabilityId?: unknown; returnUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }
  const capabilityId = asString(body.capabilityId);
  const returnUrl = asString(body.returnUrl);
  if (!capabilityId || !returnUrl) {
    return NextResponse.json({ ok: false, error: 'capabilityId and returnUrl are both required' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable — no data store configured.' }, { status: 503 });
  }

  const agent = resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG);
  if (!agent) {
    return NextResponse.json({ ok: false, error: 'No registrable agent is configured for the Financial Services journey.' }, { status: 503 });
  }

  let citizenPassportUsable = false;
  try {
    const passport = await loadUsableCitizenPassportForAuthProfile(admin, persona.authProfileId);
    citizenPassportUsable = passport.ok;
  } catch {
    citizenPassportUsable = false;
  }

  const result = await buildExternalExperienceProjection(admin, {
    journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
    aigentQubeId: agent.aigentQubeId,
    participantRef: personaPublicRef(persona.personaId),
    participantState: { citizenPassportUsable },
    manifest: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
    hostId: 'differ',
    generatedAt: new Date().toISOString(),
  });

  const nativeSurfaceRef = result.projection.surfaces.find((s) => s.capabilityId === capabilityId)?.hostRef ?? null;
  if (!nativeSurfaceRef) {
    return NextResponse.json(
      { ok: false, reason: 'capability-not-handoff-eligible', error: `'${capabilityId}' is not present in the current projection.` },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const issued = await issueNativeActionHandoff(admin, {
    integrationId: INTEGRATION_ID,
    applicationId: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST.applicationId,
    context: result.context,
    projection: result.projection,
    capabilityId,
    principalPublicRef: personaPublicRef(persona.personaId),
    nativeSurfaceRef,
    returnUrl,
  });

  if (!issued.ok) {
    return NextResponse.json({ ok: false, reason: issued.reason, error: issued.detail }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    { ok: true, handoffId: issued.handoffId, expiresAt: issued.expiresAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
