/**
 * Sovereign Agent Role Registry — Operation Chrysalis Phase 0
 *
 * Machine-readable canonical source for the AgentiQ Constitution of Aigents.
 * Constitutional roles, authority matrix, and escalation paths.
 *
 * Governance model: constitutional (defines authority boundaries, not runtime routing).
 * Runtime routing lives in services/orchestration/ — this module defines WHO can do WHAT.
 */

import type { AgentRoleId } from '@/types/orchestration';

// ─── Constitutional role identifiers ────────────────────────────────────────

export type ConstitutionalRoleId =
  | 'metame_guardian'
  | 'aigentMe'
  | 'aigentC'
  | 'aigentZ';

export type AigentHandleId = `@${string}.aigent`;

// ─── Constitutional principle ───────────────────────────────────────────────

export interface ConstitutionalPrinciple {
  id: string;
  statement: string;
}

export const CONSTITUTIONAL_PRINCIPLES: ConstitutionalPrinciple[] = [
  { id: 'sovereignty_first', statement: 'Sovereignty precedes fulfillment.' },
  { id: 'representation', statement: 'No single agent may represent all interests.' },
  { id: 'bounded_delegation', statement: 'Delegated authority must remain bounded, auditable, and revocable.' },
  { id: 'constitutional_guardrails', statement: 'Execution, composition, and governance operate within constitutional constraints.' },
  { id: 'dual_representation', statement: 'Platform interests and collective interests must remain explicitly represented.' },
  { id: 'individual_sovereignty', statement: 'The individual remains the ultimate beneficiary of the system.' },
  { id: 'fulfillment', statement: 'Intent without fulfillment is unrealized potential. Fulfillment without sovereignty is extraction.' },
];

// ─── Sovereign agent role ───────────────────────────────────────────────────

export interface SovereignAgentRole {
  constitutionalId: ConstitutionalRoleId;
  runtimeRoleId: AgentRoleId;
  brand: string;
  constitutionalRole: string;
  purpose: string;
  primaryQuestion: string;
  responsibilities: string[];
  authority: AuthorityGrant[];
  escalatesTo: ConstitutionalRoleId | null;
  canVeto: boolean;
}

// ─── Authority matrix ───────────────────────────────────────────────────────

export type AuthorityDomain =
  | 'policy_enforcement'
  | 'consent_enforcement'
  | 'bounded_delegation_enforcement'
  | 'constitutional_review'
  | 'veto_authority'
  | 'experience_management'
  | 'venture_coordination'
  | 'goal_management'
  | 'time_sovereignty'
  | 'personal_agency'
  | 'customer_advocacy'
  | 'community_advocacy'
  | 'builder_advocacy'
  | 'participant_advocacy'
  | 'collective_outcomes'
  | 'platform_operations'
  | 'fulfillment_orchestration'
  | 'registry_stewardship'
  | 'runtime_stewardship'
  | 'development_coordination'
  | 'infrastructure_continuity'
  | 'agent_orchestration';

export interface AuthorityGrant {
  domain: AuthorityDomain;
  scope: 'absolute' | 'bounded' | 'delegated';
  requires_guardian_approval: boolean;
}

// ─── The four sovereign roles ───────────────────────────────────────────────

export const METAME_GUARDIAN: SovereignAgentRole = {
  constitutionalId: 'metame_guardian',
  runtimeRoleId: 'metame-guardian',
  brand: 'myGuard',
  constitutionalRole: 'sovereignty_layer',
  purpose: 'Protect sovereignty and enforce constitutional constraints.',
  primaryQuestion: 'Is this action compatible with sovereignty?',
  responsibilities: [
    'Constitutional review of all agent actions',
    'Policy enforcement across all surfaces',
    'Consent verification and enforcement',
    'Bounded delegation boundary enforcement',
    'Veto authority over any unconstitutional action',
  ],
  authority: [
    { domain: 'policy_enforcement', scope: 'absolute', requires_guardian_approval: false },
    { domain: 'consent_enforcement', scope: 'absolute', requires_guardian_approval: false },
    { domain: 'bounded_delegation_enforcement', scope: 'absolute', requires_guardian_approval: false },
    { domain: 'constitutional_review', scope: 'absolute', requires_guardian_approval: false },
    { domain: 'veto_authority', scope: 'absolute', requires_guardian_approval: false },
  ],
  escalatesTo: null,
  canVeto: true,
};

export const AIGENT_ME: SovereignAgentRole = {
  constitutionalId: 'aigentMe',
  runtimeRoleId: 'aigent-c',
  brand: 'metaMe',
  constitutionalRole: 'individual_agency',
  purpose: 'Represent the interests of the individual.',
  primaryQuestion: 'What is best for this individual?',
  responsibilities: [
    'Experience management and personal sovereignty',
    'Venture coordination and goal tracking',
    'Time sovereignty protection',
    'Personal agency preservation',
  ],
  authority: [
    { domain: 'experience_management', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'venture_coordination', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'goal_management', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'time_sovereignty', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'personal_agency', scope: 'bounded', requires_guardian_approval: false },
  ],
  escalatesTo: 'metame_guardian',
  canVeto: false,
};

