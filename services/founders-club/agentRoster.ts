/**
 * Founders Club — full agent roster registry (8-agent base roster +
 * Increment 3's Addendum-B additions).
 *
 * PRD-FDC-001 (Founders Club) §4.2/§4.3/§4.3a/§4.3c/§4.4/§4.4a
 * (`codexes/packs/agentiq/updates/2026-07-22_prd-fdc-001-founders-club.md`).
 * The original 8-agent base roster was built as Increment 2 of the
 * implementation plan (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-foi-001-implementation-plan.md`, §2 "Increment 2"). This
 * module now also carries Increment 3's roster additions (§2 "Increment 3"
 * of the same plan): Ecosystem Analyst, Community Steward, Knowledge
 * Curator (three genuinely-new Addendum-B agents), and Marketa's Market
 * Awareness extension (a reused platform agent, not a new one — §4.3a).
 *
 * Scope (deliberately narrow, per the implementation plan's own acceptance
 * bar for both increments): this is a REGISTRY, not each agent's full
 * specialist capability. "Community Concierge can name and route toward
 * each roster agent" is the bar — not "each agent has a fully built
 * specialist capability." Increment 3's four new entries are registry rows
 * + stub routing only (mirroring Increment 2's own stub-routing agents) —
 * none of Ecosystem Analyst's named internal/external input sources (§4.3c)
 * are actually wired to live data by this module, and Marketa's entry reads
 * nothing new — it only documents her existing Market Awareness role.
 *
 * Deliberately EXCLUDED from this roster (Phase-3-gated, out of scope for
 * every increment through Increment 3, per PRD-FDC-001 §4.3b/§10 and the
 * implementation plan's own scope table):
 *   - Journey Concierge (Travel Awareness) — no physical-event referent
 *     exists yet; explicitly not built, wired, or stubbed here.
 *
 * Source-of-truth discipline (`inv.engineering.036`/`037`): this module is
 * the ONE place the full roster is enumerated. The Community Concierge
 * shell (`components/foundersClub/CommunityConciergeLayer.tsx`) derives its
 * quick-prompt chips from `FOUNDERS_CLUB_AGENT_ROSTER` rather than
 * hand-duplicating agent names/labels.
 */

/** The full roster's stable ids — the original 8-agent base roster
 *  (PRD-FDC-001 §4.2's exact list) plus Increment 3's four additions
 *  (§4.3/§4.3a/§4.3c). Journey Concierge is deliberately absent (see module
 *  doc — Phase-3-gated, not part of this roster). */
export type FoundersClubAgentId =
  | 'community-concierge'
  | 'opportunity-scout'
  | 'network-navigator'
  | 'founder-coach'
  | 'event-curator'
  | 'circle-facilitator'
  | 'recognition-steward'
  | 'introduction-broker'
  | 'ecosystem-analyst'
  | 'community-steward'
  | 'knowledge-curator'
  | 'marketa';

/**
 * The named Addendum-B awareness domains (PRD-FDC-001 §4.2-§4.3) this
 * roster's agents own. Travel Awareness (Journey Concierge's domain) is
 * deliberately absent — that agent is out of scope for this roster (module
 * doc).
 */
export type FoundersClubAwarenessDomain =
  | 'Founder Awareness'
  | 'Opportunity Awareness'
  | 'Relationship Awareness'
  | 'Wellbeing Awareness'
  | 'Standing Awareness'
  | 'Ecosystem Awareness'
  | 'Community Awareness'
  | 'Knowledge Awareness'
  | 'Market Awareness';

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
  /**
   * True only for a roster entry that is NOT a new Founders-Club-native
   * agent but an existing platform agent extended into the Club (PRD-
   * FDC-001 §4.3a — Marketa's Market Awareness extension is the only entry
   * with this flag today). Omitted/false for every native roster agent.
   */
  isReusedPlatformAgent?: boolean;
  /**
   * When `isReusedPlatformAgent` is true, the existing `app/data/
   * personas.ts` persona key this entry represents — e.g. `'aigent-marketa'`
   * for Marketa. Never a new/duplicate persona; this field only documents
   * which existing persona the Club reuses.
   */
  reusedPersonaId?: string;
}

/**
 * The reconciled full roster (PRD-FDC-001 §4.2/§4.3/§4.3a/§4.3c), in the
 * operator's own order. Community Concierge is listed first as the sole
 * orchestrator; the remaining eleven are the specialists it routes to — the
 * original seven base-roster specialists (Increment 2) plus Increment 3's
 * four additions (Ecosystem Analyst, Community Steward, Knowledge Curator,
 * Marketa's Market Awareness extension).
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
  {
    id: 'ecosystem-analyst',
    name: 'Ecosystem Analyst',
    function:
      'Constitutional ecosystem awareness — not mere feed collection (PRD-FDC-001 §4.3c). ' +
      'Named inputs: internal (Founder Office, Standing graph, Venture graph, Founders Club ' +
      'graph, Portfolio graph, Experience graph) and external (accelerator ecosystems, ' +
      'conference calendars, grant databases, research institutions, VC activity, government ' +
      'innovation programmes, standards bodies, startup communities, partner ecosystems). No ' +
      'live ingestion of any of these sources is wired by this registry entry — Increment 3\'s ' +
      'acceptance bar is a routable roster row + stub chip, not a data pipeline.',
    awarenessDomain: 'Ecosystem Awareness',
    isOrchestrator: false,
    chipLabel: 'Ecosystem awareness',
  },
  {
    id: 'community-steward',
    name: 'Community Steward',
    function:
      'Observes the Club\'s own health, including the agent-first ratio the staff-exception-' +
      'as-receipt mechanism tracks (PRD-FDC-001 §3, §4.3). Registry entry + stub routing only ' +
      'in this increment — no live agent-first-ratio computation is wired yet.',
    awarenessDomain: 'Community Awareness',
    isOrchestrator: false,
    chipLabel: 'Community health',
  },
  {
    id: 'knowledge-curator',
    name: 'Knowledge Curator',
    function:
      'The Club\'s institutional-memory agent (PRD-FDC-001 §4.3). Registry entry + stub ' +
      'routing only in this increment — no institutional-memory store/retrieval pipeline is ' +
      'wired yet.',
    awarenessDomain: 'Knowledge Awareness',
    isOrchestrator: false,
    chipLabel: 'Club knowledge',
  },
  {
    id: 'marketa',
    name: 'Marketa',
    function:
      'The platform\'s existing constitutional marketing agent (`aigent-marketa`), extended ' +
      'into the Founders Club as its Market Awareness owner (PRD-FDC-001 §4.3a) — reused, not ' +
      'a new agent. Inside the Club she is an intelligence PROVIDER Community Concierge and ' +
      'its specialists consult, never the Club\'s orchestrator (§4.4a: "Marketa is not the ' +
      'orchestrator — she stays exactly where she is"). Her existing surfaces ' +
      '(`MarketaCampaignDashboardTab`, `MarketaActivationEngineTab`) are the source Market ' +
      'Awareness reads from — no second campaign/partner-intelligence UI is built here.',
    awarenessDomain: 'Market Awareness',
    isOrchestrator: false,
    chipLabel: 'Market intelligence',
    isReusedPlatformAgent: true,
    reusedPersonaId: 'aigent-marketa',
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
 *  Concierge routes to (the 7 original base-roster specialists plus
 *  Increment 3's 4 additions = 11 today). Convenience for the shell's
 *  quick-prompt strip. */
export function foundersClubSpecialists(): FoundersClubAgentRosterEntry[] {
  return FOUNDERS_CLUB_AGENT_ROSTER.filter((a) => !a.isOrchestrator);
}
