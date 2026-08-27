/**
 * POST /api/adaptive/financial-services/handoffs/[handoffId]/redeem — the
 * native landing route's redemption call (operator ruling, 2026-08-27,
 * Differ FS pilot reconciliation).
 *
 * Atomically consumes the handoff (services/adaptive/nativeHandoff.ts), with
 * `recheckEligible` rebuilding a FRESH Financial Services projection and
 * checking `isCapabilityHandoffEligible` against it — the application-
 * specific half `nativeHandoff.ts` itself must not own (see that module's
 * header). Resolves the exact native destination via the SAME catalogue/
 * journey machinery the projection itself used, never hand-assembled.
 *
 * This route EXECUTES NOTHING — it only validates, consumes, and returns a
 * destination for the caller to navigate to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { issuePersonaSessionToken } from '@/services/identity/personaSessionToken';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveJourneyOperatorDestination } from '@/services/journey/catalogueDestinationHelper';
import { buildExternalExperienceProjection } from '@/services/adaptive/externalExperienceProjection';
import { FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST } from '@/services/adaptive/applicationProjectionManifest';
import { isCapabilityHandoffEligible, redeemNativeActionHandoff } from '@/services/adaptive/nativeHandoff';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handoffId: string }> },
) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId || !persona.authProfileId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service unavailable — no data store configured.' }, { status: 503 });
  }

  const { handoffId } = await params;
  const agent = resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG);
  if (!agent) {
    return NextResponse.json({ ok: false, error: 'No registrable agent is configured for the Financial Services journey.' }, { status: 503 });
  }

  const recheckEligible = async (
    journeyId: string | null,
    _stageId: string | null,
    capabilityId: string,
  ): Promise<boolean> => {
    if (journeyId && journeyId !== HORIZEN_MONEYPENNY_JOURNEY.id) return false;
    let citizenPassportUsable = false;
    try {
      const passport = await loadUsableCitizenPassportForAuthProfile(admin, persona.authProfileId!);
      citizenPassportUsable = passport.ok;
    } catch {
      citizenPassportUsable = false;
    }
    const fresh = await buildExternalExperienceProjection(admin, {
      journeyDefinition: HORIZEN_MONEYPENNY_JOURNEY,
      aigentQubeId: agent.aigentQubeId,
      participantRef: personaPublicRef(persona.personaId!),
      participantState: { citizenPassportUsable },
      manifest: FINANCIAL_SERVICES_APPLICATION_PROJECTION_MANIFEST,
      hostId: 'differ',
      generatedAt: new Date().toISOString(),
    });
    return isCapabilityHandoffEligible(fresh.context, fresh.projection, capabilityId);
  };

  const redeemed = await redeemNativeActionHandoff(
    admin,
    handoffId,
    personaPublicRef(persona.personaId),
    recheckEligible,
  );

  if (!redeemed.ok) {
    return NextResponse.json({ ok: false, reason: redeemed.reason, error: redeemed.detail }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  let route: string | null = null;
  try {
    const pst = issuePersonaSessionToken({
      personaId: persona.personaId,
      authProfileId: persona.authProfileId,
      ttlSeconds: 300,
    });
    const destination = resolveJourneyOperatorDestination({
      journeyId: redeemed.journeyId ?? HORIZEN_MONEYPENNY_JOURNEY.id,
      participantState: { citizenPassportUsable: true }, // re-checked inside recheckEligible above
      navOptions: { personaSessionToken: pst.token },
    });
    route = destination.valid ? destination.operatorDestination.route : null;
  } catch {
    route = null;
  }

  return NextResponse.json(
    {
      ok: true,
      journeyId: redeemed.journeyId,
      stageId: redeemed.stageId,
      capabilityId: redeemed.capabilityId,
      nativeSurfaceRef: redeemed.nativeSurfaceRef,
      route,
      returnUrl: redeemed.returnUrl,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
