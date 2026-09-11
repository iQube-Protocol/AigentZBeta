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
  type ConstitutionalEntity,
  CONSTITUTIONAL_PRINCIPLES,
  METAME_GUARDIAN,
  AIGENT_ME,
  AIGENT_C,
  AIGENT_Z,
  SOVEREIGN_ROLES,
  ESCALATION_MATRIX,
  CONSTITUTIONAL_ENTITIES,
  getSovereignRole,
  getRoleByRuntimeId,
  getEscalationPaths,
  hasAuthority,
  classifyAgent,
  getConstitutionalEntity,
} from './sovereignAgentRoles';

export {
  type DecisionStatus,
  type DecisionDomain,
  type GovernanceDecision,
  type SovereigntyImpact,
  type SovereigntyImpactLevel,
  GOVERNANCE_DECISIONS,
  getDecision,
  getDecisionsByDomain,
  getDecisionsByInitiative,
  getActiveDecisions,
} from './governanceDecisionLog';

export {
  type GovernanceActionType,
  type GovernanceReceiptInput,
  createGovernanceReceipt,
} from './governanceReceiptHelper';

/**
 * The ratification EVENT SOURCE (operator ruling 2026-07-27). The decision log
 * re-exported above is seed/compatibility data projected over these records —
 * `projectGovernanceDecisionLog()` is what new code reads.
 */
export {
  type GovernanceRatification,
  type RatificationAct,
  type RatificationKind,
  type ContentHashScope,
  type AnchorStatus,
  type ProjectedGovernanceDecision,
  type DecisionProvenance,
  RATIFICATION_ACTS,
  RATIFIABLE_ROOTS,
  ratifierCommitment,
  anchorStatusFromReceipt,
  resolveRatificationCandidate,
  recordRatification,
  attachPublication,
  listRatifications,
  getRatification,
  projectGovernanceDecisionLog,
  resolveDecision,
} from './governanceRatification';
