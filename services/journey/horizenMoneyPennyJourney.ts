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
  label: 'Horizen × metaMe: MoneyPenny Constitutional Admission Journey',
  partner: 'horizen',
  destination: 'aigentme',
  subjectRef: 'moneypenny',
  stages: [
    {
      id: 'register',
      label: 'Register',
      description: 'MoneyPenny enters Horizen as a discoverable, technically controllable external agent.',
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
          ref: 'agent-card',
          entityRef: 'moneypenny',
          note: "metaMe's complementary reflection of the same registration.",
        },
      ],
      prerequisites: [],
      permittedActions: ['view-registration'],
      completionEvidence: ['aigentQubeResolved', 'tokenId', 'registryRereadOk', 'ownerWalletMatches', 'agentCardResolves'],
      receiptTypes: ['agent_card_discovered', 'horizen_agent_registered'],
      companion: {
        before: 'MoneyPenny has not yet registered with Horizen.',
        complete:
          'MoneyPenny is now discoverable in Horizen. Registry presence proves identity and discoverability, but not constitutional authority.',
      },
      nextStageId: 'verify',
    },
    {
      id: 'verify',
      label: 'Verify',
      description: 'Horizen Pulse and P&L transparency are activated, enriching (never enlarging) her constitutional authority.',
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'pulse-transparency-toggle',
          note: 'Genuinely new component (§22) — no existing Pulse/P&L transparency UI exists in this repo.',
        },
      ],
      prerequisites: ['register'],
      permittedActions: ['authorize-pnl-disclosure'],
      completionEvidence: ['pulseAuthorizationVerified', 'pnlTransparencyEnabled', 'agentCardEnrichmentCommitted'],
      receiptTypes: ['horizen_pnl_transparency_enabled', 'agent_card_enriched'],
      companion: {
        before: 'Horizen can enrich MoneyPenny’s verifiable operational state once you authorize disclosure.',
        complete:
          "Horizen has enriched MoneyPenny's verifiable operational state. It has not created or enlarged her constitutional authority.",
      },
      nextStageId: 'claim',
    },
    {
      id: 'claim',
      label: 'Claim',
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
      prerequisites: ['verify'],
      permittedActions: ['prove-wallet-control'],
      completionEvidence: ['controlProofFresh', 'marketaFinalRecommendation'],
      receiptTypes: ['agent_control_proven', 'marketa_eligibility_recommended'],
      companion: {
        before: 'A wallet-control challenge must be signed before Marketa can issue her final recommendation.',
        complete: 'Control has been proven without revealing the private key. Control does not yet equal authority.',
      },
      nextStageId: 'passport',
    },
    {
      id: 'passport',
      label: 'Passport',
      description: "The operator's own Polity Citizen Passport resolves, then sponsorship, then MoneyPenny's Polity Delegate Passport issues.",
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'passport-bureau-registry',
          note: "Leading candidate for the operator's own passport-status view (§22 open item).",
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
      description: 'Bounded delegation and FS Runtime bootstrap activate MoneyPenny’s authority.',
      actor: 'operator',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'iframe',
          ref: 'constitutional-agreements',
          note: 'Venture Lab α → Partner Pilot Command Center → Constitutional Agreements.',
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
      nextStageId: 'activate',
    },
    {
      id: 'activate',
      label: 'Activate',
      description: 'Standing gateway opens; payment demonstration is optional evidence, never a constitutional prerequisite.',
      actor: 'moneypenny',
      subjectRef: 'moneypenny',
      surfaces: [
        {
          mode: 'component',
          ref: 'agent-wallet',
          note: 'MoneyPenny’s wallet + mandate, via the canonical embedded wallet pattern.',
        },
      ],
      prerequisites: ['delegate'],
      permittedActions: ['prepare-payment-mandate', 'execute-payment'],
      completionEvidence: ['delegatePassportActive', 'boundedDelegationActive', 'standingGatewayEnabled'],
      receiptTypes: ['standing_accrued'],
      companion: {
        before: 'MoneyPenny’s Standing gateway opens once her transparency and delegation are active.',
        complete:
          'MoneyPenny entered Horizen capable of paying. Horizen made her financial activity independently observable. Verified transparency now opens her pathway to Standing.',
      },
      nextStageId: 'aigentme',
    },
    {
      id: 'aigentme',
      label: 'aigentMe',
      description:
        'aigentMe activates as the operator’s constitutional companion; the operator decides whether MoneyPenny’s domain focus shapes their ExperienceQube population (§5.10).',
      actor: 'aigentme',
      subjectRef: 'operator',
      surfaces: [
        {
          mode: 'iframe',
          ref: 'aigentme-welcome',
          note: 'aigentMe’s existing copilot/dashboard shell, composed as the base surface.',
        },
        {
          mode: 'component',
          ref: 'aigentme-focus-disposition-prompt',
          note: 'Genuinely new component (§22) — the confirm/decline-focus prompt this stage requires.',
        },
      ],
      prerequisites: ['activate'],
      permittedActions: ['record-focus-disposition'],
      completionEvidence: ['aigentMeActive', 'focusDispositionRecorded', 'moneypennyRecordedAsDelegatedAgent', 'evidenceChainComplete'],
      receiptTypes: ['aigentme_activated', 'experienceqube_focus_disposition_recorded', 'journey_completed'],
      companion: {
        before: 'MoneyPenny is ready to introduce you to aigentMe, your constitutional companion.',
        complete:
          'You have crossed the threshold. Your Polity Citizen Passport establishes your continuing constitutional personhood. aigentMe is now active as your constitutional companion. MoneyPenny has joined your agent set through a Polity Delegate Passport and may act only within the authority and mandates you have granted.',
      },
    },
  ],
};
