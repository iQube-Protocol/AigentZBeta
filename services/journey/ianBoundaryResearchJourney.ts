/**
 * Ian Boundary Research Journey — First native Journey Spine journey.
 *
 * Ian is a founder/researcher persona crossing into the Boundary Research
 * knowledge commons. This journey demonstrates Journey Spine features:
 *
 * - Phase-based progression with satisfactionConditions
 * - Actor role semantics (PRINCIPAL vs DELEGATE vs EITHER)
 * - Experience-aware stage requirements (REQUIRED vs OPTIONAL)
 * - DAG-style dependencies (not just linear prerequisites)
 * - State/experience-aware progression triggers
 * - Persistent destination (Boundary Research, no further progression)
 *
 * SPEC-JS-001 §2, §6, §9: The Ian journey is Threshold-crossing architecture,
 * where each phase consumes capability surfaces from existing subsystems
 * (Passport, Delegation, Constitutional Computing, Exchange, Signing) without
 * duplicating them. Journey Spine normalizes, sequences, and instruments their
 * use — never replaces them.
 *
 * OPERATOR CONSTRAINT 10: "The Ian experience should have one obvious
 * persistent destination after exchange: Boundary Research, with onboarding
 * steps receding into completed history."
 */

import type {
  JourneyDefinition,
  JourneyStageDefinition,
  ConditionExpression,
  JourneyPhase,
} from '@/types/journey';
import { ActorRole, StepRequirement } from '@/types/journey';
import { receiptCondition, andCondition } from './conditionEvaluator';

/**
 * PHASE DEFINITIONS: Ian's progression through six phases.
 *
 * Each phase represents a constitutional boundary:
 * - Orient:             Understanding the commitment
 * - Enter/Passport:     Asserting identity
 * - Deposit:            Committing an iQube artifact
 * - Freeze+Sign:        Applying multisig attestation
 * - Cross:              Reciprocal exchange activates research access
 * - Research:           Persistent destination (boundary research access granted)
 */

const PHASE_ORIENT: JourneyPhase = {
  version: '1.0',
  activeSince: '2026-08-24',
  title: 'Orientation & Commitment',
  stageIds: ['orient'],
  completionCondition: { type: 'receipt', value: 'orientation_ritual_completed' },
  description:
    'Understand what Boundary Research means, what constitutionally true conditions precede entry, and what persistent access entails.',
};

const PHASE_ENTER: JourneyPhase = {
  version: '1.0',
  activeSince: '2026-08-24',
  title: 'Identity & Entry',
  stageIds: ['passport', 'delegation-establish'],
  completionCondition: andCondition(
    receiptCondition('passport_issued'),
    receiptCondition('delegation_active')
  ),
  description:
    'Establish Passport identity and optionally delegate agent authority for research access.',
};

const PHASE_DEPOSIT: JourneyPhase = {
  version: '1.0',
  activeSince: '2026-08-24',
  title: 'Artifact Commitment',
  stageIds: ['create-deposit', 'freeze-attestation-ready'],
  completionCondition: receiptCondition('iqube_holder_status_confirmed'),
  description:
    'Create and deposit an iQube artifact, establishing research participant eligibility.',
};

const PHASE_FREEZE_SIGN: JourneyPhase = {
  version: '1.0',
  activeSince: '2026-08-24',
  title: 'Multisig Commitment',
  stageIds: ['freeze-attestation', 'exchange-ready'],
  completionCondition: andCondition(
    receiptCondition('artifact_freeze_initiated'),
    receiptCondition('exchange_instrument_signed')
  ),
  description:
    'Apply multisig freeze attestation and sign exchange instrument for reciprocal agreement.',
};

const PHASE_CROSS: JourneyPhase = {
  version: '1.0',
  activeSince: '2026-08-24',
  title: 'Reciprocal Exchange',
  stageIds: ['exchange-complete', 'research-access-provisioned'],
  completionCondition: receiptCondition('reciprocal_exchange_completed'),
  description:
    'Complete reciprocal exchange; Boundary Research becomes ACTIVE and persistent.',
};

