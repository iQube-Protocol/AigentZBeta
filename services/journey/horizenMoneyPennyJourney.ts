/**
 * The Horizen x MoneyPenny Constitutional Admission Journey — the Guided
 * Journey Runtime's one configured journey (PRD-GJR-001 §3, §7).
 *
 * This is the canonical initial use case, not a demo fixture: MoneyPenny's
 * progression from a registered-but-not-yet-authorised external agent to a
 * constitutionally delegated Financial Services agent, ending at aigentMe's
 * activation as the operator's constitutional companion (§5.10, §17) — with
 * Founder Office offered only as an optional next destination.
 *
 * Stage order and completion conditions mirror §7's table exactly. Do not
 * edit this file without re-reading that table — it is the authority.
 */

import type { JourneyDefinition } from '@/types/journey';

export const HORIZEN_MONEYPENNY_JOURNEY: JourneyDefinition = {
  id: 'horizen-moneypenny-admission',
  version: '1.0.0',
  label: 'Constitutional Admission Journey',
  partner: 'horizen',
  destination: 'aigentme',
  subjectRef: 'moneypenny',
  stages: [
    {
      id: 'register',
      label: 'Register',
      milestone: 'REGISTERED',
      description: 'The agent enters Horizen as a discoverable, technically controllable external presence.',
      actor: 'moneypenny',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'external-url',
          ref: 'horizen-registry-agent-page',
          note: "Horizen's own live agent/registry page for MoneyPenny's tokenId — URL not yet resolvable (§22).",
        },
        {
          mode: 'component',
          ref: 'register-agent-panel',
          entityRef: 'moneypenny',
          note: "Agent-selectable registration panel — metaMe's complementary reflection of the same registration, plus the real Register action itself.",
        },
      ],
      prerequisites: [],
      permittedActions: ['view-registration'],
      // Wallet Signing Topology (operator ruling 2026-08-01): Register can
      // only reach COMPLETE once the full wallet-mediated ceremony has run —
      // principal mandate signed, agent wallet approved invocation, tx
      // broadcast, Horizen reread confirmed, binding recorded. The original
      // five fields remain (aigentQubeResolved/agentCardResolves are still
      // real prerequisites; tokenId/registryRereadOk/ownerWalletMatches are
      // superseded in spirit by the five new fields but kept for backward
      // evidence continuity) — this is an ADDITION, never a relaxation.
      completionEvidence: [
        'aigentQubeResolved',
        'tokenId',
        'registryRereadOk',
        'ownerWalletMatches',
        'agentCardResolves',
        'principalRegistrationMandateSigned',
        'agentRegistryTransactionSigned',
        'horizenRegistrationSubmitted',
        'horizenRegistrationConfirmed',
        'agentRegistryBindingRecorded',
      ],
      receiptTypes: [
        'agent_card_discovered',
        'horizen_agent_registered',
        'principal_registration_mandate_signed',
        'agent_registry_transaction_signed',
        'horizen_registration_submitted',
        'horizen_registration_confirmed',
        'agent_registry_binding_recorded',
      ],
      // Every type above is written with agentsInvoked: [agent.runtimeAgentId]
      // (services/horizen/registerCeremony.ts) — verified subject-tagged
      // (operator directive, 2026-08-08).
      receiptsScopedToSubjectAgent: true,
      companion: {
        before:
          'MoneyPenny has a persisted AigentQube and a published Agent Card. Horizen registration is still pending. Registry presence will establish external identity and discoverability, but not constitutional authority.',
        complete:
          'MoneyPenny is now discoverable in Horizen. Registry presence proves identity and discoverability, but not constitutional authority.',
      },
      nextStageId: 'claim',
    },
        {
      id: 'claim',
      label: 'Claim',
      milestone: 'CLAIMED',
      description: 'The controller wallet proves it holds the key, without revealing it.',
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'marketa-eligibility-view',
          note: 'Genuinely new component (§22) — wraps services/passport/externalAgentAdmission.ts, never the domain-mismatched marketing-lane tab.',
        },
      ],
      prerequisites: ['register'],
      permittedActions: ['prove-wallet-control'],
      /*
       * ── CLAIM = REGISTRATION ESTABLISHED + WALLET CONTROL PROVEN ─────────
       *
       * Nothing else (operator ruling, 2026-08-03):
       *
       *   > "Claim is incorrectly still gated on Marketa. Remove that
       *   >  requirement immediately... Financial-services enrichment,
       *   >  including Marketa, Pulse and P&L, is non-blocking and occurs
       *   >  after aigentMe."
       *
       * `marketaFinalRecommendation` was the second required signal here,
       * so Claim rendered "1 of 2 recorded" against a real, observed control
       * proof and Passport never unlocked. That is the SAME defect already
       * corrected once on this stage — the prove-control route's
       * `VERIFY_NOT_COMPLETE` gate — surviving in the stage CONTRACT after
       * being removed from the route. Removing an unconstitutional
       * prerequisite from the executor but leaving it in the definition
       * leaves the requirement fully in force, because the definition is
       * what the observer reads.
       *
       * Marketa now belongs to the `verify` branch (financial-services
       * enrichments, after aigentMe) where its receipt types live.
       */
      completionEvidence: ['controlProofFresh'],
      receiptTypes: ['agent_control_proven'],
      // agent_control_proven is written with agentsInvoked: [agent.runtimeAgentId]
      // — verified subject-tagged (operator directive, 2026-08-08).
      receiptsScopedToSubjectAgent: true,
      companion: {
        before: 'A wallet-control challenge must be signed to prove the agent’s controller wallet.',
        complete: 'Control has been proven without revealing the private key. Control does not yet equal authority.',
      },
      nextStageId: 'passport',
    },
    {
      id: 'passport',
      label: 'Passport',
      milestone: 'PASSPORT_ISSUED',
      description: "The operator's own Polity Citizen Passport resolves, then sponsorship, then the agent's Polity Delegate Passport issues.",
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'venture-participate-apply',
          note: "Rendered bare — Venture Lab α's Participate → Apply module (the Citizen application). Not the Polity Passport Bureau cartridge.",
        },
      ],
      prerequisites: ['claim'],
      permittedActions: ['record-sponsorship'],
      completionEvidence: ['operatorPolityCitizenPassportValid', 'sponsorBinding', 'delegatePassportIssued'],
      /*
       * `passport_issued` is the receipt the Bureau's canonical issuance path
       * actually writes (services/passport/issuanceService.ts), through the
       * normal DVN-anchored pipeline. `agent_delegate_passport_issued` is
       * written by nothing — it is retained only so any historical row bearing
       * it still surfaces here, never as the thing the stage waits on.
       */
      receiptTypes: [
        'operator_passport_validated',
        'agent_sponsorship_recorded',
        'passport_issued',
        'agent_delegate_passport_issued',
      ],
      companion: {
        before: "Your Polity Citizen Passport must resolve before you can sponsor MoneyPenny.",
        complete: 'The wallet proved control. The Passport now establishes the human source from whom authority may originate.',
      },
      nextStageId: 'delegate',
    },
    {
      id: 'delegate',
      label: 'Delegate',
      milestone: 'DELEGATED',
      receiptsSurfacedNatively: true,
      description: 'Bounded delegation and FS Runtime bootstrap activate the agent’s authority.',
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'venture-participate-delegation',
          note: "Rendered bare — Venture Lab α's Participate → Delegation module (bounded delegation).",
        },
      ],
      prerequisites: ['passport'],
      permittedActions: ['approve-bounded-delegation', 'ratify-bootstrap'],
      /*
       * DELEGATE COMPLETES ON DELEGATION, NOT ON FS RUNTIME ACTIVATION
       * (operator correction via al, 2026-08-04).
       *
       * `bootstrapApproval`, `aigentZObserverReceipt` and `fsRuntimeActive` are
       * FS Runtime activation conditions (all three read the same
       * `finance_authoritative_execution` receipt) — a capability enrichment
       * that belongs on the Financial-services branch (the `verify` stage),
       * not a delegation condition. Requiring them here meant a real,
       * DVN-anchored delegation grant plus a correctly-assigned delegate could
       * never turn this stage emerald, because two unrelated FS-activation
       * signals were bundled onto the delegation act itself.
       *
       * Delegate's own outcome is exactly three things: a usable Delegate
       * Passport, an active delegation grant, and the agent structurally
       * assigned as this persona's delegate (never inferring aigentMe from
       * that assignment — see personaAssignedAsDelegate in agentStateAxes/state).
       */
      completionEvidence: ['delegatePassportActive', 'boundedDelegationActive', 'personaAssignedAsDelegate'],
      receiptTypes: ['agent_delegated', 'finance_authoritative_execution'],
      companion: {
        before: 'A bounded delegation and its structural assignment to this persona are required before aigentMe.',
        complete: 'Control says can. The Passport and delegation say may. Nakamoto is now a recognised bounded delegate.',
      },
      nextStageId: 'aigentme',
    },
    {
      id: 'aigentme',
      label: 'aigentMe',
      description:
        'aigentMe activates as the operator’s constitutional companion. The operator decides whether the agent’s domain focus shapes their ExperienceQube population.',
      actor: 'aigentme',
      subjectRef: 'operator',
      surfaces: [
        {
          mode: 'iframe',
          ref: 'aigentme-welcome',
          note:
            "aigentMe's existing copilot/dashboard shell, composed as the base surface. The focus-" +
            'disposition ceremony (formerly a bolted-on second surface here) now lives inside this ' +
            'shell as a Welcome Capsule — never a second surface at the journey level (§24.8).',
        },
      ],
      prerequisites: ['delegate'],
      permittedActions: ['record-focus-disposition'],
      /*
       * ── aigentMe COMPLETES ON THE PRINCIPAL'S RECOGNITION ACT ────────────
       *
       * Operator, 2026-08-03: "flip aigentMe to emerald after the user selects
       * the role they wish their agent to play in their experienceGuide."
       *
       * Two of the four former signals were wrong here:
       *
       *   moneypennyRecordedAsDelegatedAgent — reads `agent_delegated`. That is
       *     DELEGATE's outcome, and requiring it again makes aigentMe a second
       *     observer of a stage that already owns it. Delegate is aigentMe's
       *     prerequisite; the stepper enforces that ordering already.
       *
       *   evidenceChainComplete — read `journey_completed`, which cannot exist
       *     until the journey completes, which cannot happen until aigentMe
       *     completes. A stage that gates on its own downstream completion is
       *     unreachable by construction, and no act by the operator could ever
       *     have satisfied it.
       *
       * What remains is the act itself: aigentMe active, and the principal's
       * recorded disposition on how it should regard the agent.
       */
      completionEvidence: ['aigentMeActive', 'focusDispositionRecorded'],
      receiptTypes: ['aigentme_activated', 'experienceqube_focus_disposition_recorded', 'journey_completed'],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'MoneyPenny is ready to introduce you to aigentMe, your constitutional companion.',
        complete:
          'You have crossed the threshold. Your Polity Citizen Passport establishes your continuing constitutional personhood. aigentMe is now active as your constitutional companion. MoneyPenny has joined your agent set through a Polity Delegate Passport and may act only within the authority and mandates you have granted.',
      },
    },
    {
      id: 'verify',
      label: 'Ratify',
      milestone: 'VERIFIED',
      /*
       * A POST-ACTIVATION BRANCH, NOT AN ADMISSION STAGE (operator, 2026-08-03).
       * Both branches hang off aigentMe, per the operator's diagram:
       *
       *   Register -> Claim -> Passport -> Delegate -> aigentMe
       *                                                  |- Ingest -> Standing eligible
       *                                                  `- Ratify -> Financial-services eligible
       *
       * It has no `nextStageId`: nothing waits on it, and it is not a step on
       * a line. Its sibling branch does not wait on it either.
       *
       * RECONSTITUTED 2026-08-06 around the Constitutional Agreement lifecycle
       * (operator instruction): the id stays `verify` (it is read by
       * `prerequisites` arrays, `platformState.stages.verify`, and every
       * existing route — renaming it would be a much larger, unrequested
       * change; only the LABEL changes, matching the `deploy`/"Ingest into
       * Factory" precedent below). What "Verify" verifies is no longer Pulse/
       * P&L alone — it is the form -> accept -> authorize ceremony
       * (services/constitutional/constitutionalAgreement.ts,
       * services/journey/ratificationRefs.ts) that ratifies MoneyPenny's
       * eligibility for the financial-services runtime. Pulse, P&L and Agent
       * Card enrichment remain real, but as a SECONDARY Transparency section:
       * assurance around the provision of an already-authorized service, never
       * a precondition of authorizing it (see completionEvidence below).
       */
      branch: 'capability',
      description:
        'Ratify the constitutional service agreement — form, accept and authorize the terms that let MoneyPenny operate the Financial Services runtime. Horizen Pulse and P&L transparency enrich, never enlarge, that authority.',
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'constitutional-agreement-ratify',
          note:
            'PRIMARY — the one guided action ("Verify & Sign Agreement") over the EXISTING generic ' +
            '/api/constitutional/agreement route (services/constitutional/constitutionalAgreement.ts) — ' +
            'form, accept and authorize the Financial Services capability agreement, pre-populated from ' +
            'the Journey context (services/journey/ratificationRefs.ts). No parallel agreement store, no ' +
            'new signing subsystem.',
        },
        {
          mode: 'component',
          ref: 'pulse-transparency-toggle',
          note:
            'SECONDARY — Transparency section. Real Pulse/P&L authorization, but an assurance enrichment ' +
            'around an already-authorized service — it neither creates nor enlarges MoneyPenny\'s authority, ' +
            'and its own owner-source-conflict state (HORIZEN_OWNER_SOURCE_CONFLICT) is never suppressed.',
        },
        {
          mode: 'component',
          ref: 'horizen-agent-page-verify',
          note:
            "SECONDARY — Transparency section. Reopens Horizen's agent page with transparency framing " +
            '(operator ruling 2026-07-31) — the direct partner-side depiction of Pulse/P&L state.',
        },
      ],
      prerequisites: ['aigentme'],
      permittedActions: ['form-agreement', 'accept-agreement', 'authorize-agreement', 'authorize-pnl-disclosure'],
      /*
       * THE PRIMARY COMPLETION CONTRACT — the Constitutional Agreement
       * lifecycle, and NOTHING from Pulse/P&L/Agent Card enrichment (operator
       * instruction, 2026-08-06: "Stage completion must derive from the
       * canonical constitutional_agreements record and its receipts, not from
       * Horizen Pulse or P&L status... unresolved or unavailable Pulse/P&L
       * must not block progression once the service agreement is
       * authorized"). Computed by app/api/journey/moneypenny-horizen/
       * state/route.ts from the agreement row + requireAuthorizedAgreement —
       * never re-derived here.
       */
      completionEvidence: [
        'agreementTermsCommitted',
        'agreementAcceptanceRecorded',
        'agreementAuthorized',
        'agreementReceiptsAnchored',
        'agreementGateRecognized',
      ],
      // Pulse/P&L/Agent Card/Marketa receipt types are listed as SURFACED
      // evidence only — deliberately NOT in `completionEvidence` above, so
      // none of them gates Ratify (mirrors the Marketa precedent already
      // established here, operator 2026-08-03: "eligibility assessment is a
      // financial-services enrichment... listed as surfaced evidence only").
      receiptTypes: [
        'agreement_formed',
        'agreement_authorized',
        'horizen_pulse_authorized',
        'horizen_pnl_transparency_enabled',
        'agent_card_enriched',
        'marketa_eligibility_assessed',
        'marketa_eligibility_recommended',
        'marketa_eligibility_refused',
        'marketa_eligibility_quarantined',
      ],
      companion: {
        before:
          'Sign the constitutional service agreement to ratify MoneyPenny\'s eligibility for the Financial Services runtime. Forming and accepting record a tamper-evident commitment; authorizing is an authenticated constitutional act you perform as the operator — neither is a wallet or blockchain signature.',
        complete:
          'The service agreement is authorized — MoneyPenny is ratified for the Financial Services runtime. Horizen Pulse and P&L transparency, below, remain real and worth completing, but they enrich her verifiable operational state; they do not create or enlarge this authority.',
      },
    },
{
      id: 'deploy',
      // Branch A. Establishes PARTICIPATION and Standing ELIGIBILITY —
      // ingestion is never itself an accrual of Standing.
      branch: 'factory',
      label: 'Ingest into Factory',
      description:
        'Ingestion registers the activated agent as a factory participant and makes it ELIGIBLE to accrue Standing. It never accrues Standing itself.',
      actor: 'moneypenny',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'venture-participate-standing',
          // `only` lives HERE, in the stage definition, not in the tab's
          // resolveSurfaceProps: surface props are applied LAST in
          // JourneyRunSurface's merge, so a stage's own declaration always
          // wins, and what a stage renders stays readable from the stage
          // itself. (It was briefly wired through resolveSurfaceProps and
          // silently never applied — the two-tab strip stayed on both
          // stages, operator report 2026-08-02.)
          /*
           * `registrySection: 'assets'` — the Factory opens on INGESTED ASSETS,
           * not on "Ingest New Asset" (operator, 2026-08-03). By the time this
           * stage is reachable the agent is already a published registry asset;
           * landing on the ingest form invited the operator to re-perform an act
           * the very same surface lists as done. Deep-link to the evidence.
           */
          props: { only: 'registry', registrySection: 'assets' },
          note:
            'Rendered bare — the registry Ingestion Factory ALONE (operator direction 2026-08-02). ' +
            'Standing was split out of this surface into its own eighth stage below, so Deploy no longer ' +
            'carries a Standing tab beside the Factory and the two are never conflated again.',
        },
      ],
      prerequisites: ['aigentme'],
      permittedActions: ['prepare-payment-mandate', 'execute-payment'],
      /*
       * A STAGE COMPLETES ON ITS OWN OUTCOME (operator ruling, 2026-08-03 —
       * the same correction applied to aigentMe earlier the same day).
       *
       * This read `delegatePassportActive`, `boundedDelegationActive` and
       * `standingGatewayEnabled`: two outcomes belonging to Delegate and one
       * belonging to Standing, the stage AFTER this one. So Ingestion could
       * not complete until Standing had accrued, while Standing lists Deploy
       * as its prerequisite — a cycle, and the reason neither ever went green.
       *
       * Ingestion's own outcome is that the agent is IN the factory:
       *
       *   > "The ingested factory is essentially the registry so presence
       *   >  there is a receipt in and of itself."
       */
      completionEvidence: ['factoryIngested'],
      /*
       * INGESTION IS NOT ACCRUAL (operator ruling, 2026-08-03):
       *
       *   > "Ingested into Factory ≠ Standing accrued
       *   >  Ingested into Factory → Eligible to accrue Standing through
       *   >  qualifying action"
       *
       * This stage receipted `standing_accrued` — so merely being admitted to
       * the factory wrote a Standing accrual. That collapses participation
       * into merit: Standing is EARNED by later qualifying, validated action,
       * and awarding it for admission would make the whole measure
       * meaningless. `capability_registered` records what actually happened
       * here — the agent became a registered, eligible participant.
       *
       * CORRECTED SAME DAY by the operator: removing the accrual entirely was
       * too absolute. Registration IS a consequential, receipted act — it has
       * cost, commitment and consequence — so it earns a NOMINAL one-time
       * award. Their voter-registration analogy is exact: registering is not
       * civic contribution equivalent to voting, but it is a constitutionally
       * meaningful act that may justify a modest initial grant.
       *
       * So BOTH receipts, recording two separate things:
       *   capability_registered — admitted, and now ELIGIBLE to accrue.
       *   standing_accrued      — a one-time NOMINAL registration award,
       *                           basis 'iqube_registry_registration',
       *                           tier 'initial', non-repeatable.
       *
       * The safeguard is not "no Standing on ingestion". It is that admission
       * Standing stays DISTINGUISHABLE from earned performance Standing —
       * enforced by the basis code and by the seed being too small to move a
       * Standing bucket. See services/journey/registrationStandingSeed.ts.
       */
      receiptTypes: ['capability_registered', 'standing_accrued'],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'Ingest the activated agent into the factory to make it eligible to accrue Standing through validated work.',
        complete:
          'Ingested as a factory participant, now eligible to accrue Standing, and credited a nominal one-time registration award. That award records a completed act, not demonstrated performance — substantive Standing is still earned through validated contribution.',
      },
      nextStageId: 'standing',
    },
    {
      id: 'standing',
      label: 'Standing',
      description:
        'Standing is earned, observed and held separately from deployment — its own stage, not a tab beside the Ingestion Factory.',
      actor: 'moneypenny',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'venture-participate-standing-only',
          props: { only: 'standing' },
          note:
            'The Standing module standalone (operator direction 2026-08-02). It was previously one tab ' +
            'inside the Activate/Deploy surface beside the Ingestion Factory; separating them restores ' +
            'Standing to the independent surface it was before, and stops deployment and standing ' +
            'reading as the same act.',
        },
      ],
      prerequisites: ['deploy'],
      permittedActions: ['view-standing'],
      completionEvidence: ['standingGatewayEnabled'],
      receiptTypes: ['standing_accrued'],
      companion: {
        before: 'Standing accrues from observed, receipted conduct — it is never granted by deploying.',
        complete: 'Standing is active and independently observable.',
      },
    },
  ],
};