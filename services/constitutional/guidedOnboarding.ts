/**
 * guidedOnboarding.ts — the executable form of the CFS-043a guided passport &
 * delegation onboarding script.
 *
 * An agent uses this to GUIDE its human principal through (1) getting a Polity
 * Passport and (2) granting the agent a bounded delegation — while the
 * Principal–Delegate Separation safeguard (CFS-043 §2) is structurally
 * preserved: this module NEVER emits an authorize step the agent performs, and
 * it NEVER places the agent in the owner/authorizer slot. The agent forms
 * (drafts) and accepts (its own side); only the human principal authorizes.
 *
 * Proof-of-humanity is GRADED to contract risk (CFS-043 §2.1): weak captcha for
 * read/write delegations (the passport application already carries it — zero
 * added friction), strong World ID / passkey for money-moving contracts (the
 * Constitutional Financial Services programme). The strength dial rises with
 * the stakes; it is not a fixed toll.
 *
 * This is a PURE composition layer over already-shipped primitives — it invents
 * no new trust surface. The actual form/accept/authorize calls go through the
 * existing POST /api/constitutional/agreement endpoint; the passport surfaces
 * are the IRL OS cartridge tabs; the deep links are built with buildCodexUrl.
 *
 * Charter: CFS-043 · Script: CFS-043a · First instance: CFS-042 (Austin/EXP-P1).
 */

import type { DelegatedAuthority } from './constitutionalAgreement';
import { buildCodexUrl } from '../../utils/codex-nav';

// ── risk & proof grading ────────────────────────────────────────────────────

/** The risk profile of what is being delegated. Drives the proof grade. */
export type RiskProfile = 'read-write' | 'money-moving';

/** Proof-of-humanity strength, aligned to PersonhoodProofType in
 *  services/passport/personhoodProof.ts. */
export type ProofGrade = 'captcha' | 'world_id';

/** The verificationRequirements token written onto the agreement object so the
 *  authorize gate reads the required grade off the contract, not hard-coded. */
export const PROOF_REQUIREMENT: Record<ProofGrade, string> = {
  captcha: 'captcha-verified-authorizer',
  world_id: 'world-id-verified-authorizer',
};

/**
 * Grade the required proof-of-humanity from the contract's risk.
 * PURE. Money-moving contracts require strong (World ID); read/write require
 * only the weak captcha the passport application already carries. This is the
 * Graded Proof-of-Humanity invariant (CFS-043 §6) as code.
 */
export function requiredProofGrade(risk: RiskProfile): ProofGrade {
  return risk === 'money-moving' ? 'world_id' : 'captcha';
}

/** A DelegatedAuthority is money-moving iff it declares a settlement/ceiling. */
export function riskOfAuthority(authority: Pick<DelegatedAuthority, 'valueCeiling'>, hasSettlement = false): RiskProfile {
  return hasSettlement || (authority.valueCeiling != null && authority.valueCeiling > 0) ? 'money-moving' : 'read-write';
}

// ── recommended bounded authority ───────────────────────────────────────────

export interface RecommendAuthorityInput {
  /** The capability being delegated, e.g. 'irl:experiment-result:submit'. */
  capabilityRef: string;
  /** What the delegate may do — the ALLOWED actions (narrow). */
  allowedActions: string[];
  /** The surface(s) the delegation is scoped to. Defaults to [capabilityRef]. */
  allowedSurfaces?: string[];
  /** The experiment/engagement window — the authority EXPIRES, never standing. */
  ttlHours: number;
  /** Bounded action budget — the delegation is spent, not open-ended. */
  maxActions: number;
  risk: RiskProfile;
  /** Money-moving only: the enforced spend ceiling (rail's smallest unit). */
  valueCeiling?: number | null;
}

/**
 * Draft the recommended bounded DelegatedAuthority for the human to review.
 * PURE. The forbidden actions always include the governance verbs a delegate
 * must never hold (ratify/flip/edit-crystal) plus read-persona — these are the
 * self-escalation surface. valueCeiling is null unless money-moving (P3:
 * spendWithinCap refuses null-ceiling money movement downstream).
 */
export function recommendDelegatedAuthority(input: RecommendAuthorityInput): DelegatedAuthority {
  const moneyMoving = input.risk === 'money-moving';
  return {
    band: moneyMoving ? 'L3' : 'L2',
    allowedActions: input.allowedActions,
    forbiddenActions: ['ratify', 'flip-authoritative', 'edit-crystal', 'read-persona'],
    allowedSurfaces: input.allowedSurfaces ?? [input.capabilityRef],
    ttlHours: input.ttlHours,
    maxActions: input.maxActions,
    valueCeiling: moneyMoving ? (input.valueCeiling ?? null) : null,
  };
}

