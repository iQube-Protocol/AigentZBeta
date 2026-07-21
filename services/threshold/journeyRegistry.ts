/**
 * journeyRegistry.ts — the metaMe Threshold Journey Registry (PRD-THR-001 §9).
 *
 * The USER-FACING layer above the (platform-facing) service registry. People do
 * not cross the Threshold to "access services" — they cross to pursue a goal.
 * Immediately after the Polity Passport is issued, the Threshold Companion asks
 * "What would you like to do first?" and presents FIVE constitutional journeys.
 * Each journey activates an Experience Guide, establishes a progressive
 * Sovereignty Ladder, and progressively unlocks services — all of which converge
 * on the Founder Office as the highest rung of sovereign participation.
 *
 * This is a view over EXISTING platform structure, not a new model:
 *   - each journey maps to an `AccessDomain` (services/passport/participationAccess.ts);
 *   - its ladder rungs ARE that domain's `DOMAIN_ROLES` (citizen → steward → …);
 *   - its `unlocks` are `ThresholdServiceId`s from the service registry.
 * The Journey Registry is the UX abstraction; the Service Registry is the
 * implementation abstraction (capability discovery, authorization, delegation
 * scopes, adapters, routing). The Companion narrates journeys; the gateway
 * enforces via services.
 *
 * PURE DATA + helpers (no I/O, no identifiers) — safe to expose read-only over
 * the unauthenticated MCP `metame://journeys` resource and `list_journeys` tool.
 */

import type { ThresholdServiceId } from './serviceRegistry';
import type { AccessDomain } from '@/services/passport/participationAccess';

export type JourneyId = 'citizen' | 'entrepreneur' | 'researcher' | 'creative' | 'technical';

export interface ConstitutionalJourney {
  id: JourneyId;
  title: string;
  /** The one-line "why you're joining" a Companion reads aloud. */
  goal: string;
  /** The Experience Guide this journey activates (first-class; owns progression). */
  experienceGuide: string;
  /** The existing participation domain this journey is a user-facing view of. */
  accessDomain: AccessDomain;
  /**
   * The progressive Sovereignty Ladder for this journey. Rungs are drawn from the
   * domain's roles and always converge on the Founder Office (the shared apex of
   * sovereign participation — not everyone starts there, but every journey climbs
   * toward it).
   */
  ladder: string[];
  /** Services this journey progressively unlocks (platform-facing registry ids). */
  unlocks: ThresholdServiceId[];
  /** Representative capabilities the Companion can describe before any request. */
  capabilities: string[];
}

/** Every journey ultimately converges here — the shared apex rung. */
export const FOUNDER_OFFICE_RUNG = 'Founder Office';

export const CONSTITUTIONAL_JOURNEYS: ConstitutionalJourney[] = [
  {
    id: 'citizen',
    title: 'Citizen',
    goal: 'Participate in the constitutional internet.',
    experienceGuide: 'citizen-experience-guide',
    accessDomain: 'passport',
    ladder: ['Citizen', 'Standing', 'Delegation', 'Steward', FOUNDER_OFFICE_RUNG],
    unlocks: ['polity-passport', 'founder-office'],
    capabilities: [
      'Polity Passport',
      'Sovereign locker',
      'QubeTalk',
      'Basic delegation',
      'Constitutional commerce',
      'Community participation',
    ],
  },
  {
    id: 'entrepreneur',
    title: 'Entrepreneur',
    goal: 'Build businesses on the constitutional internet.',
    experienceGuide: 'entrepreneur-experience-guide',
    accessDomain: 'venture-lab',
    ladder: ['Entrepreneur', 'Experience Builder', 'Business Operations', FOUNDER_OFFICE_RUNG],
    unlocks: ['metame-studio', 'founder-office'],
    capabilities: [
      'Experience Composer',
      'Venture programmes',
      'Constitutional Financial Services',
      'Payments',
      'Commerce',
      'Operations',
    ],
  },
  {
    id: 'researcher',
    title: 'Researcher',
    goal: 'Advance the Invariant Intelligence research programme.',
    experienceGuide: 'research-experience-guide',
    accessDomain: 'research-lab',
    ladder: ['Researcher', 'IRL', 'Publications', 'Steward Research', FOUNDER_OFFICE_RUNG],
    unlocks: ['irl', 'founder-office'],
    capabilities: [
      'Invariant Research Lab',
      'Shared research artifacts',
      'Experiments',
      'Receipted submissions',
      'Publications',
      'QubeTalk',
    ],
  },
  {
    id: 'creative',
    title: 'Creative',
    goal: 'Create, publish, and tell stories sovereignly.',
    experienceGuide: 'creative-experience-guide',
    accessDomain: 'metame-studio',
    ladder: ['Creative', 'Creative Studio', 'Publishing', 'metaKnyt', FOUNDER_OFFICE_RUNG],
    unlocks: ['metame-studio', 'founder-office'],
    capabilities: ['Studio', 'Storytelling', 'Media', 'Publishing', 'Commerce'],
  },
  {
    id: 'technical',
    title: 'Technical',
    goal: 'Build agents and constitutional software.',
    experienceGuide: 'technical-experience-guide',
    accessDomain: 'developer-studio',
    ladder: ['Developer', 'DevOn', 'AgentiQ Builder', 'Studio', FOUNDER_OFFICE_RUNG],
    unlocks: ['devon', 'agentiq-builder', 'metame-studio', 'founder-office'],
    capabilities: ['DevOn', 'AgentiQ Builder', 'Studio', 'Constitutional runtime', 'Receipted changes'],
  },
];

export function listJourneys(): ConstitutionalJourney[] {
  return CONSTITUTIONAL_JOURNEYS;
}

export function getJourney(id: string): ConstitutionalJourney | null {
  return CONSTITUTIONAL_JOURNEYS.find((j) => j.id === id) ?? null;
}

export function isJourneyId(v: string): v is JourneyId {
  return CONSTITUTIONAL_JOURNEYS.some((j) => j.id === v);
}

/** The machine-readable registry shape surfaced at `metame://journeys`. */
export function journeyRegistrySnapshot(): {
  journeys: Array<Pick<ConstitutionalJourney, 'id' | 'title' | 'goal' | 'experienceGuide' | 'ladder' | 'unlocks' | 'capabilities'>>;
  apex: string;
} {
  return {
    apex: FOUNDER_OFFICE_RUNG,
    journeys: CONSTITUTIONAL_JOURNEYS.map(({ id, title, goal, experienceGuide, ladder, unlocks, capabilities }) => ({
      id,
      title,
      goal,
      experienceGuide,
      ladder,
      unlocks,
      capabilities,
    })),
  };
}
