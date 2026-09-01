/**
 * GET /api/journey/constitutional-internet-bridge/state
 *
 * Assembles the AuthoritativePlatformState for the Constitutional Internet
 * Bridge journey (services/journey/constitutionalInternetBridgeJourney.ts)
 * from real reads, then resolves it via resolveJourneyState() — same shape
 * as /api/journey/knyts-bridge/state.
 *
 * Not gated on auth: HOME/VIEW/ORIENT/CHOOSE are deliberately browsable
 * signed-out, so `passport` simply resolves NOT_STARTED/READY for a
 * signed-out caller rather than the route refusing to answer at all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listActivityReceiptsForPersona } from '@/services/receipts/activityReceiptService';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import {
  CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
  CI_BRIDGE_RUNTIME_AGENT_ID,
  CI_BRIDGE_DISPOSITION_CONTEXT,
  CI_BRIDGE_CAMPAIGN_ID,
  CI_BRIDGE_EXTERNAL_AGENT_EVENT_TYPE,
} from '@/services/journey/constitutionalInternetBridgeJourney';
import { resolvePrimaryCompanionForJourney } from '@/services/journey/primaryCompanionResolver';
import { parseActivatedBranchesParam } from '@/services/journey/journeyBranchActivation';
import { computeJourneyAeeOutcome } from '@/services/adaptive/journeyAeeOrchestrator';
import { hasObservedExperienceInteraction } from '@/services/journey/experienceObservationPromotion';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return await getImpl(req);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

async function getImpl(req: NextRequest) {
  // Not gated on auth — see file header. A signed-out caller's persona is
  // simply null, and every stage's evidence stays honestly missing.
  const persona = await getActivePersona(req).catch(() => null);
  const personaAuthenticated = Boolean(persona?.personaId);

  // Real constitutional presence, not merely "signed in" — the SAME
  // canonical check KNYTS Bridge and Horizen's own admission ladder use
  // (services/identity/passportPrincipal.ts's
  // loadUsableCitizenPassportForAuthProfile / isPassportUsable), never a
  // second, weaker definition of "crossed the Threshold"
  // (inv.engineering.036/037).
  let citizenPassportUsable = false;
  if (persona?.authProfileId) {
    const adminSupabase = getSupabaseServer();
    if (adminSupabase) {
      const result = await loadUsableCitizenPassportForAuthProfile(adminSupabase, persona.authProfileId);
      citizenPassportUsable = result.ok;
    }
  }

  let dispositionRecorded = false;
  let externalAgentConnected = false;
  let constitutionalEventRecorded = false;

  if (persona?.personaId) {
    const dispositionReceipts = await listActivityReceiptsForPersona(persona.personaId, {
      actionTypes: ['experienceqube_focus_disposition_recorded'],
      agentsInvoked: [CI_BRIDGE_RUNTIME_AGENT_ID],
      limit: 5,
    });
    dispositionRecorded = dispositionReceipts.some(
      (r) => (r.actionInput as { context?: string } | null)?.context === CI_BRIDGE_DISPOSITION_CONTEXT,
    );

    const admin = getCommunityContentSupabase();
    const { data: connectEvents } = await admin
      .from('campaign_events')
      .select('id')
      .eq('campaign_id', CI_BRIDGE_CAMPAIGN_ID)
      .eq('persona_id', persona.personaId)
      .eq('event_type', CI_BRIDGE_EXTERNAL_AGENT_EVENT_TYPE)
      .limit(1);
    externalAgentConnected = Boolean(connectEvents && connectEvents.length > 0);

    // PERSONIFY's two supporting paths are ALTERNATIVES, not a checklist —
    // either bringing an agent you already use into the field, or beginning
    // to shape aigentMe, starts the agent relationship. See
    // constitutionalInternetBridgeJourney.ts's "PERSONIFY" header.
    const agentRelationshipStarted = dispositionRecorded || externalAgentConnected;

    if (agentRelationshipStarted) {
      // The smallest real "a constitutional event happened" fact: Passport
      // is already implied by personaAuthenticated, and starting the agent
      // relationship (either path) is itself a recorded act — that pair is
      // enough to say STAND has something honest to show, without inventing
      // a richer formula.
      constitutionalEventRecorded = true;
    }
  }

  // AEE-XP-001 §10/XP-6 — see knyts-bridge/state's identical comment. Same
  // generic promotion seam, same read, no CI-specific logic.
  const discoverExperienceObserved = await hasObservedExperienceInteraction(
    persona?.personaId ?? null,
    CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY.id,
    'fs-discover',
  );

  const platformState: AuthoritativePlatformState = {
    stages: {
      passport: { citizenPassportUsable },
      personify: { agentRelationshipStarted: dispositionRecorded || externalAgentConnected },
      stand: { constitutionalEventRecorded },
      'fs-discover': { discoverExperienceObserved },
    },
  };

  const activatedBranches = parseActivatedBranchesParam(req.nextUrl.searchParams.get('activatedBranches'));
  const runtimeState = resolveJourneyState(CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY, platformState, activatedBranches);

  // AEE-XP-001 §10/XP-5 — see knyts-bridge/state's identical comment.
  runtimeState.resolvedCompanionAgent = (
    await resolvePrimaryCompanionForJourney(req, CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY)
  ).agent;

  // XP-1 (AEE-XP-001 §6) — identical wiring to knyts-bridge/state's own
  // comment: additive `aee` key, never able to fail the request. Same
  // orchestrator, same AdaptiveInteractionContext path, same projection
  // contract — no CI-specific AEE logic.
  let aee: Awaited<ReturnType<typeof computeJourneyAeeOutcome>> | null = null;
  try {
    aee = await computeJourneyAeeOutcome({
      journeyDefinition: CONSTITUTIONAL_INTERNET_BRIDGE_JOURNEY,
      runtimeState,
      hostId: 'constitutional-internet-bridge',
      participantRef: persona?.personaId ?? 'anonymous',
      generatedAt: new Date().toISOString(),
    });
  } catch {
    aee = null; // fall-open — never blocks the response
  }

  return NextResponse.json({ ok: true, state: runtimeState, personaAuthenticated, aee });
}