// ── passport deep links (IRL OS cartridge tabs) ─────────────────────────────

export interface DeepLinkOptions {
  /** Preferred identity param for the embed route. */
  personaSessionToken?: string;
  /** Legacy identity param (Phase-1 compat). */
  personaId?: string;
  /** Breadcrumb source label. */
  from?: string;
}

/**
 * Deep links into the IRL OS cartridge's Polity Passport tabs, so the principal
 * onboards from the IRL OS embed alone (no full metaMe thin client). Built with
 * buildCodexUrl so identity + breadcrumb params attach correctly.
 */
export function passportDeepLinks(opts: DeepLinkOptions = {}): {
  apply: string; delegation: string; registry: string; locker: string;
} {
  const base = { personaSessionToken: opts.personaSessionToken, personaId: opts.personaId, from: opts.from ?? 'guided-onboarding' };
  return {
    apply: buildCodexUrl('irl-os', { ...base, tab: 'irl-os-passport-apply' }),
    delegation: buildCodexUrl('irl-os', { ...base, tab: 'irl-os-passport-delegation' }),
    registry: buildCodexUrl('irl-os', { ...base, tab: 'irl-os-passport-registry' }),
    locker: buildCodexUrl('irl-os', { ...base, tab: 'irl-os-passport-locker' }),
  };
}

// ── the onboarding plan ─────────────────────────────────────────────────────

/** Who performs a step. The AUTHORIZE step is ALWAYS 'human' — the module
 *  cannot emit an agent-performed authorize (Principal–Delegate Separation). */
export type StepActor = 'agent' | 'human';

export interface OnboardingStep {
  id: string;
  actor: StepActor;
  title: string;
  instruction: string;
  /** A passport surface to open, if this step navigates the human somewhere. */
  deepLink?: string;
  /** An API call this step makes, if any. Authorize is human-actor only. */
  apiCall?: { method: 'POST'; path: string; body: Record<string, unknown> };
  /** The safeguard note the agent must honour at this step. */
  safeguard?: string;
}

export interface OnboardingPlan {
  capabilityRef: string;
  agentRef: string;
  displayLabel: string;
  risk: RiskProfile;
  requiredProof: ProofGrade;
  delegatedAuthority: DelegatedAuthority;
  deepLinks: ReturnType<typeof passportDeepLinks>;
  steps: OnboardingStep[];
  /** The prime directive, carried on every plan so the agent cannot lose it. */
  primeDirective: string;
}

export interface BuildPlanInput {
  /** A stable idempotent slug for the agreement. */
  agreementId: string;
  displayLabel: string;
  capabilityRef: string;
  /** The delegate agent's ref — occupies selectedAgentRef, NEVER the owner slot. */
  agentRef: string;
  /** The delegate agent's acceptor id (for its own accept step). */
  agentAcceptorId: string;
  allowedActions: string[];
  ttlHours: number;
  maxActions: number;
  risk: RiskProfile;
  valueCeiling?: number | null;
  governingInvariants?: string[];
  link?: DeepLinkOptions;
}

const PRIME_DIRECTIVE =
  'You (the agent) guide. The human authorizes. You may pre-fill, explain, and recommend every field — ' +
  'but the authorize step and any strong proof-of-humanity are performed by the human principal, as themselves. ' +
  'You can never grant yourself authority; that is the point, not a limitation.';

/**
 * Build the ordered guided-onboarding plan (CFS-043a steps 0–6).
 * PURE. Structurally guarantees the safeguard: the only step that authorizes is
 * actor 'human'; the agent's steps are framing, navigation, form (draft), and
 * accept (its own side). The agent ref is placed in selectedAgentRef, never in
 * an owner/authorizer position.
 */
