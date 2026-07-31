/**
 * serviceRegistry.ts — metaMe Threshold service registry (PRD-THR-001 §9).
 *
 * After a principal crosses the Threshold, their Threshold Companion (the user's
 * existing agent) inspects this registry instead of being shown a platform menu.
 * Each service declares the capability scope a crossing must request before the
 * Companion may enter it. `polity-passport` is the constitutional root (the
 * front door itself); every other service is reached AFTER the crossing and
 * consumes the same constitutional persona — none re-implements onboarding.
 *
 * This module is PURE DATA + helpers (no I/O, no identifiers) so it is safe to
 * expose read-only over the (unauthenticated) MCP `metame://services` resource
 * and the `list_services` tool. Eligibility that depends on the principal's
 * grants is resolved later, during/after the Constitutional Handshake.
 */

export type ThresholdServiceId =
  | 'polity-passport'
  | 'irl'
  | 'devon'
  | 'founder-office'
  | 'metame-studio'
  | 'agentiq-builder';

export interface ThresholdService {
  id: ThresholdServiceId;
  title: string;
  /** 'constitutional-root' is the Passport itself; others are post-crossing services. */
  role: 'constitutional-root' | 'service';
  status: 'active' | 'preview' | 'planned';
  /** Capability scopes a crossing must request before the Companion may enter. */
  requiredCapabilities: string[];
  /** One-line description the Companion can read aloud to its principal. */
  summary: string;
}

export const THRESHOLD_SERVICES: ThresholdService[] = [
  {
    id: 'polity-passport',
    title: 'Polity Passport',
    role: 'constitutional-root',
    status: 'active',
    requiredCapabilities: [],
    summary:
      'The constitutional front door. Establishes personhood-bound continuity for the principal and a bounded, revocable delegation to the agent — with no public identity exposure.',
  },
  {
    id: 'irl',
    title: 'Invariant Research Lab (IRL)',
    role: 'service',
    status: 'active',
    requiredCapabilities: ['research.read', 'research.submit', 'qubetalk.send'],
    summary:
      'Join as an external reviewer or participant: read shared research artifacts, run assigned experiments, submit receipted results, and exchange over QubeTalk.',
  },
  {
    id: 'devon',
    title: 'DevOn — Development Studio',
    role: 'service',
    status: 'preview',
    requiredCapabilities: ['code.read', 'proposal.create', 'receipt.review'],
    summary:
      'Bring your development agent into a constitutional runtime: read shared code, create proposals, and review receipted changes.',
  },
  {
    id: 'founder-office',
    title: 'Founder Office',
    role: 'service',
    status: 'preview',
    requiredCapabilities: ['workspace.read', 'workspace.act'],
    summary: 'The operator workspace — brief, decide, and move ventures forward through your agent.',
  },
  {
    id: 'metame-studio',
    title: 'metaMe Studio',
    role: 'service',
    status: 'planned',
    requiredCapabilities: ['studio.compose'],
    summary: 'Compose and publish constitutional artifacts.',
  },
  {
    id: 'agentiq-builder',
    title: 'AgentiQ Builder',
    role: 'service',
    status: 'planned',
    requiredCapabilities: ['agentiq.build'],
    summary: 'Build and register agent capabilities.',
  },
];

export function listServices(): ThresholdService[] {
  return THRESHOLD_SERVICES;
}

/** The union of every capability any service can require — the ONLY vocabulary a
 *  crossing may request. Requested scopes outside this set are dropped before a
 *  bearer is ever minted, so a client cannot fabricate arbitrary scope strings. */
export function knownCapabilities(): Set<string> {
  const all = new Set<string>();
  for (const s of THRESHOLD_SERVICES) for (const c of s.requiredCapabilities) all.add(c);
  return all;
}

/**
 * Constitutional-root capabilities (PRD-THR-001 §9 / passport-first re-sequencing).
 *
 * These are what a BASE crossing grants — constitutional *navigation* authority,
 * NOT service-operating authority. They let the bound agent orient the principal
 * after crossing (read status, list/select journeys, prepare delegation requests)
 * but permit NO substantive service action: no reading/submitting research, no
 * DevOn, no workspace, no Studio, no peer messaging, no money movement. Crossing
 * the Threshold, choosing a journey, and entering a service are three separate
 * constitutional events; only the third grants service capabilities.
 *
 * Passport ≠ delegation: the Passport establishes the principal; this minimal
 * root delegation authorizes the agent to navigate on the principal's behalf.
 */
export const CONSTITUTIONAL_ROOT_CAPABILITIES = [
  'passport.status.read',
  'crossing.status.read',
  'journeys.list',
  'journey.select',
  'delegation.propose',
  'delegation.status.read',
  'services.list',
  'agent-card.self.read',
  'agent-passport.self.read',
] as const;

/**
 * The capabilities a crossing to `serviceId` may grant: always the constitutional
 * root set, PLUS that service's required capabilities ONLY for a service-initiated
 * crossing. A base crossing (`polity-passport`, the constitutional root itself)
 * therefore grants root navigation authority and nothing more — service authority
 * is added only when the crossing's stated purpose IS that service.
 */
export function grantableCapabilities(serviceId?: string | null): Set<string> {
  const caps = new Set<string>(CONSTITUTIONAL_ROOT_CAPABILITIES);
  const svc = serviceId ? getService(serviceId) : null;
  if (svc && svc.id !== 'polity-passport') for (const c of svc.requiredCapabilities) caps.add(c);
  return caps;
}

export function getService(id: string): ThresholdService | null {
  return THRESHOLD_SERVICES.find((s) => s.id === id) ?? null;
}

/** The machine-readable registry shape surfaced at `metame://services`. */
export function serviceRegistrySnapshot(): { services: Array<Pick<ThresholdService, 'id' | 'status' | 'role' | 'requiredCapabilities' | 'title' | 'summary'>> } {
  return {
    services: THRESHOLD_SERVICES.map(({ id, status, role, requiredCapabilities, title, summary }) => ({
      id,
      status,
      role,
      requiredCapabilities,
      title,
      summary,
    })),
  };
}
