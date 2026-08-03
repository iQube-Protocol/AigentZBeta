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
      description: 'Proof of wallet control precedes Marketa’s final eligibility recommendation — never the reverse.',
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
      completionEvidence: ['controlProofFresh', 'marketaFinalRecommendation'],
      // GJR-MKT-001 Phase 5 (2026-07-31): marketa_eligibility_assessed fires
      // on EVERY assessment (including non-RECOMMENDED outcomes); the other
      // two fire only for their matching decision. All three ride alongside
      // the two originally-listed types so the evidence chain is complete
      // regardless of which way the assessment resolved.
      receiptTypes: [
        'agent_control_proven',
        'marketa_eligibility_recommended',
        'marketa_eligibility_assessed',
        'marketa_eligibility_refused',
        'marketa_eligibility_quarantined',
      ],
      companion: {
        before: 'A wallet-control challenge must be signed before Marketa can issue her final recommendation.',
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
      receiptTypes: ['operator_passport_validated', 'agent_sponsorship_recorded', 'agent_delegate_passport_issued'],
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
      completionEvidence: ['delegatePassportActive', 'boundedDelegationActive', 'contextualMandate', 'bootstrapApproval', 'aigentZObserverReceipt', 'fsRuntimeActive'],
      receiptTypes: ['agent_delegated', 'finance_authoritative_execution'],
      companion: {
        before: 'A bounded delegation and Aigent Z’s bootstrap observation are required before the FS Runtime can activate.',
        complete: 'Control says can. The Passport and delegation say may. The mandate says what MoneyPenny may do now.',
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
      completionEvidence: ['aigentMeActive', 'focusDispositionRecorded', 'moneypennyRecordedAsDelegatedAgent', 'evidenceChainComplete'],
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
      label: 'Financial-services enrichments',
      milestone: 'VERIFIED',
      /*
       * A POST-ACTIVATION BRANCH, NOT AN ADMISSION STAGE (operator, 2026-08-03).
       * Both branches hang off aigentMe, per the operator's diagram:
       *
       *   Register -> Claim -> Passport -> Delegate -> aigentMe
       *                                                  |- Ingest -> Standing eligible
       *                                                  `- Verify -> Financial-services eligible
       *
       * It has no `nextStageId`: nothing waits on it, and it is not a step on
       * a line. Its sibling branch does not wait on it either.
       *
       * What it MAY later gate is specific financial-services capability:
       * advisory over live Pulse data, P&L transparency, treasury execution,
       * trading/settlement permissions, Marketa participation.
       */
      branch: 'capability',
      description: 'Horizen Pulse and P&L transparency enrich, never enlarge, the agent’s constitutional authority.',
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'pulse-transparency-toggle',
          note: 'Genuinely new component (§22) — no existing Pulse/P&L transparency UI exists in this repo.',
        },
        {
          mode: 'component',
          ref: 'horizen-agent-page-verify',
          note: "Reopens Horizen's agent page with transparency framing, per operator ruling 2026-07-31 — the direct partner-side depiction of Pulse/P&L state.",
        },
      ],
      prerequisites: ['aigentme'],
      permittedActions: ['authorize-pnl-disclosure'],
      completionEvidence: ['pulseAuthorizationVerified', 'pnlTransparencyEnabled', 'agentCardEnrichmentCommitted'],
      // GJR-VFY-001 Phase 2 (2026-07-31): horizen_pulse_authorized is the
      // authorizationClient's own confirmation receipt (Phase 1); the other
      // two are written by the Phase 2 enrichment step immediately after.
      receiptTypes: ['horizen_pulse_authorized', 'horizen_pnl_transparency_enabled', 'agent_card_enriched'],
      companion: {
        before: 'Horizen can enrich MoneyPenny’s verifiable operational state once you authorize disclosure.',
        complete:
          "Horizen has enriched MoneyPenny's verifiable operational state. It has not created or enlarged her constitutional authority.",
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
          props: { only: 'registry' },
          note:
            'Rendered bare — the registry Ingestion Factory ALONE (operator direction 2026-08-02). ' +
            'Standing was split out of this surface into its own eighth stage below, so Deploy no longer ' +
            'carries a Standing tab beside the Factory and the two are never conflated again.',
        },
      ],
      prerequisites: ['aigentme'],
      permittedActions: ['prepare-payment-mandate', 'execute-payment'],
      completionEvidence: ['delegatePassportActive', 'boundedDelegationActive', 'standingGatewayEnabled'],
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
       * `standing_accrued` remains the accrual receipt, written by the
       * Standing stage's own qualifying acts, never by this one.
       */
      receiptTypes: ['capability_registered'],
      receiptsSurfacedNatively: true,
      companion: {
        before: 'Ingest the activated agent into the factory to make it eligible to accrue Standing through validated work.',
        complete:
          'Ingested as a factory participant and now ELIGIBLE to accrue Standing. Nothing has been accrued yet — Standing is earned through qualifying, validated action.',
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