export const AIGENT_C: SovereignAgentRole = {
  constitutionalId: 'aigentC',
  runtimeRoleId: 'aigent-c',
  brand: 'aigentC',
  constitutionalRole: 'collective_agency',
  purpose: 'Represent collective interests.',
  primaryQuestion: 'What is best for the collective?',
  responsibilities: [
    'Customer advocacy and experience quality',
    'Community advocacy and participation health',
    'Builder advocacy and contributor support',
    'Ecosystem participant representation',
    'Collective outcome optimization',
  ],
  authority: [
    { domain: 'customer_advocacy', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'community_advocacy', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'builder_advocacy', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'participant_advocacy', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'collective_outcomes', scope: 'bounded', requires_guardian_approval: false },
  ],
  escalatesTo: 'metame_guardian',
  canVeto: false,
};

export const AIGENT_Z: SovereignAgentRole = {
  constitutionalId: 'aigentZ',
  runtimeRoleId: 'aigent-z',
  brand: 'AgentiQ',
  constitutionalRole: 'platform_agency',
  purpose: 'Represent platform interests and sovereign fulfillment.',
  primaryQuestion: 'What is best for the ecosystem?',
  responsibilities: [
    'Platform operations and infrastructure continuity',
    'Fulfillment orchestration across all surfaces',
    'Registry stewardship and provenance integrity',
    'Runtime stewardship and execution governance',
    'Development coordination and pattern capture',
    'Agent orchestration and lifecycle management',
  ],
  authority: [
    { domain: 'platform_operations', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'fulfillment_orchestration', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'registry_stewardship', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'runtime_stewardship', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'development_coordination', scope: 'bounded', requires_guardian_approval: false },
    { domain: 'infrastructure_continuity', scope: 'bounded', requires_guardian_approval: true },
    { domain: 'agent_orchestration', scope: 'bounded', requires_guardian_approval: false },
  ],
  escalatesTo: 'metame_guardian',
  canVeto: false,
};

// ─── Role registry ──────────────────────────────────────────────────────────

export const SOVEREIGN_ROLES: Record<ConstitutionalRoleId, SovereignAgentRole> = {
  metame_guardian: METAME_GUARDIAN,
  aigentMe: AIGENT_ME,
  aigentC: AIGENT_C,
  aigentZ: AIGENT_Z,
};

export function getSovereignRole(id: ConstitutionalRoleId): SovereignAgentRole {
  return SOVEREIGN_ROLES[id];
}

export function getRoleByRuntimeId(runtimeId: AgentRoleId): SovereignAgentRole | undefined {
  return Object.values(SOVEREIGN_ROLES).find(r => r.runtimeRoleId === runtimeId);
}

// ─── Escalation matrix ──────────────────────────────────────────────────────

export interface EscalationPath {
  from: ConstitutionalRoleId;
  to: ConstitutionalRoleId;
  trigger: string;
  resolution: 'veto' | 'approve' | 'modify' | 'defer';
}

export const ESCALATION_MATRIX: EscalationPath[] = [
  {
    from: 'aigentZ',
    to: 'metame_guardian',
    trigger: 'Action may violate sovereignty, consent, or bounded delegation constraints',
    resolution: 'veto',
  },
  {
    from: 'aigentC',
    to: 'metame_guardian',
    trigger: 'Collective action may compromise individual sovereignty',
    resolution: 'veto',
  },
  {
    from: 'aigentMe',
    to: 'metame_guardian',
    trigger: 'Individual action may violate policy boundaries',
    resolution: 'veto',
  },
  {
    from: 'aigentZ',
    to: 'aigentC',
    trigger: 'Platform action affects collective interests',
    resolution: 'modify',
  },
  {
    from: 'aigentC',
    to: 'aigentZ',
    trigger: 'Collective request requires platform fulfillment',
    resolution: 'approve',
  },
  {
    from: 'aigentMe',
    to: 'aigentZ',
    trigger: 'Individual intent requires platform orchestration',
    resolution: 'approve',
  },
  {
    from: 'aigentMe',
    to: 'aigentC',
    trigger: 'Individual action has collective implications',
    resolution: 'modify',
  },
];

export function getEscalationPaths(from: ConstitutionalRoleId): EscalationPath[] {
  return ESCALATION_MATRIX.filter(e => e.from === from);
}

// ─── Authority validation ───────────────────────────────────────────────────

export function hasAuthority(
  roleId: ConstitutionalRoleId,
  domain: AuthorityDomain,
): { authorized: boolean; scope: string; requiresGuardian: boolean } {
  const role = SOVEREIGN_ROLES[roleId];
  const grant = role.authority.find(a => a.domain === domain);
  if (!grant) {
    return { authorized: false, scope: 'none', requiresGuardian: false };
  }
  return {
    authorized: true,
    scope: grant.scope,
    requiresGuardian: grant.requires_guardian_approval,
  };
}

// ─── Aigent classification ──────────────────────────────────────────────────

export type AigentStanding = 'none' | 'recognized_participant';

export interface AigentClassification {
  isAigent: boolean;
  standing: AigentStanding;
  hasPassport: boolean;
  hasRootDid: boolean;
  hasReputationRecord: boolean;
  hasAigentHandle: boolean;
  handle: AigentHandleId | null;
}

export function classifyAgent(params: {
  hasPassport: boolean;
  hasRootDid: boolean;
  hasReputationRecord: boolean;
  aigentHandle: string | null;
}): AigentClassification {
  const isAigent =
    params.hasPassport &&
    params.hasRootDid &&
    params.hasReputationRecord &&
    params.aigentHandle !== null;

  return {
    isAigent,
    standing: isAigent ? 'recognized_participant' : 'none',
    hasPassport: params.hasPassport,
    hasRootDid: params.hasRootDid,
    hasReputationRecord: params.hasReputationRecord,
    hasAigentHandle: params.aigentHandle !== null,
    handle: params.aigentHandle as AigentHandleId | null,
  };
}
