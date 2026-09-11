/**
 * GET /api/journey/knyts-bridge/state
 *
 * Assembles the AuthoritativePlatformState for the KNYTS Bridge Crossing
 * journey (services/journey/knytsBridgeCrossingJourney.ts) from real reads,
 * then resolves it via resolveJourneyState() — same shape as
 * /api/journey/validation-programme/state.
 *
 * Unlike every other journey route in this codebase, an unauthenticated
 * caller is NOT a 401 here: HOME and VIEW are deliberately browsable
 * signed-out (the public front door calls this route to know whether to
 * show "claim your Passport" or the Remix/Stand surfaces), so `passport`
 * simply resolves NOT_STARTED/READY for a signed-out caller rather than the
 * route refusing to answer at all. HOME/VIEW/ORIENT/BUY carry no evidence at
 * all (see the journey definition's own header) and so need no entry here —
 * resolveJourneyState treats an absent stages[id] exactly like one with
 * empty evidence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { resolveJourneyState, type AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import { KNYTS_BRIDGE_CROSSING_JOURNEY, KNYTS_BRIDGE_CAMPAIGN_ID } from '@/services/journey/knytsBridgeCrossingJourney';
import { resolvePrimaryCompanionForJourney } from '@/services/journey/primaryCompanionResolver';
import { parseActivatedBranchesParam } from '@/services/journey/journeyBranchActivation';
import { computeJourneyAeeOutcome } from '@/services/adaptive/journeyAeeOrchestrator';
import { hasDiscoveredFinancialSovereignty, hasLearnedFinancialSovereignty, hasExploredFinancialSovereignty, hasPreparedFinancialProfile } from '@/services/journey/financialSovereigntyEvidence';
import { assembleExperienceIntentProjection } from '@/services/adaptive/experienceIntentAssembly';
import { deriveMatrixCalibration } from '@/services/strategy/experienceMatrixDeriver';
import { assembleExperiencePrescription } from '@/services/adaptive/experiencePrescriptionAssembly';

export const dynamic = 'force-dynamic';

/* EVERY EXIT IS A NAMED ANSWER — see validation-programme/state's own
   header for why an unhandled throw must still return a diagnosable JSON
   body rather than an empty 500. */
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

  // Real constitutional presence, not merely "signed in" — the same
  // canonical check Horizen's own admission ladder settles as
  // `passport_is_issued` (services/identity/passportPrincipal.ts's
  // loadUsableCitizenPassportForAuthProfile / isPassportUsable), never a
  // second, weaker definition of "crossed the Threshold"
  // (inv.engineering.036/037). Scoped by authProfileId, not by any
  // Horizen agent/aigentQubeId — KNYTS has no agent-registration context,
  // being personhood-first (reconstitution spec, point 9).
  let citizenPassportUsable = false;
  if (persona?.authProfileId) {
    const adminSupabase = getSupabaseServer();
    if (adminSupabase) {
      const result = await loadUsableCitizenPassportForAuthProfile(adminSupabase, persona.authProfileId);
      citizenPassportUsable = result.ok;
    }
  }

  let crossingPublished = false;
  let crossingHasConsequence = false;

  if (persona?.personaId) {
    const supabase = getCommunityContentSupabase();

    const { data: crossings } = await supabase
      .from('community_generated_content')
      .select('id, status')
      .eq('creator_persona_id', persona.personaId)
      .eq('campaign_tag', KNYTS_BRIDGE_CAMPAIGN_ID)
      .in('status', ['shared', 'runtime_promoted']);

    crossingPublished = Boolean(crossings && crossings.length > 0);

    if (crossingPublished) {
      // Minimal real "consequence" signal for v1 — at least one recorded
      // share under this campaign. This is deliberately NOT the full
      // Standing doctrine's richer multi-signal formula (the KNYT signal
      // tray is only 6-of-9 actions real and has no persisted reward
      // ledger read — see the approved plan's gap #2); it is the smallest
      // fact that is actually true and checkable today.
      const { data: shares } = await supabase
        .from('social_share_analytics')
        .select('id')
        .eq('persona_id', persona.personaId)
        .eq('campaign_id', KNYTS_BRIDGE_CAMPAIGN_ID)
        .limit(1);
      crossingHasConsequence = Boolean(shares && shares.length > 0);
    }
  }

  // AEE-XP-001 §10/XP-6 — the generic experience-observation promotion
  // seam's live reads. Pure fact lookups (never a write). DISCOVER stays
  // the deliberately weak "any observed Continue" bar; LEARN/EXPLORE
  // (2026-09-01 follow-up) require the stronger, kind-discriminated basis
  // — see financialSovereigntyEvidence.ts's own header comment.
  const [discoverExperienceObserved, learnExperienceQualified, exploreCapabilityInteracted, financialProfileReviewed] = await Promise.all([
    hasDiscoveredFinancialSovereignty(persona?.personaId ?? null, KNYTS_BRIDGE_CROSSING_JOURNEY.id),
    hasLearnedFinancialSovereignty(persona?.personaId ?? null, KNYTS_BRIDGE_CROSSING_JOURNEY.id),
    hasExploredFinancialSovereignty(persona?.personaId ?? null, KNYTS_BRIDGE_CROSSING_JOURNEY.id),
    hasPreparedFinancialProfile(persona?.personaId ?? null),
  ]);

  const platformState: AuthoritativePlatformState = {
    stages: {
      passport: { citizenPassportUsable },
      remix: { crossingPublished },
      stand: { crossingHasConsequence },
      'fs-discover': { discoverExperienceObserved },
      'fs-learn': { learnExperienceQualified },
      'fs-explore': { exploreCapabilityInteracted },
      'fs-prepare': { financialProfileReviewed },
    },
  };

  const activatedBranches = parseActivatedBranchesParam(req.nextUrl.searchParams.get('activatedBranches'));
  const runtimeState = resolveJourneyState(KNYTS_BRIDGE_CROSSING_JOURNEY, platformState, activatedBranches);

  // AEE-XP-001 §10/XP-5 — this route is the nearest existing authoritative
  // (request-bearing) boundary for this journey; project the resolved
  // companion identity as runtime data on the SAME response the client
  // already fetches, never a second endpoint/state system.
  runtimeState.resolvedCompanionAgent = (await resolvePrimaryCompanionForJourney(req, KNYTS_BRIDGE_CROSSING_JOURNEY)).agent;

  // XP-1 (AEE-XP-001 §6) — the first LIVE HTTP-reachable caller of
  // services/adaptive/*. Additive: `aee` is a new top-level response key,
  // never a change to `state`'s own shape, and its computation can never
  // fail the request — a thrown/rejected outcome here is exactly case E
  // (AEE-XP-001 §5): the client already has `state` to fall back to its
  // existing deterministic native rendering, unaffected.
  let aee: Awaited<ReturnType<typeof computeJourneyAeeOutcome>> | null = null;
  let prescription: ReturnType<typeof assembleExperiencePrescription> = null;
  try {
    // AEE-XP-001 §6 XP-1 follow-up (2026-09-01) — activate
    // ExperienceIntentProjection end-to-end. Same fall-open discipline as
    // the outer try: an assembly failure here must not block the response
    // any more than an AEE failure does, so it is inside this same guard.
    const experience = await assembleExperienceIntentProjection({
      personaId: persona?.personaId ?? null,
      journeyId: KNYTS_BRIDGE_CROSSING_JOURNEY.id,
      runtimeState,
    });
    aee = await computeJourneyAeeOutcome({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      runtimeState,
      hostId: 'knyts-bridge',
      participantRef: persona?.personaId ?? 'anonymous',
      generatedAt: new Date().toISOString(),
      experience,
    });

    // AEE-XP-001 §11 XP-2 (2026-09-01) — Experience Architecture →
    // ExperiencePrescription → AEE Projection convergence. The Experience
    // Matrix/Guide's contribution (HOW richly to present the stage AEE just
    // recommended) — read via the SAME uncertainty-safe deriver every other
    // matrix surface uses (services/strategy/experienceMatrixDeriver.ts),
    // never a second calibration source. `matrixCalibration` stays null for
    // a signed-out caller (no persona to calibrate), which the assembler
    // treats identically to "uncertain: false" — a genuinely-absent context,
    // not a failed read.
    const admin = getSupabaseServer();
    const matrixCalibration =
      persona?.personaId && admin ? await deriveMatrixCalibration(admin, persona.personaId) : null;
    prescription = assembleExperiencePrescription({
      journeyDefinition: KNYTS_BRIDGE_CROSSING_JOURNEY,
      aee,
      matrixCalibration,
      surfaceTemplate: 'liquidui:knyts-bridge-fs-v1',
    });
  } catch {
    aee = null; // fall-open — never blocks the response
    prescription = null;
  }

  return NextResponse.json({ ok: true, state: runtimeState, personaAuthenticated, aee, prescription });
}