export function buildOnboardingPlan(input: BuildPlanInput): OnboardingPlan {
  const risk = input.risk;
  const requiredProof = requiredProofGrade(risk);
  const delegatedAuthority = recommendDelegatedAuthority({
    capabilityRef: input.capabilityRef,
    allowedActions: input.allowedActions,
    ttlHours: input.ttlHours,
    maxActions: input.maxActions,
    risk,
    valueCeiling: input.valueCeiling ?? null,
  });
  const deepLinks = passportDeepLinks(input.link);
  const AGREEMENT_PATH = '/api/constitutional/agreement';

  const steps: OnboardingStep[] = [
    {
      id: 'frame',
      actor: 'agent',
      title: 'Frame the onboarding',
      instruction:
        'Explain to the principal: they will get a Polity Passport (their sovereign identity) and then THEY authorize a ' +
        'narrow, revocable delegation to you. You draft and explain the terms; only they can approve it. Set expectations: ' +
        'the human is the sovereign grantor; you are the on-ramp.',
      safeguard: PRIME_DIRECTIVE,
    },
    {
      id: 'passport-apply',
      actor: 'human',
      title: 'Apply for a Polity Passport',
      instruction:
        'The principal applies for their Passport. This carries a WEAK captcha proof of humanity and issues an ' +
        'anonymous-citizen passport. The agent explains but does not submit — the application is the human\'s.',
      deepLink: deepLinks.apply,
      safeguard: 'Do not submit the application on the human\'s behalf.',
    },
    {
      id: 'proof-of-humanity',
      actor: 'human',
      title:
        requiredProof === 'world_id'
          ? 'Verify with World ID (strong proof — money-moving contract)'
          : 'Proof of humanity satisfied by application captcha (weak — sufficient here)',
      instruction:
        requiredProof === 'world_id'
          ? 'This is a money-moving contract, so strong proof is required. The principal completes World ID, upgrading their ' +
            'passport to verified_citizen, BEFORE authorizing. The agent prompts but cannot hold or replay the proof.'
          : 'The captcha taken at passport application is sufficient for this read/write contract — no extra verification, no ' +
            'added friction. Proceed to forming the agreement.',
      deepLink: requiredProof === 'world_id' ? deepLinks.registry : undefined,
      safeguard: 'Match proof strength to the stakes; never over-verify a low-risk contract.',
    },
    {
      id: 'form-agreement',
      actor: 'agent',
      title: 'Draft the bounded delegation (agent drafts, human reviews)',
      instruction:
        'The agent drafts the recommended bounded authority and calls form. Present the bounds (surface, TTL, action cap' +
        (risk === 'money-moving' ? ', spend ceiling' : '') + ') to the human in plain language. Nothing is granted yet.',
      apiCall: {
        method: 'POST',
        path: AGREEMENT_PATH,
        body: {
          action: 'form',
          agreementId: input.agreementId,
          displayLabel: input.displayLabel,
          capabilityRef: input.capabilityRef,
          selectedAgentRef: input.agentRef,
          delegatedAuthority,
          verificationRequirements: [PROOF_REQUIREMENT[requiredProof]],
          governingInvariants: input.governingInvariants ?? [],
        },
      },
      deepLink: deepLinks.delegation,
      safeguard: 'The agreement is owned by the logged-in human persona. The agent is only selectedAgentRef.',
    },
    {
      id: 'agent-accept',
      actor: 'agent',
      title: 'Accept the terms (agent\'s own side)',
      instruction:
        'The agent accepts the terms it will operate under (x409 / Consenti). Acceptance does NOT open the gate — ' +
        'authorization does.',
      apiCall: {
        method: 'POST',
        path: AGREEMENT_PATH,
        body: {
          action: 'accept',
          agreementId: input.agreementId,
          acceptorType: 'agent',
          acceptorId: input.agentAcceptorId,
          provider: 'consenti',
        },
      },
      safeguard: 'acceptorType is \'agent\' — this is the delegate\'s side, not the grant.',
    },
    {
      id: 'human-authorize',
      actor: 'human',
      title: 'Authorize the delegation (HUMAN ONLY — the gate)',
      instruction:
        'The PRINCIPAL, as themselves, authorizes. authorizeAgreement refuses anyone but the owning persona (owner-commitment ' +
        'match)' +
        (requiredProof === 'world_id' ? ' AND requires their verified_citizen / World-ID status.' : '.') +
        ' On success: agreement_authorized receipt + the requireAuthorizedAgreement gate opens.',
      apiCall: {
        method: 'POST',
        path: AGREEMENT_PATH,
        body: { action: 'authorize', agreementId: input.agreementId },
      },
      safeguard:
        'AGENT ROLE: NONE. You may confirm success (read the receipt); you may not perform this call. If proof is missing, ' +
        'route the human back to the proof step — never bypass.',
    },
    {
      id: 'operate',
      actor: 'agent',
      title: 'Operate within bounds',
      instruction:
        'The agent may now exercise the capability. Every action re-checks requireAuthorizedAgreement and decrements the ' +
        'maxActions budget. TTL lapse / budget exhaustion / status flip closes the gate — no separate kill-switch.',
      safeguard: 'Stay within allowedActions/allowedSurfaces; never attempt a forbiddenAction.',
    },
  ];

  return {
    capabilityRef: input.capabilityRef,
    agentRef: input.agentRef,
    displayLabel: input.displayLabel,
    risk,
    requiredProof,
    delegatedAuthority,
    deepLinks,
    steps,
    primeDirective: PRIME_DIRECTIVE,
  };
}
