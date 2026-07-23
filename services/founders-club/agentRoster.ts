/**
 * Founders Club — 8-agent base roster registry.
 *
 * PRD-FDC-001 (Founders Club) §4.2 (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-fdc-001-founders-club.md`), built as Increment 2 of the
 * implementation plan (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-foi-001-implementation-plan.md`, §2 "Increment 2").
 *
 * Scope (deliberately narrow, per the implementation plan's own acceptance
 * bar for Increment 2): this is a REGISTRY, not each agent's full specialist
 * capability. "Community Concierge can name and route toward each of the 8
 * base-roster agents" is the bar — not "each of the 8 agents has a fully
 * built specialist capability."
 *
 * Deliberately EXCLUDED from this roster (Increment 3 / out of scope, per
 * PRD-FDC-001 §4.3/§4.4 and the implementation plan's own increment split):
 *   - Ecosystem Analyst, Community Steward, Journey Concierge, Knowledge
 *     Curator (the four genuinely-new Addendum-B agents)
 *   - Marketa's Market Awareness extension (she is a reused platform agent,
 *     not a Founders-Club-native roster entry)
 *
 * Source-of-truth discipline (`inv.engineering.036`/`037`): this module is
 * the ONE place the 8-agent roster is enumerated. The Community Concierge
 * shell (`components/foundersClub/CommunityConciergeLayer.tsx`) derives its
 * quick-prompt chips from `FOUNDERS_CLUB_AGENT_ROSTER` rather than
 * hand-duplicating agent names/labels.
 */

/** The 8-agent base roster's stable ids (PRD-FDC-001 §4.2's exact list). */
export type FoundersClubAgentId =
  | 'community-concierge'
  | 'opportunity-scout'
  | 'network-navigator'
  | 'founder-coach'
  | 'event-curator'
  | 'circle-facilitator'
  | 'recognition-steward'
  | 'introduction-broker';

/**
 * The ten named Addendum-B awareness domains (PRD-FDC-001 §4.2-§4.3) — only
 * the five owned by base-roster agents are represented as literal values
 * here, since the four Addendum-B-native domains (Ecosystem/Community/
 * Market/Knowledge/Travel Awareness) belong to agents out of this roster's
 * scope (Increment 3+).
 */
export type FoundersClubAwarenessDomain =
  | 'Founder Awareness'
  | 'Opportunity Awareness'
  | 'Relationship Awareness'
  | 'Wellbeing Awareness'
  | 'Standing Awareness';

export interface FoundersClubAgentRosterEntry {
  id: FoundersClubAgentId;
  /** Display name — exactly PRD-FDC-001 §4.2's own roster list, verbatim. */
  name: string;
  /** One-line function/description, per PRD-FDC-001 §4.2's roster table. */
  function: string;
  /**
   * Awareness domain owned (PRD-FDC-001 §4.2 table), or `null` for the three
   * base-roster agents that own no named domain today (Event Curator,
   * Circle Facilitator, Introduction Broker — PRD-FDC-001 §4.4: "this PRD
   * does not invent an eleventh/twelfth/thirteenth domain to force a fit").
   * Do NOT assert a domain for these three — it would silently contradict
   * the ratified PRD.
   */
  awarenessDomain: FoundersClubAwarenessDomain | null;
  /** True only for Community Concierge — the Club's sole visible orchestrator
   *  (PRD-FDC-001 §4.1, §9.1 principle 12). */
  isOrchestrator: boolean;
  /**
   * Short chip label for the Community Concierge shell's quick-prompt strip
   * — derived here so the shell never hand-duplicates the agent's name.
   */
  chipLabel: string;
}

/**
 * The reconciled 8-agent base roster (PRD-FDC-001 §4.2), in the operator's
 * own order. Community Concierge is listed first as the sole orchestrator;
 * the remaining seven are the specialists it routes to.
 */
export const FOUNDERS_CLUB_AGENT_ROSTER: FoundersClubAgentRosterEntry[] = [
  {
    id: 'community-concierge',
    name: 'Community Concierge',
    function:
      'The sole visible orchestrator of the Club (PRD-FDC-001 §0.3/§4.1). Founders interact ' +
      'with the Concierge, never directly with a specialist picker; routing to specialists ' +
      'happens behind this one face.',
    awarenessDomain: 'Founder Awareness',
    isOrchestrator: true,
    chipLabel: 'Talk to Concierge',
  },
  {
    id: 'opportunity-scout',
    name: 'Opportunity Scout',
    function: 'Surfaces opportunities/matches for a founder from the Commons signal stream.',
    awarenessDomain: 'Opportunity Awareness',
    isOrchestrator: false,
    chipLabel: 'Find opportunities',
  },
  {
    id: 'network-navigator',
    name: 'Network Navigator',
    function: 'Manages introduction strategy and relationship-graph traversal — decides WHO should connect.',
    awarenessDomain: 'Relationship Awareness',
    isOrchestrator: false,
    chipLabel: 'Plan an introduction',
  },
  {
    id: 'founder-coach',
    name: 'Founder Coach',
    function: 'Founder wellbeing / pacing / burnout-risk check-ins.',
    awarenessDomain: 'Wellbeing Awareness',
    isOrchestrator: false,
    chipLabel: 'Check in on wellbeing',
  },
  {
    id: 'event-curator',
    name: 'Event Curator',
    function:
      'Curates community events/gatherings (digital-first: AMAs, office hours, roundtables; ' +
      'physical events from Phase 3). Decides "you should go" — permanently separate from ' +
      'Journey Concierge, which helps founders get there (PRD-FDC-001 §4.3b).',
    awarenessDomain: null,
    isOrchestrator: false,
    chipLabel: 'Find an event',
  },
  {
    id: 'circle-facilitator',
    name: 'Circle Facilitator',
    function: 'Facilitates founder peer circles / small-group cohorts.',
    awarenessDomain: null,
    isOrchestrator: false,
    chipLabel: 'Join a circle',
  },
  {
    id: 'recognition-steward',
    name: 'Recognition Steward',
    function: 'Surfaces and narrates standing/verification events back to the founder.',
    awarenessDomain: 'Standing Awareness',
    isOrchestrator: false,
    chipLabel: 'My standing',
  },
  {
    id: 'introduction-broker',
    name: 'Introduction Broker',
    function:
      'Executes the specific introductions Network Navigator\'s strategy identifies — the ' +
      '"make the connection happen" agent. Leverages the existing Relationship Builder ' +
      'capability (Marketa\'s cartridge) rather than parallel outreach machinery ' +
      '(PRD-FDC-001 §4.2).',
    awarenessDomain: null,
    isOrchestrator: false,
    chipLabel: 'Make an introduction',
  },
];

/** Lookup by id — the canonical accessor other modules should use instead of
 *  re-filtering `FOUNDERS_CLUB_AGENT_ROSTER` inline. */
export function getFoundersClubAgent(
  id: FoundersClubAgentId,
): FoundersClubAgentRosterEntry | undefined {
  return FOUNDERS_CLUB_AGENT_ROSTER.find((a) => a.id === id);
}

/** The roster minus the orchestrator itself — the specialists Community
 *  Concierge routes to. Convenience for the shell's quick-prompt strip. */
export function foundersClubSpecialists(): FoundersClubAgentRosterEntry[] {
  return FOUNDERS_CLUB_AGENT_ROSTER.filter((a) => !a.isOrchestrator);
}