const PHASE_RESEARCH: JourneyPhase = {
  version: '1.0',
  activeSince: '2026-08-24',
  title: 'Boundary Research Access',
  stageIds: ['research-active'],
  completionCondition: receiptCondition('boundary_research_access_active'),
  description:
    'Persistent destination: continuous access to Boundary Research knowledge commons.',
};

/**
 * JOURNEY DEFINITION: Ian Boundary Research Journey
 */
export const IAN_BOUNDARY_RESEARCH_JOURNEY: JourneyDefinition = {
  id: 'ian-boundary-research',
  version: '1.0.0',
  label: 'Boundary Research Crossing',
  partner: 'threshold',
  destination: 'research-active',
  subjectRef: 'ian-researcher',

  // New in Journey Spine: explicit phases with version + completion conditions
  phases: [PHASE_ORIENT, PHASE_ENTER, PHASE_DEPOSIT, PHASE_FREEZE_SIGN, PHASE_CROSS, PHASE_RESEARCH],

  stages: [
    // ─────────────────────────────────────────────────────────────────────
    // PHASE 1: ORIENTATION & COMMITMENT
    // ─────────────────────────────────────────────────────────────────────

    {
      id: 'orient',
      label: 'Orient to Crossing',
      description:
        'Understand what Boundary Research is, what it means to cross into it, and what ' +
        'constitutionally true conditions precede entry.',

      // New: Actor role semantics — PRINCIPAL (owner) vs DELEGATE vs EITHER
      actorRole: ActorRole.PRINCIPAL,

      // New: Requirement type — REQUIRED / OPTIONAL / CONDITIONAL / FUTURE
      requirement: StepRequirement.REQUIRED,

      actor: 'operator',
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'ian-orientation-panel',
          note: 'Guided intro to Boundary Research, what crossing means, constitutional preconditions.',
        },
      ],
      prerequisites: [],
      permittedActions: ['acknowledge-orientation'],

      completionEvidence: ['orientationRitualCompleted'],
      receiptTypes: ['orientation_ritual_completed'],

      // New: satisfactionCondition — evolved completion criteria (fallback: completionEvidence)
      satisfactionCondition: receiptCondition('orientation_ritual_completed'),

      companion: {
        before:
          'Boundary Research is a persistent knowledge commons for rigorous work. ' +
          'Entry requires understanding what access means and what commitment precedes it.',
        complete:
          'You understand the crossing. Identity and constitutional authority establish next.',
      },
      narrator: { active: 'Preparing for crossing', consequence: 'Confirms understanding' },
      nextStageId: 'passport',
    },

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 2: IDENTITY & ENTRY
    // ─────────────────────────────────────────────────────────────────────

    {
      id: 'passport',
      label: 'Assert Identity',
      description:
        'Establish Passport identity — persistent, verifiable proof of who you are within the Boundary Research commons.',

      actorRole: ActorRole.PRINCIPAL,
      requirement: StepRequirement.REQUIRED,

      actor: 'operator',
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'venture-participate-apply',
          note: 'The real Passport application module — surfaces existing Passport service, never forked.',
        },
      ],
      prerequisites: ['orient'],
      permittedActions: ['issue-passport', 'use-existing-passport'],

      completionEvidence: ['passportIssued'],
      receiptTypes: ['passport_issued'],
      satisfactionCondition: receiptCondition('passport_issued'),

      // New: dependencies — DAG-style prerequisites (not yet fully evaluated in Stage 1,
      // but structure is in place for Stage 2+ evolution)
      dependencies: [],

      companion: {
        before: 'Your Passport establishes who you are. This identity persists across Boundary Research.',
        complete: 'Identity established. You are now recognized in the commons.',
      },
      narrator: { active: 'Asserting identity', consequence: 'Proves persistent presence' },
      nextStageId: 'delegation-establish',
    },

    {
      id: 'delegation-establish',
      label: 'Establish Delegation (Optional)',
      description:
        'Optionally delegate research authority to an agent (e.g. aigentMe, a research assistant). ' +
        'Delegation is orthogonal to Passport — you retain control regardless.',

      actorRole: ActorRole.PRINCIPAL,
      requirement: StepRequirement.OPTIONAL, // ← New: OPTIONAL type

      actor: 'operator',
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'venture-participate-delegation',
          note: 'The real bounded-delegation module — surfaces existing Delegation service, never forked.',
        },
      ],
      prerequisites: ['passport'],
      permittedActions: ['propose-delegation', 'skip-delegation'],

      completionEvidence: ['delegationEstablished'],
      receiptTypes: ['delegation_active', 'delegation_skipped'],
      satisfactionCondition: receiptCondition('delegation_active'),

      companion: {
        before:
          'You can delegate research authority to an agent to help navigate Boundary Research. ' +
          'This is optional — your Passport identity remains primary.',
        complete: 'Delegation established. Your agent can assist research activities.',
      },
      narrator: {
        active: 'Optionally delegating authority',
        consequence: 'Agent can assist (or none, you proceed alone)',
      },
      nextStageId: 'create-deposit',
    },

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 3: ARTIFACT COMMITMENT (DEPOSIT)
    // ─────────────────────────────────────────────────────────────────────

    {
      id: 'create-deposit',
      label: 'Create Research Artifact',
      description:
        'Create and deposit an iQube artifact (a research contribution, data asset, or knowledge record). ' +
        'Artifact creation establishes you as an eligible Boundary Research participant.',

      actorRole: ActorRole.PRINCIPAL, // ← Only PRINCIPAL can deposit; delegation may assist but cannot sign
      requirement: StepRequirement.REQUIRED,

      actor: 'operator',
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'irl-exchange-workspace',
          note: 'The real Reciprocal Artifact Exchange workspace — deposit your artifact here.',
        },
      ],
      prerequisites: ['delegation-establish'],
      permittedActions: ['create-iqube', 'upload-content'],

      completionEvidence: ['iqubeCreated', 'contentDeposited'],
      receiptTypes: ['iqube_created', 'content_deposited'],
      satisfactionCondition: andCondition(
        receiptCondition('iqube_created'),
        receiptCondition('content_deposited')
      ),

      companion: {
        before:
          'Your research contribution becomes an iQube — a durable, verifiable asset in Boundary Research.',
        complete: 'Artifact deposited. You are now an eligible research participant.',
      },
      narrator: { active: 'Creating research artifact', consequence: 'Establishes eligibility' },
      nextStageId: 'freeze-attestation-ready',
    },

    {
      id: 'freeze-attestation-ready',
      label: 'Prepare for Attestation',
      description:
        'Review artifact and confirm readiness for multisig freeze attestation. ' +
        'This stage is presentation — no action, only acknowledgment.',

      actorRole: ActorRole.PRINCIPAL,
      requirement: StepRequirement.REQUIRED,

      actor: 'operator',
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'irl-exchange-workspace',
          note: 'Review your deposited artifact in the same Exchange workspace, ahead of freeze attestation.',
        },
      ],
      prerequisites: ['create-deposit'],
      permittedActions: ['acknowledge-ready'],

      completionEvidence: ['attestationReadyAcknowledged'],
      receiptTypes: ['attestation_ready_acknowledged'],
      satisfactionCondition: receiptCondition('attestation_ready_acknowledged'),

      // New: CONDITIONAL requirement — depends on prior stage state
      // This stage is REQUIRED if artifact was just created, but could be OPTIONAL
      // if accessed from a later checkpoint. Example for Stage 2+ evolution:
      // requirement: 'conditional',
      // requirementCondition: { ... needs prior stage state ... }

      companion: {
        before: 'Your artifact is ready for multisig attestation. Review and confirm.',
        complete: 'Ready to proceed to freeze attestation.',
      },
      narrator: { active: 'Reviewing artifact', consequence: 'Confirmed for attestation' },
      nextStageId: 'freeze-attestation',
    },

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 4: MULTISIG COMMITMENT (FREEZE + SIGN)
    // ─────────────────────────────────────────────────────────────────────

    {
      id: 'freeze-attestation',
      label: 'Freeze & Attest Artifact',
      description:
        'Apply multisig freeze attestation to the iQube artifact. ' +
        'Freeze establishes the artifact as immutable evidence for the crossing.',

      actorRole: ActorRole.PRINCIPAL, // ← Freeze attestation is principal-only per constraint 2
      requirement: StepRequirement.REQUIRED,

      actor: 'operator',
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'irl-exchange-workspace',
          note: 'Freeze declaration — the same Exchange workspace\'s Freeze Declaration action.',
        },
      ],
      prerequisites: ['freeze-attestation-ready'],
      permittedActions: ['initiate-freeze', 'collect-signatures'],

      completionEvidence: ['artifactFreezeInitiated', 'freezeSignaturesCollected'],
      receiptTypes: ['artifact_freeze_initiated', 'freeze_signatures_collected'],
      satisfactionCondition: andCondition(
        receiptCondition('artifact_freeze_initiated'),
        receiptCondition('freeze_signatures_collected')
      ),

      companion: {
        before: 'Multisig attestation freezes your artifact as tamper-evident evidence.',
        complete: 'Artifact is frozen and multisig-attested. Ready for exchange.',
      },
      narrator: { active: 'Freezing artifact', consequence: 'Establishes immutable evidence' },
      nextStageId: 'exchange-ready',
    },

    {
      id: 'exchange-ready',
      label: 'Sign Exchange Instrument',
      description:
        'Sign the reciprocal exchange instrument. This is the constitutional act that commits you ' +
        'to the crossing and activates Boundary Research access.',

      actorRole: ActorRole.PRINCIPAL, // ← Only PRINCIPAL can sign the exchange instrument per constraint 2
      requirement: StepRequirement.REQUIRED,

      actor: 'operator',
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'irl-exchange-workspace',
          note: 'Exchange Instrument review and signing — the same Exchange workspace.',
        },
      ],
      prerequisites: ['freeze-attestation'],
      permittedActions: ['review-instrument', 'sign-instrument'],

      completionEvidence: ['exchangeInstrumentSigned'],
      receiptTypes: ['exchange_instrument_signed'],
      satisfactionCondition: receiptCondition('exchange_instrument_signed'),

      companion: {
        before:
          'The exchange instrument is your side of a reciprocal commitment. ' +
          'Signing it will activate your Boundary Research access.',
        complete: 'Exchange instrument signed. Reciprocal crossing is now in motion.',
      },
      narrator: { active: 'Signing exchange', consequence: 'Commits to crossing' },
      nextStageId: 'exchange-complete',
    },

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 5: RECIPROCAL EXCHANGE (CROSS)
    // ─────────────────────────────────────────────────────────────────────

    {
      id: 'exchange-complete',
      label: 'Complete Reciprocal Exchange',
      description:
        'The reciprocal exchange is complete. Boundary Research becomes ACTIVE and your access is provisioned.',

      actorRole: ActorRole.EITHER, // ← Exchange completion may be confirmed by either party
      requirement: StepRequirement.REQUIRED,

      actor: 'system', // System resolves exchange completion (not a direct user action)
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'irl-exchange-workspace',
          note: 'View crossing/receipt status — the same Exchange workspace.',
        },
      ],
      prerequisites: ['exchange-ready'],
      permittedActions: ['view-completion'],

      completionEvidence: ['reciprocalExchangeCompleted'],
      receiptTypes: ['reciprocal_exchange_completed'],

      // Constraint 5: "Boundary Research becomes ACTIVE when reciprocal exchange completes"
      satisfactionCondition: receiptCondition('reciprocal_exchange_completed'),

      companion: {
        before: 'Awaiting reciprocal exchange completion.',
        complete:
          'Exchange complete. Your reciprocal commitment is recorded. Boundary Research access is now active.',
      },
      narrator: { active: 'Crossing', consequence: 'Reciprocal exchange confirmed' },
      nextStageId: 'research-active',
    },

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 6: BOUNDARY RESEARCH ACCESS (PERSISTENT DESTINATION)
    // ─────────────────────────────────────────────────────────────────────

    {
      id: 'research-active',
      label: 'Boundary Research Access Active',
      description:
        'You are now an active participant in Boundary Research. This is a persistent destination — ' +
        'no further progression. Continued access derives from your maintained status as an active, eligible participant.',

      actorRole: ActorRole.PRINCIPAL,
      requirement: StepRequirement.REQUIRED,

      actor: 'system', // Passive stage; system maintains status
      subjectRef: 'ian-researcher',
      surfaces: [
        {
          mode: 'component',
          ref: 'boundary-research-entry-panel',
          note: 'Boundary Research knowledge commons entry point.',
        },
        {
          mode: 'component',
          ref: 'participant-dashboard',
          note: 'View your research participation history, access, and standing.',
        },
      ],
      prerequisites: ['exchange-complete'],
      permittedActions: ['access-research', 'view-participation'],

      completionEvidence: ['boundaryResearchAccessActive'],
      receiptTypes: ['boundary_research_access_active'],

      // Constraint 10: "The Ian experience should have one obvious persistent destination
      // after exchange: Boundary Research, with onboarding steps receding into completed history"
      satisfactionCondition: receiptCondition('boundary_research_access_active'),

      companion: {
        before: 'Your Boundary Research access is provisioning.',
        complete:
          'Welcome to Boundary Research. Your access is active and persistent. ' +
          'Earlier stages (Orient, Identity, Artifact) now recede into completed history.',
      },
      narrator: {
        active: 'Accessing Boundary Research',
        consequence: 'Grants persistent research participation',
      },
      nextStageId: undefined, // ← TERMINAL STAGE: no progression beyond
    },
  ],
};

