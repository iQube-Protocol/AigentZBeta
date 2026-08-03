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
import { findAgentReceiptRefs, type ActivityActionType } from '@/services/receipts/activityReceiptService';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';
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
import type { ExceptionRecord } from '@/services/research/exceptionIsolation';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
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
import {
  resolveAgentStateAxes,
  resolveBranchOffers,
  admissionMilestones,
  type VerificationStepState,
} from '@/services/journey/agentStateAxes';

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
  'marketa_eligibility_recommended',
  'operator_passport_validated',
  'agent_sponsorship_recorded',
  'agent_delegate_passport_issued',
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
  let priorResolution: Awaited<ReturnType<typeof readJourneyResolution>> = null;
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
      const refs = await findAgentReceiptRefs(agent.runtimeAgentId, JOURNEY_ACTION_TYPES, { limit: 100 });
      for (const ref of refs) {
        (receiptRefs[ref.actionType] ??= []).push(ref.id);
      }
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
      admission = await resolveAgentAdmissionState(supabase, agent, caller?.authProfileId ?? null);
    });
    if (supabase) await guarded('authorization-store', async () => {
      authorizationStore = await checkAuthorizationStoreAvailable(supabase);
    });
    if (supabase) await guarded('prior-resolution', async () => {
      priorResolution = await readJourneyResolution(supabase, agent.aigentQubeId, HORIZEN_MONEYPENNY_JOURNEY.id);
    });
  }

  const hasReceipt = (type: ActivityActionType) => (receiptRefs[type]?.length ?? 0) > 0;

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
        pulseAuthorizationVerified: hasReceipt('horizen_pulse_authorized'),
        pnlTransparencyEnabled: hasReceipt('horizen_pnl_transparency_enabled'),
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
      delegate: {
        delegatePassportActive: passportIssuedForAgent,
        boundedDelegationActive: admission?.delegationActive === true || hasReceipt('agent_delegated'),
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
        // Presence in the registry IS the receipt (operator, 2026-08-03) —
        // corroborated by ingestion's own receipt where one was written.
        factoryIngested: admission?.factoryPresent === true || hasReceipt('capability_registered'),
      },
      standing: {
        // Standing is EARNED. It is the one stage with no canonical shortcut:
        // an accrual receipt is the accrual. Reading registry presence here
        // would recreate the exact ingestion-equals-accrual collapse the
        // operator's ruling forbids.
        standingGatewayEnabled: hasReceipt('standing_accrued'),
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
    delegate: admission?.delegationActive === true || hasReceipt('agent_delegated'),
    /*
     * Deploy's canonical outcome is REGISTRY PRESENCE, not the receipt the
     * original ingestion never wrote. Standing deliberately has NO entry here:
     * it is earned, and the only thing that can establish it is an accrual.
     */
    deploy: admission?.factoryPresent === true || hasReceipt('capability_registered'),
    /*
     * aigentMe is complete on the RECOGNITION ACT — activation plus the
     * principal's recorded disposition (operator, 2026-08-03). It no longer
     * waits on `journey_completed`, which could not exist until aigentMe
     * itself completed.
     */
    aigentme: hasReceipt('aigentme_activated') && hasReceipt('experienceqube_focus_disposition_recorded'),
  };
  for (const stageId of priorResolution?.canonicalStages ?? []) {
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
    factoryIngested:
      admission?.factoryPresent === true ||
      hasReceipt('capability_registered') ||
      (priorResolution?.canonicalStages ?? []).includes('deploy'),
    pulse: pulseState,
    pnl: pnlState,
    /*
     * STANDING IS EARNED, NEVER GRANTED BY INGESTION. Only receipts for
     * qualifying, validated action count — the ingestion act itself is
     * deliberately absent from this list.
     */
    standingReceipts: receiptRefs['standing_accrued'] ?? [],
    /*
     * The nominal admission seed, reported separately from earned Standing
     * (operator correction, 2026-08-03: "Admission Standing must be
     * distinguishable from earned performance Standing"). It is awarded once,
     * gated on the `registry_standing_seeded` settled fact — so it is READ
     * here, never re-derived, and a refresh cannot re-award it.
     */
    initialStandingAwarded: registrationStandingSeeded ? REGISTRATION_SEED_STANDING : 0,
  });
  const branchOffers = resolveBranchOffers(axes);

  const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, platformState, {
    canonicalOutcomes: { register: registration?.registered === true },
    priorCanonicalStages: priorResolution?.canonicalStages ?? [],
    priorMilestones: priorResolution?.milestones ?? [],
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
    state: resolution.runtimeState,
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
  });
}
