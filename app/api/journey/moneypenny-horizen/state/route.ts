/**
 * GET /api/journey/moneypenny-horizen/state
 *
 * Assembles the AuthoritativePlatformState for the Horizen x MoneyPenny
 * Guided Journey (PRD-GJR-001) from real reads — MoneyPenny's live Agent
 * Card, and any activity receipts already recorded against her persona for
 * this journey's action types — and resolves it via resolveJourneyState().
 *
 * Honesty over completeness (CLAUDE.md "No Guessing"): most of this
 * journey's sovereign actions (Marketa's recommendation, sponsorship,
 * delegation, aigentMe activation, etc.) have not yet happened for real, so
 * their receipts do not exist yet and those stages correctly resolve
 * NOT_STARTED/READY, never fabricated as complete. As each real action ships
 * (services/passport/externalAgentAdmission.ts wiring, the Verify-stage
 * Pulse toggle, etc.) and starts writing receipts via createActivityReceipt,
 * this route picks them up automatically — no change needed here.
 *
 * persona_id is T0 (services/receipts/activityReceiptService.ts) — resolved
 * server-side only, never included in the JSON response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  findAgentReceiptRefs,
  findReceiptsByIds,
  readReceiptAnchorStatus,
  type ActivityActionType,
  type ReceiptStatus,
} from '@/services/receipts/activityReceiptService';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
import {
  classifyConsequenceProng,
  bestReceiptStatus,
  consequenceProngCopy,
} from '@/services/journey/consequenceForkProjection';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { resolveRegistrableAgent, DEFAULT_REGISTRABLE_AGENT_SLUG } from '@/services/horizen/registrableAgents';
import { resolveAgentRegistrationState } from '@/services/horizen/agentRegistrationBinding';
import { checkAuthorizationStoreAvailable } from '@/services/horizen/partnerAuthorizationStore';
import { resolvePassportEligibility } from '@/services/journey/passportEligibility';
import { resolveAgentAdmissionState } from '@/services/journey/agentAdmissionState';
import {
  journeyAct,
  readJourneyResolution,
  recordJourneyResolution,
  resolveMonotonicJourneyState,
  type BlockingReason,
} from '@/services/journey/stageResolution';
import { resolveRatificationRefs } from '@/services/journey/ratificationRefs';
import {
  resolveOrientationContext,
  orientationLegacyPrecedentEstablished,
  type OrientationContext,
} from '@/services/journey/orientationContext';
import {
  getAgreement,
  requireAuthorizedAgreement,
  agreementOwnerCommitment,
  type ConstitutionalAgreementRow,
} from '@/services/constitutional/constitutionalAgreement';
import type { ExceptionRecord } from '@/services/research/exceptionIsolation';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getActivePersona } from '@/services/identity/getActivePersona';
/*
 * `resolvePassportPrincipalForAuthUser` is deliberately NOT imported here.
 * It walks the DID chain, which belongs to identity VERIFICATION (passport-
 * native sign-in), never to ordinary Passport recognition — operator ruling
 * 2026-08-03: "Remove DID-based lookup from the ordinary Passport recognition
 * flow. Do not retain it as a fallback."
 */
import { isPassportUsable, loadUsableCitizenPassportForAuthProfile } from '@/services/identity/passportPrincipal';
import { readSettledFact, settleFact, isSettled } from '@/services/journey/settledFacts';
import { REGISTRATION_SEED_STANDING } from '@/services/journey/registrationStandingSeed';
// RETIRED (2026-08-12): awardRegistrationStandingSeedIfEligible — forward rule is
// "new admission Standing = 0, earned only through consequential contribution"
// import { awardRegistrationStandingSeedIfEligible } from '@/services/journey/registrationStandingSeedAward';
import { attemptPnlServiceVerificationIfEligible } from '@/services/horizen/pnlVerificationBoundary';
import type { discoverAndReceiptPnlServiceEvidence } from '@/services/horizen/pnlServiceVerification';
import {
  resolveAgentStateAxes,
  resolveBranchOffers,
  admissionMilestones,
  type VerificationStepState,
} from '@/services/journey/agentStateAxes';
import {
  resolveStandingEvidence,
  hasEffectiveStandingEvidence,
  effectiveStandingReceiptStatuses,
  type StandingEvidenceProjection,
} from '@/services/journey/standingEvidenceProjection';

export const dynamic = 'force-dynamic';

const JOURNEY_ACTION_TYPES: ActivityActionType[] = [
  'agent_card_discovered',
  'horizen_agent_registered',
  // Wallet Signing Topology (operator ruling 2026-08-01) — the Register
  // ceremony's five independent evidence types.
  'principal_registration_mandate_signed',
  'agent_registry_transaction_signed',
  'horizen_registration_submitted',
  'horizen_registration_confirmed',
  'agent_registry_binding_recorded',
  'horizen_pulse_authorized',
  'horizen_pnl_transparency_enabled',
  'agent_card_enriched',
  'agent_control_proven',
  // Orient stage (Threshold Journey — Orient + Consequence Fork, 2026-08-09).
  'orientation_ritual_completed',
  'marketa_eligibility_recommended',
  'operator_passport_validated',
  'agent_sponsorship_recorded',
  'agent_delegate_passport_issued',
  // Constitutional State Model Correction (2026-08-11) — the Activate stage's
  // own receipt. See services/journey/agentRegistryActivation.ts.
  'agent_registry_activated',
  /*
   * THE RECEIPT THE BUREAU ACTUALLY WRITES.
   *
   * `agent_delegate_passport_issued` is written by NOTHING in this codebase —
   * it is a receipt type the journey contract invented and then waited on. The
   * canonical issuance path (services/passport/issuanceService.ts) emits
   * `passport_issued` through the normal, DVN-anchored pipeline, exactly as the
   * operator said it should. So read THAT, and let the phantom type stand only
   * as a corroborating alias for any historical row that carries it.
   */
  'passport_issued',
  'agent_delegated',
  'finance_authoritative_execution',
  'standing_accrued',
  // Ingestion's OWN receipt. Deliberately distinct from standing_accrued:
  // becoming an eligible participant is not an accrual (operator, 2026-08-03).
  'capability_registered',
  // Independent, read-only P&L SERVICE VERIFICATION — deliberately distinct
  // from 'horizen_pnl_transparency_enabled' (disclosure AUTHORIZATION) above.
  // See services/horizen/pnlServiceVerification.ts's own header.
  'pnl_service_verified',
  // The Verifiable-PnL ONBOARDING/REGISTRATION receipt (Final Horizen
  // Projection Reconciliation, part 2, 2026-08-09) — the production
  // onboarding route (app/api/journey/moneypenny-horizen/pnl/onboard)
  // already emits this on a successful existing-mode registration; it was
  // simply missing from this observer's own canonical receipt set, so a
  // real, DVN-anchored registration could never surface here. Distinct from
  // BOTH `horizen_pnl_transparency_enabled` (disclosure authorization) and
  // `pnl_service_verified` (independently-correlated evidence) above — this
  // is the middle tier: Horizen's own onboarding service accepted this
  // agent.
  'pnl_service_registered',
  'aigentme_activated',
  'experienceqube_focus_disposition_recorded',
  'journey_completed',
];