/**
 * Journey Spine Features Demonstrated by Ian:
 *
 * 1. Phase-based progression (PHASE_* definitions)
 *    - Each phase groups stages into constitutional boundaries
 *    - Phases have explicit completion conditions (satisfactionCondition)
 *    - Phases version independently
 *
 * 2. Actor role semantics (actorRole: PRINCIPAL | DELEGATE | EITHER)
 *    - PRINCIPAL-only stages: Orient, Passport, Deposit, Freeze, Sign, Research
 *    - EITHER stages: Exchange completion (counterparty confirms)
 *    - Constraint 2 enforced: Freeze & Sign remain principal-only
 *
 * 3. Stage requirement types (requirement: REQUIRED | OPTIONAL | CONDITIONAL | FUTURE)
 *    - Most stages: REQUIRED (part of critical path)
 *    - Delegation-establish: OPTIONAL (delegation is secondary)
 *    - Future: CONDITIONAL type can depend on prior state
 *
 * 4. satisfactionCondition (new, fallback: completionEvidence)
 *    - Each stage has explicit satisfactionCondition using ConditionExpression
 *    - Conditions map to receipt types (evidence-based) or future: settled facts, nested conditions
 *    - Preserves evidence-first principle: completionEvidence is always checked
 *
 * 5. DAG-style dependencies (new, fallback: prerequisites)
 *    - All stages currently use simple prerequisites (linear)
 *    - dependencies array is ready for Stage 2+ to add non-linear constraints
 *    - Example: "Exchange-complete depends on BOTH signatures AND artifact-freeze"
 *
 * 6. Experience-aware progression
 *    - orientation_ritual_completed inferred from state (not a new fact)
 *    - Delegation optional, not blocking (permittedActions: skip-delegation)
 *    - Research-active is terminal (nextStageId: undefined)
 *
 * 7. Persistent destination
 *    - Constraint 10: Research-Active is the end; no further progression
 *    - Onboarding stages (Orient-Freeze) recede into completed history
 *    - Participant keeps access via standing (services/journey/registrationStandingSeed)
 *
 * 8. Reuses existing capability surfaces
 *    - Surfaces ref existing services: Passport, Delegation, iQube, Signing, Exchange
 *    - No new surfaces created (Journey Spine normalizes, doesn't replace)
 */
