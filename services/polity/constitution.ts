/**
 * Polity Core — constitutional source of legitimacy (machine-readable).
 *
 * This is the single typed accessor over the ratified constitutional
 * frameworks that govern autonomous agents. Option A (autonomous agent
 * deployment) enforcement MUST read its rules from here rather than
 * hard-coding constants, so that every Agent Passport binds to an explicit,
 * versioned constitution / charter / delegation framework and a constitutional
 * mismatch is detectable.
 *
 * Authority may be delegated. Sovereignty may not. The chain of legitimacy is
 * Polity → Citizen → Delegation → Agent. An agent exercises delegated
 * authority but never creates new authority.
 *
 * Human-readable counterparts live in codexes/packs/polity-core/items/*.md and
 * are surfaced by the Polity Core cartridge.
 */

import constitutionV1 from './frameworks/constitution.v1.json';
import agentCharterV1 from './frameworks/agent-charter.v1.json';
import delegationFrameworkV1 from './frameworks/delegation-framework.v1.json';
import autodriveCids from './frameworks/autodrive-cids.json';

export type RevocationState =
  | 'active'
  | 'paused'
  | 'suspended'
  | 'revoked'
  | 'quarantined'
  | 'destroyed';

export const AGENT_IDENTITY_CLASS = 'ADID' as const;

/** The current ratified versions an Agent Passport must bind to. */
export const CURRENT_CONSTITUTIONAL_VERSIONS = {
  constitutionVersion: constitutionV1.version,
  agentCharterVersion: agentCharterV1.version,
  delegationFrameworkVersion: delegationFrameworkV1.version,
} as const;

export const REVOCATION_STATES = agentCharterV1.revocation.states as RevocationState[];
export const TERMINAL_REVOCATION_STATES =
  agentCharterV1.revocation.terminalStates as RevocationState[];

export function getConstitution() {
  return constitutionV1;
}
export function getAgentCharter() {
  return agentCharterV1;
}
export function getDelegationFramework() {
  return delegationFrameworkV1;
}

/**
 * Autodrive (Autonomys) CID records proving content-addressed immutability of
 * the published frameworks. Empty until `scripts/publish-polity-core.mjs` runs.
 */
export function getAutodriveImmutability() {
  return autodriveCids;
}

/** The full machine-readable framework bundle (served by the API route). */
export function getConstitutionalFramework() {
  return {
    currentVersions: CURRENT_CONSTITUTIONAL_VERSIONS,
    constitution: constitutionV1,
    agentCharter: agentCharterV1,
    delegationFramework: delegationFrameworkV1,
    autodrive: autodriveCids,
  };
}

/**
 * The constitutional binding an Agent Passport must embed at issuance
 * (Constitution / Agent Charter / Delegation Framework versions). Sponsor
 * identity + revocation authority are supplied by the caller at issuance time.
 */
export function getAgentPassportBinding() {
  return { ...CURRENT_CONSTITUTIONAL_VERSIONS };
}

/**
 * Returns true when an Agent Passport's embedded versions match the current
 * ratified versions. A mismatch must trigger automatic suspension
 * (agentCharter.constitutionalBinding.onMismatch).
 */
export function isConstitutionallyCurrent(binding: {
  constitutionVersion?: string;
  agentCharterVersion?: string;
  delegationFrameworkVersion?: string;
} | null | undefined): boolean {
  if (!binding) return false;
  return (
    binding.constitutionVersion === CURRENT_CONSTITUTIONAL_VERSIONS.constitutionVersion &&
    binding.agentCharterVersion === CURRENT_CONSTITUTIONAL_VERSIONS.agentCharterVersion &&
    binding.delegationFrameworkVersion ===
      CURRENT_CONSTITUTIONAL_VERSIONS.delegationFrameworkVersion
  );
}

export interface AgentClassConstraintInput {
  hasKybeDid?: boolean;
  passportClass?: string | null;
  isHuman?: boolean;
}

/**
 * Enforces the Phase-1 ADID invariants on a prospective autonomous agent:
 * no kybe DID, never human, never a citizen passport. Returns the list of
 * violations (empty = compliant). Option A deployment must reject any
 * non-empty result.
 */
export function checkAgentClassConstraints(input: AgentClassConstraintInput): string[] {
  const violations: string[] = [];
  if (input.hasKybeDid) violations.push('agent_must_not_have_kybe_did');
  if (input.isHuman) violations.push('agent_must_not_present_as_human');
  if (input.passportClass === 'citizen') violations.push('agent_cannot_hold_citizen_passport');
  return violations;
}