/*
 * THIS ROUTE GREW, AND ITS FAILURE MODE GREW WITH IT (operator, 2026-08-03:
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input`
 * AGAIN).
 *
 * It now resolves settled facts, the registration ladder, the caller's
 * canonical Passport principal, WRITES two settlements, and persists a
 * journey resolution — where it once read receipts. Every one of those is a
 * remote call that can throw or hang, and an unhandled throw leaves the
 * platform to answer with zero bytes.
 *
 * I fixed exactly this on verify/authorize and did NOT apply it to the class.
 * That is why it came back on a different route: the defect was never
 * "verify/authorize is missing a catch", it was "a journey route may answer
 * with nothing". Both halves are now enforced by
 * tests/journey-response-honesty.test.ts across EVERY journey route and
 * EVERY journey client.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    return await resolveState(req);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'JOURNEY_STATE_UNAVAILABLE',
        error:
          `The journey state could not be resolved: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'No stage has changed — this is a read that failed, not an act that failed.',
      },
      { status: 500 },
    );
  }
}

async function resolveState(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const agentSlug = req.nextUrl.searchParams.get('agentSlug') ?? DEFAULT_REGISTRABLE_AGENT_SLUG;
  const agent = resolveRegistrableAgent(agentSlug) ?? resolveRegistrableAgent(DEFAULT_REGISTRABLE_AGENT_SLUG)!;

  let agentCard: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${origin}${agent.agentCardPath}`, { cache: 'no-store' });
    if (res.ok) agentCard = await res.json();
  } catch {
    // Soft-fail — Agent Card unreachable, Register stage stays evidence-incomplete.
  }

  const receiptRefs: Record<string, string[]> = {};
  // Consequence Fork projection (2026-08-09) — the same agent-scoped receipts,
  // carrying `receipt_status` so the fork can distinguish "evidence present"
  // from "DVN final" without a second source of truth.
  const receiptStatuses: Record<string, ReceiptStatus[]> = {};
  // Ratify sub-predicate projection (CFS-055 coherence pass, 2026-08-10) — the
  // SAME agent-scoped receipts' own `created_at`, carried alongside so a
  // sub-predicate's `effectiveAt` never needs a second, parallel query.
  const receiptCreatedAt: Record<string, string[]> = {};
  let aigentQubeResolved = false;
  /*
   * THE SETTLED REGISTRATION — RETRIEVED, NEVER RE-DERIVED.
   *
   * `resolveAgentRegistrationState` is the resolution boundary: it consults
   * the settled fact first and only reasons when nothing has been settled.
   * This route consumes its answer and must never reconstruct one of its own
   * from `hasReceipt(...)` — a sixth observer of "is Nakamoto registered"
   * would reintroduce exactly the defect
   * RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001 closed.
   */
  let registration: Awaited<ReturnType<typeof resolveAgentRegistrationState>> | null = null;
  let authorizationStore: Awaited<ReturnType<typeof checkAuthorizationStoreAvailable>> | null = null;
  /*
   * SPONSORSHIP, DELEGATE PASSPORT AND DELEGATION — read from the records those
   * acts write, never from their receipts alone (operator, 2026-08-03). See
   * services/journey/agentAdmissionState.ts for the defect this closes.
   */
  let admission: Awaited<ReturnType<typeof resolveAgentAdmissionState>> | null = null;
  /*
   * RATIFY — the Constitutional Agreement this operator holds for this agent,
   * read directly (never re-derived from a receipt scan — see the
   * `ratify-agreement` guarded read below for why).
   */
  let ratifyAgreement: ConstitutionalAgreementRow | null = null;
  let ratifyGateRecognized = false;
  // Consequence Fork projection (2026-08-09) — Ratify's authorization
  // receipts are tagged `agentsInvoked: ['aigent-z']` (the orchestrator),
  // never the subject agent, so the agent-scoped receipt scan above cannot
  // see them. Read by id, off the agreement row's own receipt reference —
  // the same targeted lookup `readReceiptAnchorStatus` already exists for.
  let ratifyAnchorStatus: ReceiptStatus | null | undefined = null;
  // Ratify sub-predicate projection (CFS-055 coherence pass, 2026-08-10) —
  // `formedReceiptId`/`authorizedReceiptId`'s own createdAt/receiptStatus,
  // read by id (same reason as `ratifyAnchorStatus` above: these receipts are
  // never agent-scoped) so `agreementAuthorized`'s effectiveAt/dvnStatus never
  // needs to be guessed or left null when the agreement itself is present.
  const ratifyAgreementReceiptDetails: Map<string, { createdAt: string; receiptStatus: ReceiptStatus }> = new Map();
  /*
   * PERSONA ASSIGNMENT ≠ aigentMe DESIGNATION (al, 2026-08-04). Whether the
   * OPERATOR's active persona has structurally assigned this agent as a
   * delegate (persona_agent_assignments, role IN 'delegate'/'aigentMe' — both
   * count as "assigned"; which one is aigentMe is a wholly separate fact this
   * read never touches). Delegate's completion needs this alongside the
   * Passport + grant; it must never be inferred from — or conflated with —
   * aigentMe designation.
   */
  let personaAssignedAsDelegate: boolean | undefined;
  let priorResolution: Awaited<ReturnType<typeof readJourneyResolution>> = null;
  // Orient's contextual ritual — resolved from the OPERATOR's own prior
  // constitutional history, never from which agent is selected (see
  // services/journey/orientationContext.ts). null only when no active
  // persona could be resolved on this request — an audit gap, never guessed.
  let orientationContext: OrientationContext | null = null;
  /*
   * ══ THE OPERATOR'S OWN PASSPORT — RECOGNIZED, NEVER RE-APPLIED FOR ═══════
   *
   * `known: false` means the canonical state could not be READ. It is an
   * evidence gap, not a finding that no Passport exists — the same distinction
   * `resolveAgentRegistrationState` draws between `unresolved` and
   * `registered: false`, and the reason this is a three-state value rather
   * than a boolean.
   */
  let registrationStandingSeeded = false;
  /*
   * THE CANONICAL, CORRECTION-AWARE STANDING PROJECTION (Horizen Pilot
   * Closure — Final Standing + DVN Closure, 2026-08-09). Every later
   * consumer of Standing evidence — `standingGatewayEnabled`, the axis's
   * `standingReceipts`/`initialStandingAwarded`, and the consequence fork's
   * `receiptStatuses['standing_accrued']` — reads THIS, never a raw
   * `receiptRefs['standing_accrued']` scan, so a superseded or sequencing-
   * invalid receipt cannot re-enable Stand through one path while another
   * path correctly excludes it. See services/journey/
   * standingEvidenceProjection.ts's own header for the two defects this
   * closes. `null` only on a failed read — an audit gap, never treated as
   * "no evidence".
   */
  let standingEvidence: StandingEvidenceProjection | null = null;
  /*
   * P&L SERVICE VERIFICATION — the result of THIS request's attempt, if any
   * (Horizen Pilot Closure item 4, 2026-08-09). Deliberately a distinct
   * variable from anything Pulse-authorization-related: `verified: true`
   * here means Horizen's own Verifiable-PnL service independently correlated
   * a record for this exact agent/token/chain — a materially different,
   * stronger claim than `horizen_pnl_transparency_enabled` (disclosure scope
   * was authorized). Null means no attempt was made this request (not
   * eligible yet, or already verified with nothing new to attempt).
   */
  let pnlVerification: Awaited<ReturnType<typeof discoverAndReceiptPnlServiceEvidence>> | null = null;
  let operatorPassport: { known: boolean; valid: boolean; personhood: boolean; detail?: string } = {
    known: false,
    valid: false,
    personhood: false,
  };
  // Hoisted so the agent-admission read (below) can sponsor a migrated
  // agent's RootDID mint from the SAME caller the passport read resolves —
  // one authoritative caller-identity read, not two.
  let caller: Awaited<ReturnType<typeof getCallerIdentityContext>> | null = null;
  /*
   * EACH FACT IS GUARDED ALONE (operator, 2026-08-03: "A constitutional fact
   * should be computed once, settled once, and consumed everywhere").
   *
   * Everything below sat in ONE try with an empty catch. A throw in ANY read
   * — the receipt query, the passport walk, the store probe — silently nulled
   * EVERY LATER fact, including `registration` and `priorResolution` (the
   * monotonic floor). The journey then rendered "Continue to Register" and
   * "Resolve your Citizen Passport" against an agent whose registration the
   * same screen displayed as token 8798. One failed read must degrade one
   * fact, never the set.
   */
  const guarded = async (label: string, step: () => Promise<void>) => {
    try {
      await step();
    } catch (err) {
      console.error(`[JOURNEY STATE] ${label} read failed`, err instanceof Error ? err.message : err);
    }
  };
  {
    const supabase = getSupabaseServer();
    /*
     * FIND THIS AGENT'S RECEIPTS BY THE AGENT, NOT BY A PERSONA (2026-08-03).
     *
     * This resolved the AGENT's own persona (`fio_handle = nakamoto@aigent`)
     * and listed ITS receipts — but every journey receipt is written with
     * `personaId: actorPersonaId`, the OPERATOR who acted (ArkAgent). The
     * agent's persona therefore never holds them: `receiptRefs` came back
     * empty, every `hasReceipt(...)` below was false, and Register could
     * never reach COMPLETE no matter how completely it had succeeded.
     *
     * Aigent Nakamoto's confirmed registration (tokenId 8798) sat behind
     * exactly this: a real receipt, looked for under the wrong persona.
     * Identical defect to the one fixed in agentRegistrationBinding.ts the
     * same day — see OS-6 in
     * codexes/packs/agentiq/updates/2026-08-03_observer-state-invariants.md.
     */
    if (supabase) await guarded('receipts', async () => {
      /*
       * `limit` is now PER ACTION TYPE, not a global ceiling across every
       * type combined (services/receipts/activityReceiptService.ts,
       * 2026-08-09 — "Final Horizen Projection Reconciliation" part 5). 20 of
       * THIS agent's own rows per type is far more than "strongest/latest"
       * ever needs, and growth in one action type's receipt volume can no
       * longer crowd another action type's evidence out of this read.
       */
      const refs = await findAgentReceiptRefs(agent.runtimeAgentId, JOURNEY_ACTION_TYPES, { limit: 20 });
      for (const ref of refs) {
        (receiptRefs[ref.actionType] ??= []).push(ref.id);
        // Consequence Fork projection (2026-08-09) — the SAME read, carrying
        // the status column it always had. Never a second query.
        (receiptStatuses[ref.actionType] ??= []).push(ref.receiptStatus);
        // Ratify sub-predicate projection (2026-08-10) — same read again.
        (receiptCreatedAt[ref.actionType] ??= []).push(ref.createdAt);
      }
    });
    if (supabase) await guarded('standing-evidence', async () => {
      standingEvidence = await resolveStandingEvidence(agent.runtimeAgentId);
    });
    if (supabase) await guarded('aigentqube', async () => {
      // §3.1.1 correction — Register requires a real, persisted AigentQube
      // before anything else (registered externally != backed by an AigentQube).
      const { data: aigentQube } = await supabase
        .from('registry_assets')
        .select('asset_id')
        .eq('asset_id', agent.aigentQubeId)
        .maybeSingle();
      aigentQubeResolved = !!aigentQube;
    });
    if (supabase) await guarded('registration', async () => {
      registration = await resolveAgentRegistrationState(supabase, agent);
    });
    /*
     * P&L SERVICE VERIFICATION — wired generically at the boundary where a
     * subject to correlate first becomes known: a confirmed registration's
     * own tokenId/registryAgentId (Horizen Pilot Closure item 4, 2026-08-09).
     *
     * discoverAndReceiptPnlServiceEvidence (services/horizen/pnlServiceVerification.ts)
     * was fully built and tested but had zero production callers — only a
     * manual CLI script exercised it. Never coupled to Pulse admission or the
     * Ratify gate (per the operator's own ratified rule,
     * RES-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001 / CI-2026-08-08-PNL-
     * INDEPENDENT-EVIDENCE-001: "Pulse Verified is sufficient to close
     * Ratify. P&L verification is an independent, asynchronous capability
     * transition.") — this block only ever ADDS a distinct evidence field,
     * never gates or blocks anything else in this response.
     *
     * Read-only and idempotent by the function's own construction (an
     * existing `pnl_service_verified` receipt short-circuits with no live
     * call). Agent-generic: `subjectRegistryAlias` and `network` come from
     * THIS agent's own resolved registration, never a hardcoded token.
     */
    if (supabase) await guarded('pnl-service-verification', async () => {
      const activePersona = await getActivePersona(req);
      pnlVerification = await attemptPnlServiceVerificationIfEligible(agent, registration, activePersona?.personaId ?? null);
      // Reflected in THIS response without a second round-trip, same
      // discipline as the standing-seed block above.
      if (pnlVerification?.ok && pnlVerification.verified && pnlVerification.receiptRef) {
        (receiptRefs['pnl_service_verified'] ??= []).push(pnlVerification.receiptRef);
      }
    });
    if (supabase) await guarded('passport', async () => {
      /*
       * ORDER MATTERS, and it is the settled-fact order: RETRIEVE, then read,
       * then corroborate. A Passport already settled is never re-derived.
       */
      registrationStandingSeeded = isSettled(
        await readSettledFact(supabase, agent.aigentQubeId, agent.runtimeAgentId, 'registry_standing_seeded'),
      );

      const settledPassport = await readSettledFact(supabase, agent.aigentQubeId, 'operator', 'passport_is_issued');
      caller = await getCallerIdentityContext(req);
      if (isSettled(settledPassport)) {
        operatorPassport = { known: true, valid: true, personhood: true };
      } else {
        const authUserId = caller?.authUserId ?? null;
        if (!authUserId) {
          operatorPassport = { known: false, valid: false, personhood: false, detail: 'no authenticated caller on this request' };
        } else {
          /*
           * ══ THE PASSPORT IS THE SURFACED CONSTITUTIONAL IDENTIFIER ═══════
           *
           * Operator ruling, 2026-08-03:
           *
           *   > "The Passport is the surfaced constitutional identifier. The
           *   >  DID is a protected sovereign identity primitive used behind
           *   >  the Passport's cryptographic binding, not a routine discovery
           *   >  key."
           *
           *   > "Remove DID-based lookup from the ordinary Passport
           *   >  recognition flow. Do not retain it as a fallback."
           *
           * The recognition path is:
           *
           *   active persona / account   (an ACCESS CONTEXT, not the credential)
           *     -> credential store
           *       -> surfaced Passport VC
           *         -> validate class + status
           *           -> recognise constitutional personhood
           *
           * It is NOT persona -> KybeDID/RootDID -> search for Passport. That
           * ordering inverted the dependency (issuance MINTS the DID, so
           * requiring one to find a credential answers "no Passport" for every
           * subject whose DID has not been minted), and it also disclosed a
           * protected primitive to answer a routine question.
           *
           * TWO SUCCESSIVE CORRECTIONS LANDED HERE. First the ordering was
           * inverted, leaving the DID walk as a fallback. The operator then
           * ruled the fallback out entirely: a Citizen Passport is an ANONYMOUS
           * personhood identifier, and recognising it must not require
           * disclosing the kybe behind it. Raw DID disclosure belongs only to an
           * explicit identity-verification act — never to stage recognition.
           *
           * `resolvePassportPrincipalForAuthUser` is deliberately NOT called
           * here any more. It remains correct for passport-native SIGN-IN,
           * which is that separate verification context and legitimately needs
           * a kybe-anchored principal to mint a session.
           *
           * Role separation is structural: the lookup filters
           * `passport_class = 'citizen'` in the query, so an agent's
           * `agent_participant` credential can never answer the principal's
           * question. Nakamoto, arriving from the Horizen registry, is not
           * expected to hold a RootDID — her Delegate Passport will create it.
           */
          const credential = await loadUsableCitizenPassportForAuthProfile(supabase, caller?.authProfileId ?? '');

          if (credential.ok) {
            /*
             * PERSONHOOD IS ESTABLISHED BY THE CREDENTIAL ITSELF. A Citizen
             * Passport IS the anonymous personhood identifier — there is no
             * further lineage to walk, and no kybe to read, before saying so.
             */
            const usable = isPassportUsable(credential.passport);
            operatorPassport = { known: true, valid: usable, personhood: true };
            if (usable) {
              await settleFact(supabase, agent.aigentQubeId, {
                subject: 'operator',
                predicate: 'passport_is_issued',
                object: {
                  passportClass: credential.passport.passportClass,
                  citizenStatus: credential.passport.citizenStatus,
                  participantStatus: credential.passport.participantStatus,
                },
                /*
                 * T0 DISCIPLINE, AND THE SOVEREIGN-PRIMITIVE RULE. No kybe,
                 * no root id, no authUserId is recorded — none is even read on
                 * this path. The evidence ref names the SOURCE of the
                 * resolution, never an identifier.
                 */
                evidenceRefs: ['canonical:polity_passport_records', 'resolver:loadUsableCitizenPassportForAuthProfile'],
                resolutionAuthority: 'app/api/journey/moneypenny-horizen/state:passport-credential-read',
              });
            }
          } else if (credential.reason === 'no_passport' || credential.reason === 'passport_inactive') {
            /*
             * READ, and genuinely absent or inactive — a real negative finding,
             * and the one case where routing to Citizen issuance is correct.
             * `personhood: true` because the credential store answered: we know
             * this caller, they simply hold no usable Passport yet.
             */
            operatorPassport = { known: true, valid: false, personhood: true, detail: credential.reason };
          } else {
            /*
             * unavailable | principal_unprovisioned — COULD NOT DETERMINE.
             * Never "no Passport", and explicitly never retried down a DID
             * path: an unreadable credential store is an infrastructure fault,
             * not a constitutional finding about the holder.
             */
            operatorPassport = { known: false, valid: false, personhood: false, detail: credential.reason };
          }
        }
      }
    });
    if (supabase) await guarded('agent-admission', async () => {
      /*
       * Constitutional State Model Correction (2026-08-11) — the resolver's
       * OWN registry-activation check needs an authenticated persona to
       * attribute a freshly-established `agent_registry_activated` receipt
       * to. `null` here (no active persona) is never an error: the check
       * still runs and reports honestly (`eligible-awaiting-actor`), it
       * just performs no write — see agentRegistryActivation.ts's own
       * five-valued outcome. This route never calls
       * `ensureAgentRegistryActivation` itself; it only reads
       * `admission.registryActivated` below.
       */
      const activePersonaForActivation = await getActivePersona(req);
      admission = await resolveAgentAdmissionState(
        supabase,
        agent,
        caller?.authProfileId ?? null,
        activePersonaForActivation?.personaId ?? null,
      );
    });
    /*
     * REGISTRATION STANDING SEED — awarded inline, the same idiom this route
     * already uses for `passport_is_issued` above: a settled fact observed
     * eligible is settled HERE, not deferred to a UI action nobody wires.
     *
     * Horizen Pilot Closure item 2 (operator, 2026-08-09): the seed
     * (services/journey/registrationStandingSeed.ts) was fully specified —
     * amount, basis, the settle-then-award contract — but had ZERO production
     * callers. The state route READ the settled fact
     * (`registrationStandingSeeded` above) but nothing ever WROTE it, so
     * `initialStandingAwarded` below was always 0 for every agent, forever.
     * See RES-2026-08-09-STANDING-SEED-PRODUCTION-WIRING-001.
     *
     * Eligibility reuses the EXACT SAME `capability_registered` receipt
     * `factoryIngested` is computed from below — never a third, parallel
     * eligibility check. `admission?.factoryPresent` (mere AigentQube/
     * registry-row EXISTENCE) is deliberately NOT part of this — see the
     * "AigentQube Presence ≠ Factory Ingestion" correction below.
     *
     * ── AigentQube Presence ≠ Factory Ingestion (operator correction, 2026-08-09) ──
     *
     * `factoryIngestedNow` used to be `admission?.factoryPresent === true ||
     * capabilityReceiptIds.length > 0`. `admission.factoryPresent` answers
     * "does this agent's AigentQube row exist in registry_assets" — a fact
     * introduced as a PREREQUISITE FOR REGISTER (the AigentQube entrance
     * gate), not evidence that Factory ingestion ever happened. Once that
     * gate started writing the SAME registry_assets row the Deploy/Ingest
     * stage was ALSO reading as its own completion evidence, the two
     * genuinely different facts collapsed: repairing an agent's AigentQube
     * (a Register-stage prerequisite) silently satisfied Ingest's evidence
     * and — because `resolveJourneyState` lets established completion
     * evidence outrank an unmet prerequisite (the "evidence precedes
     * prerequisite gating" rule, services/journey/resolveJourneyState.ts) —
     * let Ingest and then Standing render COMPLETE before Claim/Orient/
     * Passport/Delegate/Operate had ever happened. Observed live on
     * MoneyPenny immediately after her AigentQube was repaired this session.
     *
     * The fix: Factory ingestion is ONLY the `capability_registered`
     * receipt, never registry presence. And because a receipted evidence
     * field can still — by the same "evidence precedes prerequisite" rule —
     * outrank the `aigentme` prerequisite if something ever mis-writes that
     * receipt early, the SEED AWARD specifically (never merely the evidence
     * field) requires aigentMe/Operate's OWN canonical completion fact
     * (`aigentme_activated` AND `experienceqube_focus_disposition_recorded`
     * receipts — the exact pair `axes`/`canonicalStages.aigentme` compute
     * below, read here directly off `receiptRefs` since this block runs
     * before that computation) as a second, independent gate — belt and
     * suspenders, not a redefinition of what Operate-complete means.
     *
     * Idempotent by construction: `settleFact` returns `alreadySettled: true`
     * on every call after the first and does not overwrite, so this block is
     * safe to run on every request (a page refresh, a retried reconciliation,
     * concurrent tabs) without risk of a second award — the invariant the
     * operator asked for ("cannot award repeatedly because reconciliation/UI
     * is retried") is `settleFact`'s own guarantee, not a new one.
     *
     * Attribution: the ACTIVE OPERATOR persona, resolved the same way the
     * ratify-agreement block below resolves it — never a static resolver
     * string, because a Standing award (unlike Passport recognition) needs a
     * real "who" for the audit trail. No active persona resolvable -> skipped
     * as an audit gap, never guessed.
     */
    if (supabase) await guarded('standing-seed', async () => {
      // RETIRED (2026-08-12): Forward canonical rule (operator ruling 2026-08-09) is
      // "new admission Standing = 0, earned only through qualifying consequential
      // contribution". The superseded registration-seed award machinery
      // (awardRegistrationStandingSeedIfEligible) is preserved as immutable history
      // and filtered by the correction-aware standing evidence projection
      // (standingEvidenceProjection.ts), but no new seeds are awarded from this
      // request forward. Historical seeds remain for audit continuity; they do
      // not drive present Standing gates.
      //
      // Old code paths for reference — DO NOT REACTIVATE WITHOUT OPERATOR APPROVAL:
      // const capabilityReceiptIds = receiptRefs['capability_registered'] ?? [];
      // const activePersona = await getActivePersona(req);
      // if (!activePersona?.personaId) return;
      // const genuinelyFactoryIngested = capabilityReceiptIds.length > 0;
      // const aigentMeActiveForSeed =
      //   (receiptRefs['aigentme_activated']?.length ?? 0) > 0 &&
      //   (receiptRefs['experienceqube_focus_disposition_recorded']?.length ?? 0) > 0;
      // const outcome = await awardRegistrationStandingSeedIfEligible(...);
      // if (!outcome.awarded) return;
      // registrationStandingSeeded = true;
      // if (outcome.receiptId) (receiptRefs['standing_accrued'] ??= []).push(...);
    });
    if (supabase) await guarded('persona-assignment', async () => {
      const agentRootId = admission?.agentRootId;
      if (!agentRootId) return; // no root identity resolved — genuinely nothing to assign yet
      const activePersona = await getActivePersona(req);
      if (!activePersona?.personaId) return;
      const { data, error } = await supabase
        .from('persona_agent_assignments')
        .select('role')
        .eq('persona_id', activePersona.personaId)
        .eq('agent_root_id', agentRootId)
        .eq('active', true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      // Either role counts as "assigned" — aigentMe is a separate designation
      // layered on TOP of being assigned, never a substitute for it.
      personaAssignedAsDelegate = Boolean(data && (data.role === 'delegate' || data.role === 'aigentMe'));
    });
    if (supabase) await guarded('authorization-store', async () => {
      authorizationStore = await checkAuthorizationStoreAvailable(supabase);
    });
    /*
     * RATIFY'S CANONICAL RECORD — the constitutional_agreements row itself,
     * never a receipt scan (operator instruction 2026-08-06: "Stage
     * completion must derive from the canonical constitutional_agreements
     * record and its receipts"). `agreement_formed`/`agreement_authorized`
     * receipts are written with `agentsInvoked: ['aigent-z']`
     * (constitutionalAgreement.ts's acceptAgreement/authorizeAgreement) —
     * NOT the selected agent's own runtimeAgentId — so the persona's
     * `hasReceipt()` scan above (agents_invoked-filtered) would never find
     * them for this agreement. The row's own `formedReceiptId`/
     * `authorizedReceiptId` are the precise, agreement-scoped answer to
     * "are the receipts available", and are read directly instead.
     */
    if (supabase) await guarded('ratify-agreement', async () => {
      const activePersona = await getActivePersona(req);
      const ratifyPersonaId = activePersona?.personaId;
      if (!ratifyPersonaId) return;
      const refs = resolveRatificationRefs(agent.slug);
      const row = await getAgreement(refs.agreementId);
      // Only THIS operator's own agreement counts — an agreement the row's
      // owner-commitment does not match is evidence-absent for this caller,
      // never fabricated as theirs.
      ratifyAgreement =
        row && row.object.ownership.ownerCommitment === agreementOwnerCommitment(ratifyPersonaId) ? row : null;
      const gate = await requireAuthorizedAgreement({
        capabilityRef: refs.capabilityRef,
        selectedAgentRef: refs.selectedAgentRef,
        requestingPersonaId: ratifyPersonaId,
      });
      ratifyGateRecognized = gate.ok;
    });
    if (supabase) await guarded('ratify-anchor-status', async () => {
      if (!ratifyAgreement?.authorizedReceiptId) return;
      ratifyAnchorStatus = await readReceiptAnchorStatus(ratifyAgreement.authorizedReceiptId);
    });
    if (supabase) await guarded('ratify-agreement-receipt-details', async () => {
      const ids = [ratifyAgreement?.formedReceiptId, ratifyAgreement?.authorizedReceiptId].filter(
        (id): id is string => !!id,
      );
      if (ids.length === 0) return;
      const rows = await findReceiptsByIds(ids);
      for (const { record } of rows) {
        ratifyAgreementReceiptDetails.set(record.id, { createdAt: record.createdAt, receiptStatus: record.receiptStatus });
      }
    });
    if (supabase) await guarded('prior-resolution', async () => {
      priorResolution = await readJourneyResolution(supabase, agent.aigentQubeId, HORIZEN_MONEYPENNY_JOURNEY.id);
    });
    /*
     * ORIENT — resolved from the OPERATOR's own prior constitutional history
     * (see services/journey/orientationContext.ts), never re-derived here.
     * Uses the same active-persona resolution as every other operator-scoped
     * guarded read above; no active persona resolvable is an audit gap, left
     * null, never guessed.
     */
    if (supabase) await guarded('orientation-context', async () => {
      const activePersona = await getActivePersona(req);
      if (!activePersona?.personaId) return;
      orientationContext = await resolveOrientationContext(activePersona.personaId, agent);
    });
  }

  const hasReceipt = (type: ActivityActionType) => (receiptRefs[type]?.length ?? 0) > 0;

  // AGREEMENT_LIFECYCLE order (constitutionalAgreement.ts) — a rank comparison
  // so "authorized" also counts as "at least accepted", without re-declaring
  // the lifecycle's order a second time.
  const AGREEMENT_STATUS_RANK: Record<string, number> = {
    proposed: 0,
    accepted: 1,
    authorized: 2,
    executed: 3,
    settled: 4,
    reconstitutable: 5,
  };
  const ratifyAgreementStatusAtLeast = (min: string): boolean =>
    !!ratifyAgreement && (AGREEMENT_STATUS_RANK[ratifyAgreement.status] ?? -1) >= (AGREEMENT_STATUS_RANK[min] ?? Infinity);

  /*
   * ONE FACT, ONE EXPRESSION. "This agent has a Delegate Passport" is read by
   * the Passport stage, the Delegate stage AND the canonical-stage map — three
   * places that were three separate expressions and had already drifted apart
   * once (the Delegate stage was still receipt-only after Passport went
   * canonical-first). Naming it once makes the drift impossible rather than
   * merely unlikely.
   *
   * Canonical first (the issued Passport record), receipts as corroboration —
   * `passport_issued` being the one the Bureau actually writes.
   */
  const passportIssuedForAgent =
    admission?.delegatePassportIssued === true ||
    hasReceipt('passport_issued') ||
    hasReceipt('agent_delegate_passport_issued');

  const horizen = (agentCard?.metadata as Record<string, unknown> | undefined)?.horizen as
    | Record<string, unknown>
    | undefined;

  const platformState: AuthoritativePlatformState = {
    receiptRefs,
    stages: {
      register: {
        aigentQubeResolved,
        tokenId: (horizen?.tokenId as string | null) ?? null,
        registryRereadOk: hasReceipt('horizen_agent_registered'),
        ownerWalletMatches: hasReceipt('horizen_agent_registered'),
        agentCardResolves: !!agentCard,
        // Wallet Signing Topology (operator ruling 2026-08-01) — Register
        // reaches COMPLETE only once the full wallet-mediated ceremony has
        // run, not merely on the pre-ceremony horizen_agent_registered receipt.
        principalRegistrationMandateSigned: hasReceipt('principal_registration_mandate_signed'),
        agentRegistryTransactionSigned: hasReceipt('agent_registry_transaction_signed'),
        horizenRegistrationSubmitted: hasReceipt('horizen_registration_submitted'),
        horizenRegistrationConfirmed: hasReceipt('horizen_registration_confirmed'),
        agentRegistryBindingRecorded: hasReceipt('agent_registry_binding_recorded'),
      },
      verify: {
        /*
         * PRIMARY — the Constitutional Agreement lifecycle. Gates
         * completion (named in the stage's own `completionEvidence`,
         * horizenMoneyPennyJourney.ts). Ranked off the row's own
         * AGREEMENT_LIFECYCLE status, read canonically above — never
         * inferred from a receipt.
         */
        agreementTermsCommitted: !!ratifyAgreement,
        agreementAcceptanceRecorded: ratifyAgreementStatusAtLeast('accepted'),
        agreementAuthorized: ratifyAgreementStatusAtLeast('authorized'),
        // The row's OWN receipt ids — precise to this agreement, unlike a
        // persona-wide agents_invoked receipt scan (see the guarded read's
        // comment for why `agentsInvoked: ['aigent-z']` makes hasReceipt()
        // the wrong tool here).
        agreementReceiptsAnchored: !!ratifyAgreement?.formedReceiptId && !!ratifyAgreement?.authorizedReceiptId,
        agreementGateRecognized: ratifyGateRecognized,
        /*
         * SECONDARY — Transparency. Real Pulse/P&L/Agent Card enrichment,
         * kept in the evidence record for the Transparency section to
         * display, but deliberately absent from `completionEvidence` above
         * — an unresolved or unavailable partner enrichment must never
         * block Ratify once the service agreement is authorized (operator
         * instruction, 2026-08-06).
         */
        pulseAuthorizationVerified: hasReceipt('horizen_pulse_authorized'),
        pnlTransparencyEnabled: hasReceipt('horizen_pnl_transparency_enabled'),
        /*
         * DISTINCT FROM pnlTransparencyEnabled ABOVE — authorization vs
         * verification, never conflated (Horizen Pilot Closure item 4). True
         * only when Horizen's own Verifiable-PnL service has independently
         * correlated a record for this exact agent/token/chain.
         */
        pnlServiceVerified: hasReceipt('pnl_service_verified'),
        /*
         * MIDDLE TIER — Horizen's own onboarding acceptance (Final Horizen
         * Projection Reconciliation part 2, 2026-08-09). Surfaced here for
         * completeness alongside its siblings; the client-facing read is
         * `pnlEvidence` below, which also carries DVN finality detail this
         * plain boolean cannot.
         */
        pnlServiceRegistered: hasReceipt('pnl_service_registered'),
        agentCardEnrichmentCommitted: hasReceipt('agent_card_enriched'),
      },
      claim: {
        /*
         * CLAIM'S ONLY REQUIREMENT (operator, 2026-08-03). `marketaFinalRecommendation`
         * was a second field here; Marketa is a post-aigentMe financial-services
         * enrichment and gates nothing on the admission spine.
         */
        controlProofFresh: hasReceipt('agent_control_proven'),
      },
      orient: {
        /*
         * TWO WAYS TO SATISFY ORIENT, NEVER CONFLATED (Horizen Journey
         * correction, 2026-08-09):
         *
         *   1. The operator's explicit acknowledgment act (app/api/journey/
         *      moneypenny-horizen/orient/acknowledge/route.ts).
         *   2. LEGACY PRECEDENT — this agent already crossed the stronger
         *      downstream boundary (issued Delegate Passport, active bounded
         *      delegation, activated aigentMe/Operate) before Orient existed
         *      as a stage. Nakamoto is exactly this case: her admission
         *      completed before Orient was inserted into the spine, so no
         *      `orientation_ritual_completed` receipt can or should exist for
         *      her — fabricating one would counterfeit an acknowledgment she
         *      never performed. `orientationLegacyPrecedentEstablished`
         *      (services/journey/orientationContext.ts) is the ONE place this
         *      three-fact rule is decided; a NEW agent cannot satisfy it
         *      because reaching all three facts requires passing Orient for
         *      real first.
         *
         * Never merely having viewed the stage — that satisfies neither path.
         */
        orientationComplete:
          hasReceipt('orientation_ritual_completed') ||
          orientationLegacyPrecedentEstablished({
            delegatePassportIssued: passportIssuedForAgent,
            delegationActive: admission?.delegationActive === true,
            aigentMeActivated: hasReceipt('aigentme_activated'),
          }),
      },
      passport: {
        /*
         * ONE FACT, ONE SOURCE — inside one file (2026-08-03).
         *
         * The canonical Passport read below (`operatorPassport`) was wired
         * into the eligibility gate but NOT into this evidence checklist,
         * which kept deriving the same fact from `hasReceipt` alone. So an
         * operator holding a Passport issued through the Bureau would pass
         * the gate and still see "operator Passport not validated" on the
         * stage's evidence line.
         *
         * That is the exact defect this session has chased all day — one fact
         * with two observers reaching two answers — reintroduced a few
         * hundred lines apart in a single route. Canonical first, receipt as
         * corroboration, identical to lines below.
         */
        operatorPolityCitizenPassportValid: operatorPassport.valid || hasReceipt('operator_passport_validated'),
        /*
         * CANONICAL FIRST, receipt as CORROBORATION — the same correction made
         * to `operatorPolityCitizenPassportValid` above, now applied to its
         * siblings. A steward's approval writes a Passport record; it does not
         * necessarily write a receipt, and the absence of one is an audit gap,
         * never evidence the approval did not happen.
         */
        sponsorBinding: admission?.sponsorshipRecorded === true || hasReceipt('agent_sponsorship_recorded'),
        delegatePassportIssued: passportIssuedForAgent,
      },
      /*
       * ── ACTIVATE — A DERIVED CONSTITUTIONAL TRANSITION, NEVER AN ACT ─────
       *
       * Constitutional State Model Correction (operator-ratified 2026-08-11).
       * `registryActivated` is READ ONLY here — this route never calls
       * `ensureAgentRegistryActivation` itself. The write happens at the
       * Passport-completion boundary inside `resolveAgentAdmissionState`
       * (services/journey/agentAdmissionState.ts), the moment it observes
       * `sponsorshipRecorded` and `delegatePassportIssued` both true for an
       * authenticated caller. This evidence block simply surfaces whatever
       * that resolver already settled — canonical first, receipt as
       * corroboration, same discipline as every other stage in this file.
       *
       * Deliberately carries NO `operationalBlockers` entry anywhere in this
       * route (see the `operationalBlockers: { verify, passport }` map
       * below) — Activate has no operator-facing act to perform, so it
       * structurally cannot acquire the "COMPLETE stage still asserting its
       * own predicate absent" contradiction the 2026-08-11 audit found on
       * the Passport stage. `tests/registry-activation.test.ts` pins this.
       */
      activate: {
        registryActivated: admission?.registryActivated === true || hasReceipt('agent_registry_activated'),
      },
      delegate: {
        delegatePassportActive: passportIssuedForAgent,
        boundedDelegationActive: admission?.delegationActive === true || hasReceipt('agent_delegated'),
        // Structural assignment (persona_agent_assignments) — independent of
        // aigentMe designation. See the `persona-assignment` guarded read above.
        personaAssignedAsDelegate: personaAssignedAsDelegate === true,
        // Retained for FS-branch visibility only — no longer part of
        // Delegate's own completionEvidence (al, 2026-08-04): these are FS
        // Runtime activation signals, not delegation conditions. The `verify`
        // stage is where a future FS-specific checklist would surface them.
        contextualMandate: admission?.delegationActive === true || hasReceipt('agent_delegated'),
        bootstrapApproval: hasReceipt('finance_authoritative_execution'),
        aigentZObserverReceipt: hasReceipt('finance_authoritative_execution'),
        fsRuntimeActive: hasReceipt('finance_authoritative_execution'),
      },
      /*
       * ── THE STAGE ID IS `deploy`, AND THIS KEY SAID `activate` ────────────
       *
       * The Deploy stage was renamed from Activate on 2026-08-02 and the
       * Standing stage was split out of it. This evidence map kept the old
       * key. `resolveMonotonicJourneyState` looks stage evidence up BY STAGE
       * ID, so `deploy` and `standing` were reading an evidence record that
       * did not exist — every field missing, every request, forever — while
       * `activate` sat here describing a stage no longer in the journey.
       *
       * That is why neither could ever turn emerald: not a gating decision, a
       * key that stopped matching its stage and no canary that compared the
       * two. `tests/journey-admission-spine.test.ts` now asserts every stage
       * id has an evidence entry and every evidence key names a real stage.
       */
      deploy: {
        /*
         * FACTORY INGESTION IS THE RECEIPT — REGISTRY PRESENCE IS NOT
         * (operator correction, 2026-08-09, superseding the 2026-08-03
         * "presence in the registry IS the receipt" ruling).
         *
         * That 2026-08-03 ruling was true when `registry_assets` presence
         * for this agent's asset_id could ONLY be a side effect of genuine
         * Factory ingestion. The AigentQube entrance gate (added later)
         * writes a row to the SAME table for a DIFFERENT reason — "this
         * agent has a persisted constitutional information object", a
         * Register-stage prerequisite, not Factory participation. Once both
         * facts shared one signal, `admission?.factoryPresent` stopped
         * meaning "ingested" and started meaning "AigentQube exists", and
         * repairing an agent's AigentQube (Register-stage work) silently
         * completed Ingest for it. `capability_registered` is the ONLY
         * evidence for this fact now — the receipt Factory ingestion
         * itself writes, never inferred from a shared registry row.
         */
        factoryIngested: hasReceipt('capability_registered'),
      },
      standing: {
        // Standing is EARNED. It is the one stage with no canonical shortcut:
        // an accrual receipt is the accrual. Reading registry presence here
        // would recreate the exact ingestion-equals-accrual collapse the
        // operator's ruling forbids.
        //
        // NOT bare `hasReceipt('standing_accrued')` (operator correction,
        // 2026-08-09) — a receipt superseded by a governed correction (or
        // one that predates any genuine capability_registered receipt) is
        // preserved as immutable history but must stop exerting a PRESENT
        // consequence. `standingEvidence` is the one canonical, correction-
        // aware projection every Standing consumer in this route reads —
        // see services/journey/standingEvidenceProjection.ts.
        standingGatewayEnabled: standingEvidence ? hasEffectiveStandingEvidence(standingEvidence) : false,
      },
      aigentme: {
        aigentMeActive: hasReceipt('aigentme_activated'),
        focusDispositionRecorded: hasReceipt('experienceqube_focus_disposition_recorded'),
        moneypennyRecordedAsDelegatedAgent: hasReceipt('agent_delegated'),
        evidenceChainComplete: hasReceipt('journey_completed'),
      },
    },
  };

  /*
   * ══ STAGE TRUTH, THEN STAGE EVIDENCE ═════════════════════════════════════
   *
   * Register's canonical outcome is the SETTLED FACT — not the ten receipts.
   * Several of those receipt types postdate Nakamoto's real registration (the
   * Wallet Signing Topology ruling introduced them on 2026-08-01), so they do
   * not exist for it and never will. Under the old single boolean that
   * unrecoverable paperwork gap rendered as "not registered". It is now what
   * it actually is: a canonically complete stage with partial evidence and
   * named audit gaps.
   */
  const storeUnavailable = authorizationStore ? authorizationStore.available === false : false;

  const verifyBlockers: BlockingReason[] = [];
  const verifyExceptions: ExceptionRecord[] = [];

  const eligibility = resolvePassportEligibility({
    registration: registration
      ? {
          registered: registration.registered,
          settled: registration.settled,
          tokenId: registration.tokenId,
          auditGaps: registration.auditGaps,
        }
      : horizen?.tokenId
        ? {
            // The DB-side read failed THIS REQUEST; the served Agent Card —
            // the same canonical reader over HTTP — still answers. A failed
            // read is never a finding of non-registration.
            registered: true,
            settled: false,
            tokenId: String(horizen.tokenId),
            auditGaps: ['registration state read failed on this request; token id consumed from the served Agent Card'],
          }
        : null,
    principal: {
      /*
       * CANONICAL FIRST, receipt as CORROBORATION ONLY.
       *
       * This previously read `hasReceipt('operator_passport_validated')` for
       * both flags — so an operator holding a valid Passport issued through
       * the Passport Bureau, outside this journey, resolved as having none and
       * would have been shown a Passport APPLICATION. The receipt may confirm;
       * its ABSENCE must never mean "no Passport".
       */
      personhoodEstablished: operatorPassport.personhood || hasReceipt('operator_passport_validated'),
      citizenPassportValid: operatorPassport.valid || hasReceipt('operator_passport_validated'),
      // An unreadable Passport yields a RE-CHECK, never a new application —
      // unless a journey-local receipt already corroborates it.
      passportReadable: operatorPassport.known || hasReceipt('operator_passport_validated'),
    },
    claim: {
      controlProven: hasReceipt('agent_control_proven'),
      controlProofFresh: hasReceipt('agent_control_proven'),
      quarantined: hasReceipt('marketa_eligibility_quarantined'),
    },
    // Sponsorship is the sovereign human act the Passport stage exists for.
    requiredAuthorizations: [
      { id: 'sponsorship', label: 'sponsorship of this agent', granted: hasReceipt('agent_sponsorship_recorded') },
    ],
    ancillary: {
      pulseAuthorized: hasReceipt('horizen_pulse_authorized'),
      pnlDisclosureAuthorized: hasReceipt('horizen_pnl_transparency_enabled'),
      // DISTINCT from pnlDisclosureAuthorized — see the `verify.ancillary`
      // comment above for why these must never be represented as equivalent.
      pnlServiceVerified: hasReceipt('pnl_service_verified'),
      pnlServiceVerificationDetail:
        !hasReceipt('pnl_service_verified') && pnlVerification && !pnlVerification.verified
          ? `${pnlVerification.reason}: ${pnlVerification.detail}`
          : undefined,
      authorizationStoreAvailable: authorizationStore ? authorizationStore.available : undefined,
      authorizationStoreRemedy: authorizationStore && !authorizationStore.available ? authorizationStore.remedy : undefined,
      partnerMetadataComplete: registration ? registration.auditGaps.length === 0 : undefined,
    },
  });

  if (storeUnavailable && authorizationStore && !authorizationStore.available) {
    /*
     * VERIFY-ONLY. The same condition is a BLOCKER here (this is the act it
     * genuinely prevents) and a NON-BLOCKING EXCEPTION everywhere downstream
     * (it prevents no other act). One condition, two correct classifications
     * — which is only expressible because blockers and exceptions are
     * separate fields rather than one `blocking: boolean`.
     */
    verifyBlockers.push({
      code: 'authorization-store-unavailable',
      stageId: 'verify',
      summary: 'Local authorization store unavailable — the transparency authorization cannot be prepared in this deployment.',
      acts: [
        journeyAct('verify', 'apply-authorization-migration', 'apply-migration', 'Apply migration', authorizationStore.remedy),
        journeyAct('verify', 'reload-schema-cache', 'reload-schema-cache', 'Refresh schema', "NOTIFY pgrst, 'reload schema';"),
        journeyAct('verify', 'recheck-authorization-store', 're-check', 'Re-check'),
      ],
    });
    verifyExceptions.push(
      ...eligibility.nonBlockingExceptions.filter((e) => e.code === 'authorization-store-unavailable'),
    );
  }

  /*
   * NO MARKETA BLOCKER ON CLAIM (operator, 2026-08-03: "Do not add another
   * fallback, exception panel, or infrastructure check").
   *
   * A `claimBlockers` entry was added here earlier the same day, surfacing
   * the missing `marketa_agent_admission_assessments` table as a named Claim
   * blocker. It was a well-formed answer to the wrong question: Claim has no
   * Marketa dependency to report on, so the correct repair was to remove the
   * requirement, not to diagnose its infrastructure more legibly. Left in, it
   * would have kept an unconstitutional prerequisite alive behind a better
   * error message.
   */
  /*
   * ══ THE THREE AXES ═══════════════════════════════════════════════════════
   *
   * Resolved BEFORE the journey stages, and from their own inputs, so that
   * "may this agent act?" is answered without ever consulting "has Pulse been
   * authorized?". Verify now sits on the capability branch after activation;
   * the axes are what keep it there even if a future stage list drifts.
   */
  const pulseState: VerificationStepState = hasReceipt('horizen_pulse_authorized')
    ? 'complete'
    : storeUnavailable
      ? 'exception'
      : 'not-started';
  const pnlState: VerificationStepState = hasReceipt('horizen_pnl_transparency_enabled')
    ? 'complete'
    : storeUnavailable
      ? 'exception'
      : 'not-started';

  const canonicalStages: Record<string, boolean | undefined> = {
    /*
     * The Agent Card in THIS SAME RESPONSE carries the tokenId, produced by
     * the same canonical binding reader server-side. If the DB-side
     * resolution failed this request, the fact has not ceased to be true —
     * the screen that shows "registered — token 8798" and a stepper that says
     * "Continue to Register" must be impossible to render together.
     */
    register: registration?.registered === true || Boolean(horizen?.tokenId),
    claim: hasReceipt('agent_control_proven'),
    passport: passportIssuedForAgent,
    /*
     * Activate's canonical outcome is ITS OWN settled fact / receipt —
     * never re-derived from Delegate or Operate (Constitutional State Model
     * Correction, 2026-08-11). `admission?.registryActivated` is the
     * resolver's own answer; the receipt is corroboration only.
     */
    activate: admission?.registryActivated === true || hasReceipt('agent_registry_activated'),
    delegate: admission?.delegationActive === true || hasReceipt('agent_delegated'),
    /*
     * Deploy's canonical outcome is its OWN `capability_registered` receipt —
     * never mere AigentQube/registry-row existence (operator correction,
     * 2026-08-09; see the `stages.deploy.factoryIngested` comment above for
     * the full causal chain this closes). Any agent whose Deploy was
     * genuinely, historically established under the OLD registry-presence
     * reading stays complete regardless — that is what the
     * `priorResolution?.canonicalStages` union immediately below this object
     * literal is for; this line only decides what a FRESH read may newly
     * conclude. Standing deliberately has NO entry here: it is earned, and
     * the only thing that can establish it is an accrual.
     */
    deploy: hasReceipt('capability_registered'),
    /*
     * aigentMe is complete on the RECOGNITION ACT — activation plus the
     * principal's recorded disposition (operator, 2026-08-03). It no longer
     * waits on `journey_completed`, which could not exist until aigentMe
     * itself completed.
     */
    aigentme: hasReceipt('aigentme_activated') && hasReceipt('experienceqube_focus_disposition_recorded'),
  };
  /*
   * A governed-correction tombstone (POSIT state model, operator ruling
   * 2026-08-10) permanently retires the ratchet shortcut for a stage id —
   * this axis-input union is the SECOND place (besides
   * resolveMonotonicJourneyState's own priorCanonicalStages consumption
   * below) that reads `priorResolution.canonicalStages` directly, so it must
   * honour the same tombstone or a corrected stage could resurrect through
   * this path even after resolveMonotonicJourneyState correctly excludes it.
   */
  const tombstonedStageIds = new Set(Object.keys(priorResolution?.invalidatedStages ?? {}));
  for (const stageId of priorResolution?.canonicalStages ?? []) {
    if (tombstonedStageIds.has(stageId)) continue;
    if (canonicalStages[stageId] !== true) canonicalStages[stageId] = canonicalStages[stageId] || true;
  }

  const axes = resolveAgentStateAxes({
    canonicalStages,
    /*
     * INGESTION IS READ FROM ITS OWN RECEIPT, never from the accrual receipt.
     * Reading `standing_accrued` here would have made "ingested" and "has
     * earned Standing" the same observation — the precise collapse the ruling
     * forbids, arriving through the back door of a shared receipt type.
     */
    /*
     * `admission?.factoryPresent` (mere AigentQube/registry-row existence)
     * deliberately removed here too (operator correction, 2026-08-09) — see
     * the `stages.deploy.factoryIngested` comment above. A prior GENUINE
     * establishment survives via the monotonic floor
     * (`priorResolution?.canonicalStages`), never via re-reading the same
     * conflated registry signal on every future request.
     */
    factoryIngested:
      hasReceipt('capability_registered') ||
      ((priorResolution?.canonicalStages ?? []).includes('deploy') && !tombstonedStageIds.has('deploy')),
    pulse: pulseState,
    pnl: pnlState,
    /*
     * STANDING IS EARNED, NEVER GRANTED BY INGESTION. Only receipts for
     * qualifying, validated action count — the ingestion act itself is
     * deliberately absent from this list.
     *
     * NOT `receiptRefs['standing_accrued']` (operator correction,
     * 2026-08-09) — that included the nominal admission seed's OWN receipt,
     * which then double-counted: once here as "contribution", and again via
     * `initialStandingAwarded` below from the SAME settled fact. This axis's
     * own contract (services/journey/agentStateAxes.ts: "NOT the ingestion
     * receipt") was always correct; the caller violated it. `standingEvidence`
     * classifies by the receipt's own structured `action_input.tier` — never
     * amount, timing or summary text — and excludes superseded/sequencing-
     * invalid receipts the same way `standingGatewayEnabled` above does.
     */
    standingReceipts: standingEvidence ? standingEvidence.effectiveContributionReceipts.map((r) => r.id) : [],
    /*
     * The nominal admission seed, reported separately from earned Standing
     * (operator correction, 2026-08-03: "Admission Standing must be
     * distinguishable from earned performance Standing"). It is awarded once,
     * gated on the `registry_standing_seeded` settled fact — so it is READ
     * here, never re-derived, and a refresh cannot re-award it.
     *
     * Additionally requires an EFFECTIVE seed receipt to exist (operator
     * correction, 2026-08-09) — belt-and-suspenders alongside the settled-
     * fact gate: a correction that invalidates `registry_standing_seeded`
     * already flips `registrationStandingSeeded` to false on the next read,
     * but this keeps the two facts from ever disagreeing even transiently.
     */
    initialStandingAwarded:
      registrationStandingSeeded && standingEvidence && standingEvidence.effectiveInitialReceipts.length > 0
        ? REGISTRATION_SEED_STANDING
        : 0,
  });
  const branchOffers = resolveBranchOffers(axes);

  const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
    canonicalOutcomes: { register: registration?.registered === true },
    priorCanonicalStages: priorResolution?.canonicalStages ?? [],
    priorMilestones: priorResolution?.milestones ?? [],
    // The SAME tombstone set filtered above — a stage a governed correction
    // invalidated gets no `prior-resolution` synthesis here either, but may
    // still complete via genuine live evidence (canonicalAuthority: 'evidence').
    invalidatedStages: Array.from(tombstonedStageIds),
    auditGaps: {
      register: registration?.auditGaps ?? [],
      // Failed canonical reads are DISCLOSED, never rendered as "did not happen".
      passport: admission?.auditGaps ?? [],
      delegate: admission?.auditGaps ?? [],
      deploy: admission?.auditGaps ?? [],
    },
    operationalBlockers: { verify: verifyBlockers, passport: eligibility.blockingReasons },
    nonBlockingExceptions: {
      verify: verifyExceptions,
      passport: eligibility.nonBlockingExceptions.filter((e) => e.blocksCurrentAct === false),
    },
    // The isolation. A missing local migration stops Verify and nothing else.
    nonBlockingIncompleteStages: storeUnavailable ? ['verify'] : [],
  });

  /*
   * CONSEQUENCE FORK PROJECTION (Horizen Journey correction, 2026-08-09) —
   * derived EXCLUSIVELY from `resolution` (already-computed authoritative
   * stage state) and the receipt-status reads above. No new source of truth:
   * `classifyConsequenceProng` never re-decides completion, it only asks
   * whether an already-COMPLETE stage's external consequence has reached
   * DVN finality. Each prong resolves independently — Stand's incompleteness
   * cannot dim an already-proven Ratify.
   *
   * NO `deploy` KEY (Activate Consolidation, 2026-08-11) — the fork is
   * Ratify + Stand only. Ingest/`deploy` is no longer a visible
   * constitutional consequence; its technical evidence
   * (`capability_registered`) still exists and is readable, but it competes
   * with nothing here.
   */
  const stageStatus = (id: string) => resolution.stages.find((s) => s.stageId === id)?.status ?? 'NOT_STARTED';
  const consequenceFork = {
    verify: consequenceProngCopy(
      classifyConsequenceProng({ stageState: stageStatus('verify'), bestAnchorReceiptStatus: ratifyAnchorStatus ?? null }),
    ),
    standing: consequenceProngCopy(
      classifyConsequenceProng({
        stageState: stageStatus('standing'),
        // NOT `receiptStatuses['standing_accrued']` (operator correction,
        // 2026-08-09) — that includes superseded/sequencing-invalid
        // receipts, which could let a governed-corrected accrual's stale
        // DVN status still render Stand as Proven. `standingEvidence` is
        // the same effective set `standingGatewayEnabled` above consumes.
        bestAnchorReceiptStatus: bestReceiptStatus(standingEvidence ? effectiveStandingReceiptStatuses(standingEvidence) : []),
      }),
    ),
  };

  /*
   * P&L EVIDENCE (Final Horizen Projection Reconciliation part 2/3,
   * 2026-08-09) — the client-facing read for the three-tier P&L block
   * (disclosure/service/evidence). `serviceRegistered`/`serviceVerified` are
   * the SAME canonical `hasReceipt(...)` facts already recorded on
   * `stages.verify` above; this object exists only to additionally carry
   * DVN finality detail (`dvnStatus`) that a plain boolean cannot, using the
   * SAME `bestReceiptStatus` helper the consequence fork uses — never a
   * second completion source. `PulseTransparencyToggle`'s own live
   * `checkStatus()` read (`structured?.verifiablePnlRegistered`) may
   * CORROBORATE `serviceRegistered` client-side (an OR, never a
   * replacement) — this receipt-backed fact must never be the one a later
   * unavailable partner reread can regress.
   */
  const pnlEvidence = {
    serviceRegistered: hasReceipt('pnl_service_registered'),
    serviceRegisteredDvnStatus: bestReceiptStatus(receiptStatuses['pnl_service_registered'] ?? []),
    serviceVerified: hasReceipt('pnl_service_verified'),
    serviceVerifiedDvnStatus: bestReceiptStatus(receiptStatuses['pnl_service_verified'] ?? []),
  };

  /*
   * RATIFY SUB-PREDICATE PROJECTION (CFS-055 coherence pass, 2026-08-10 —
   * inv.engineering.255 "One Predicate, One Projection"). Ratify's five
   * sub-facts (`agreementAuthorized`, `pulseAuthorized`,
   * `pnlDisclosureAuthorized`, `pnlServiceRegistered`, `pnlEvidenceVerified`)
   * previously existed only as bare booleans buried inside `stages.verify`'s
   * completion-evidence object, each with no individually inspectable
   * authority/effectiveAt/evidenceRefs/finality of its own — the exact gap
   * the coherence matrix (codexes/packs/agentiq/updates/
   * 2026-08-10_horizen-coherence-matrix-nakamoto.md, finding 3) named as why
   * AgreementRatifyPanel/PulseTransparencyToggle each independently re-derive
   * these facts instead of consuming a canonical projection: there was
   * nothing canonical at this granularity TO consume.
   *
   * Every field below is sourced from the SAME `hasReceipt(...)`/agreement-row
   * reads `stages.verify` already uses — never inferred from another
   * sub-predicate (CFS-055 §11 inv.epistemology.257 "Evidence Does Not
   * Collapse Predicates"). `receiptBackedSubPredicate` is the one function
   * every receipt-only sub-predicate below shares — never four independent
   * copies of the same shape.
   */
  const receiptBackedSubPredicate = (predicate: string, actionType: ActivityActionType) => {
    const established = hasReceipt(actionType);
    const createdAts = receiptCreatedAt[actionType] ?? [];
    return {
      predicate,
      established,
      authority: established ? ('evidence' as const) : ('none' as const),
      effectiveAt: createdAts.length > 0 ? createdAts.slice().sort()[0] : null,
      evidenceRefs: established ? [actionType] : [],
      receiptRefs: receiptRefs[actionType] ?? [],
      dvnStatus: bestReceiptStatus(receiptStatuses[actionType] ?? []),
    };
  };
  const agreementAuthorizedEstablished = ratifyAgreementStatusAtLeast('authorized');
  const agreementAuthorizedReceiptId = ratifyAgreement?.authorizedReceiptId ?? null;
  const agreementAuthorizedReceiptDetail = agreementAuthorizedReceiptId
    ? ratifyAgreementReceiptDetails.get(agreementAuthorizedReceiptId) ?? null
    : null;
  const ratifySubPredicates = {
    // NOT receipt-backed like its siblings below — the agreement row IS the
    // canonical record (see the `ratify-agreement` guarded read's own
    // comment for why a receipt scan is the wrong tool for this one).
    agreementAuthorized: {
      predicate: 'agreementAuthorized',
      established: agreementAuthorizedEstablished,
      authority: ratifyAgreement ? ('external-authority' as const) : ('none' as const),
      effectiveAt: agreementAuthorizedReceiptDetail?.createdAt ?? null,
      evidenceRefs: agreementAuthorizedEstablished ? ['agreementAuthorized'] : [],
      receiptRefs: agreementAuthorizedReceiptId ? [agreementAuthorizedReceiptId] : [],
      dvnStatus: agreementAuthorizedReceiptDetail?.receiptStatus ?? null,
    },
    pulseAuthorized: receiptBackedSubPredicate('pulseAuthorized', 'horizen_pulse_authorized'),
    pnlDisclosureAuthorized: receiptBackedSubPredicate('pnlDisclosureAuthorized', 'horizen_pnl_transparency_enabled'),
    pnlServiceRegistered: receiptBackedSubPredicate('pnlServiceRegistered', 'pnl_service_registered'),
    pnlEvidenceVerified: receiptBackedSubPredicate('pnlEvidenceVerified', 'pnl_service_verified'),
  };

  /*
   * REGISTER CEREMONY REPLAY PROJECTION (Pre-recording Horizen polish, part
   * C, 2026-08-10) — the seven named ceremony steps
   * (services/horizen/registerCeremony.ts's own wallet-signing-topology
   * sequence), each independently sourced, for a generic read-only replay of
   * an ALREADY-COMPLETE Register stage. Never a live-registration source of
   * truth — RegisterAgentPanel's own ceremony/mandate/broadcast flow remains
   * the ONLY writer; this is a pure reprojection of receipts that already
   * exist, using the SAME `receiptBackedSubPredicate` helper Ratify's
   * sub-predicates use above.
   *
   * Two of the seven steps — `principalWalletReady`, `mandatePrepared` —
   * have NO receipt type at all (services/horizen/registerCeremony.ts never
   * writes one for either; confirmed by direct audit, never assumed). Per
   * operator instruction ("do not fabricate evidence for these... show only
   * the level of proof actually available"), they carry `authority:
   * 'inferred'` — true only because a LATER, receipted step in the same
   * chain could not exist otherwise — never `authority: 'evidence'`, which
   * is reserved for steps with an actual receipt.
   */
  const registerStageEstablished = resolution.stages.find((s) => s.stageId === 'register')?.canonicalOutcome === true;
  const inferredCeremonyStep = (predicate: string) => ({
    predicate,
    established: registerStageEstablished,
    authority: registerStageEstablished ? ('inferred' as const) : ('none' as const),
    effectiveAt: null as string | null,
    evidenceRefs: [] as string[],
    receiptRefs: [] as string[],
    dvnStatus: null as ReceiptStatus | null,
  });
  const registerCeremony = {
    principalWalletReady: inferredCeremonyStep('principalWalletReady'),
    mandatePrepared: inferredCeremonyStep('mandatePrepared'),
    mandateSigned: receiptBackedSubPredicate('mandateSigned', 'principal_registration_mandate_signed'),
    invocationApproved: receiptBackedSubPredicate('invocationApproved', 'agent_registry_transaction_signed'),
    transactionBroadcast: receiptBackedSubPredicate('transactionBroadcast', 'horizen_registration_submitted'),
    horizenConfirmed: receiptBackedSubPredicate('horizenConfirmed', 'horizen_registration_confirmed'),
    registryBindingRecorded: receiptBackedSubPredicate('registryBindingRecorded', 'agent_registry_binding_recorded'),
  };

  // Persist so refresh, persona change and route change all resolve the same
  // result. The write is itself monotonic — see recordJourneyResolution.
  try {
    const supabase = getSupabaseServer();
    if (supabase) {
      await recordJourneyResolution(supabase, agent.aigentQubeId, {
        journeyId: resolution.journeyId,
        journeyVersion: resolution.journeyVersion,
        /*
         * NOT `resolution.subjectRef` — that comes straight off the static
         * HORIZEN_MONEYPENNY_JOURNEY definition (subjectRef: 'moneypenny'
         * at every stage), which predates this journey becoming
         * agent-selectable (2026-07-31). Nakamoto's own persisted
         * resolution was carrying the literal string "moneypenny" — cosmetic
         * only (this record is read back keyed by asset_id, never by
         * subjectRef), but misleading enough to look like cross-agent data
         * contamination. Use the actual agent this request resolved for.
         */
        subjectRef: agent.slug,
        canonicalStages: resolution.stages.filter((s) => s.canonicalOutcome).map((s) => s.stageId),
        milestones: resolution.milestones,
        highestMilestone: resolution.highestMilestone,
      });
    }
  } catch {
    // A failed record is an audit gap, never a reason to report less progress.
  }

  return NextResponse.json({
    ok: true,
    // Unchanged shape for every existing consumer — now carrying canonical
    // outcomes and gating relief, so the stepper and this route cannot
    // disagree (One-State Principle §5.3).
    state: {
      ...resolution.runtimeState,
      // Agent-generic subjectRef parameterization (2026-08-12): the journey
      // definition HORIZEN_MONEYPENNY_JOURNEY has subjectRef: 'moneypenny'
      // hardcoded at every stage, predating agent selectability (2026-07-31).
      // Substitute the resolved agent's slug so the response reflects the
      // actual agent being queried, not the static journey definition.
      subjectRef: agent.slug,
    },
    // THREE AXES, reported separately so no consumer can collapse them.
    axes,
    branchOffers,
    admissionMilestones: admissionMilestones(axes.admission),
    resolution: {
      stages: resolution.stages,
      milestones: resolution.milestones,
      highestMilestone: resolution.highestMilestone,
      nextExecutableAct: resolution.nextExecutableAct,
      complete: resolution.complete,
    },
    passportEligibility: eligibility,
    agentCardResolved: !!agentCard,
    // Orient's contextually-resolved ritual (services/journey/orientationContext.ts)
    // — null only when no active persona could be resolved on this request.
    orientationContext,
    // Consequence Fork projection (services/journey/consequenceForkProjection.ts)
    // — keyed by stage id, each { tier, label, detail }. Derived exclusively
    // from `resolution` + receipt status; never a second completion source.
    consequenceFork,
    // { serviceRegistered, serviceRegisteredDvnStatus, serviceVerified,
    //   serviceVerifiedDvnStatus } — see the definition above for why this
    // is additive to, never a replacement for, stages.verify's own fields.
    pnlEvidence,
    // Ratify's five sub-predicates, each independently projected — see the
    // definition above (CFS-055 coherence pass). This is what
    // AgreementRatifyPanel/PulseTransparencyToggle/StageReceiptsDrawer must
    // consume for these facts, never their own Agent Card fetch, `/verify/
    // status` poll, or unscoped receipt search.
    ratifySubPredicates,
    // Register's seven-step ceremony, replayed read-only from canonical
    // evidence (Pre-recording Horizen polish, part C, 2026-08-10) — see the
    // definition above. `principalWalletReady`/`mandatePrepared` carry
    // `authority: 'inferred'` (no receipt type exists for either); the
    // remaining five carry `authority: 'evidence'` from their own receipts.
    // Its former UI consumer (RegisterCeremonyReplay) was removed from the
    // journey UI (2026-08-11); this projection is kept as-is and is never a
    // second source of truth for whether Register is complete — that
    // remains `resolution.stages.register.canonicalOutcome` alone.
    registerCeremony,
  });
}
