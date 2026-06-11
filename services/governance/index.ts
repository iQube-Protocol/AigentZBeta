/**
 * Governance Module — Operation Chrysalis Phase 0
 *
 * Canonical source for the AgentiQ Constitution of Aigents:
 * - Sovereign agent role registry
 * - Authority matrix and validation
 * - Escalation paths
 * - Governance decision log
 * - Aigent classification
 */

export {
  type ConstitutionalRoleId,
  type AigentHandleId,
  type ConstitutionalPrinciple,
  type SovereignAgentRole,
  type AuthorityDomain,
  type AuthorityGrant,
  type EscalationPath,
  type AigentStanding,
  type AigentClassification,
  CONSTITUTIONAL_PRINCIPLES,
  METAME_GUARDIAN,
  AIGENT_ME,
  AIGENT_C,
  AIGENT_Z,
  SOVEREIGN_ROLES,
  ESCALATION_MATRIX,
  getSovereignRole,
  getRoleByRuntimeId,
  getEscalationPaths,
  hasAuthority,
  classifyAgent,
} from './sovereignAgentRoles';

export {
  type DecisionStatus,
  type DecisionDomain,
  type GovernanceDecision,
  GOVERNANCE_DECISIONS,
  getDecision,
  getDecisionsByDomain,
  getDecisionsByInitiative,
  getActiveDecisions,
} from './governanceDecisionLog';
