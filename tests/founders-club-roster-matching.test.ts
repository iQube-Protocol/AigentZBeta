/**
 * Founders Club — full 12-agent roster + Phase 1 matching heuristic canary.
 *
 * PRD-FDC-001 (Founders Club) §4.2/§4.3/§4.3a/§4.3c/§5, built as Increment 2
 * (8-agent base roster) and Increment 3 (Ecosystem Analyst, Community
 * Steward, Knowledge Curator, Marketa's Market Awareness extension) of the
 * implementation plan (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-foi-001-implementation-plan.md`).
 *
 * Verifies, per this session's own required acceptance bar:
 *   1. The roster registry has exactly 12 entries (8 base + 4 Increment 3
 *      additions) with the exact names PRD-FDC-001 §4.2/§4.3 lists (no
 *      silent drift from that ratified list).
 *   2. The three no-named-domain base-roster agents (Event Curator, Circle
 *      Facilitator, Introduction Broker) are represented accurately —
 *      `awarenessDomain === null` — never asserting a domain PRD-FDC-001
 *      does not name.
 *   3. Every other agent (the five base-roster domain-owners plus
 *      Increment 3's four new domain-owners) carries a non-null named
 *      awareness domain.
 *   4. Marketa's entry is flagged as a reused platform agent (not a new
 *      one) referencing the existing `aigent-marketa` persona — never a
 *      duplicate persona.
 *   5. Journey Concierge is absent from the roster — it remains Phase-3-
 *      gated and out of scope for Increment 3 (PRD-FDC-001 §4.3b/§10).
 *   6. `computeFoundersClubMatch`'s rationale string is always non-empty,
 *      whether or not any signal actually contributed to the score
 *      (PRD-FDC-001 §5's mandatory explainability requirement).
 */

import { describe, it, expect } from 'vitest';
import {
  FOUNDERS_CLUB_AGENT_ROSTER,
  getFoundersClubAgent,
  foundersClubSpecialists,
  type FoundersClubAgentId,
} from '../services/founders-club/agentRoster';
import {
  computeFoundersClubMatch,
  type FoundersClubMatchCandidate,
} from '../services/founders-club/matchingHeuristic';

const RATIFIED_BASE_ROSTER_NAMES = [
  'Community Concierge',
  'Opportunity Scout',
  'Network Navigator',
  'Founder Coach',
  'Event Curator',
  'Circle Facilitator',
  'Recognition Steward',
  'Introduction Broker',
];

const RATIFIED_INCREMENT_3_AGENT_NAMES = [
  'Ecosystem Analyst',
  'Community Steward',
  'Knowledge Curator',
  'Marketa',
];

const NO_NAMED_DOMAIN_AGENT_IDS: FoundersClubAgentId[] = [
  'event-curator',
  'circle-facilitator',
  'introduction-broker',
];

describe('Founders Club agent roster (PRD-FDC-001 §4.2/§4.3)', () => {
  it('has exactly 12 entries (8 base-roster + 4 Increment 3 additions)', () => {
    expect(FOUNDERS_CLUB_AGENT_ROSTER).toHaveLength(12);
  });

  it('matches the ratified 12-agent roster names exactly, no more, no fewer', () => {
    const names = FOUNDERS_CLUB_AGENT_ROSTER.map((a) => a.name).sort();
    const expected = [...RATIFIED_BASE_ROSTER_NAMES, ...RATIFIED_INCREMENT_3_AGENT_NAMES].sort();
    expect(names).toEqual(expected);
  });

  it('has ids that are unique', () => {
    const ids = FOUNDERS_CLUB_AGENT_ROSTER.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks Community Concierge as the sole orchestrator', () => {
    const orchestrators = FOUNDERS_CLUB_AGENT_ROSTER.filter((a) => a.isOrchestrator);
    expect(orchestrators).toHaveLength(1);
    expect(orchestrators[0].id).toBe('community-concierge');
  });

  it('does not assert an awareness domain for the three agents PRD-FDC-001 names as owning none', () => {
    for (const id of NO_NAMED_DOMAIN_AGENT_IDS) {
      const agent = getFoundersClubAgent(id);
      expect(agent).toBeDefined();
      expect(agent?.awarenessDomain).toBeNull();
    }
  });

  it('assigns a named awareness domain to every other agent (5 base-roster + 4 Increment 3 domain-owners = 9)', () => {
    const withDomain = FOUNDERS_CLUB_AGENT_ROSTER.filter(
      (a) => !NO_NAMED_DOMAIN_AGENT_IDS.includes(a.id),
    );
    expect(withDomain).toHaveLength(9);
    for (const agent of withDomain) {
      expect(agent.awarenessDomain).not.toBeNull();
      expect(typeof agent.awarenessDomain).toBe('string');
    }
  });

  it('foundersClubSpecialists() excludes only the orchestrator', () => {
    const specialists = foundersClubSpecialists();
    expect(specialists).toHaveLength(11);
    expect(specialists.some((a) => a.id === 'community-concierge')).toBe(false);
  });

  it('getFoundersClubAgent returns undefined for an unknown id (no silent fallback)', () => {
    expect(getFoundersClubAgent('not-a-real-agent' as FoundersClubAgentId)).toBeUndefined();
  });

  it('registers Increment 3\'s three genuinely-new agents with their named awareness domains', () => {
    const ecosystemAnalyst = getFoundersClubAgent('ecosystem-analyst');
    const communitySteward = getFoundersClubAgent('community-steward');
    const knowledgeCurator = getFoundersClubAgent('knowledge-curator');

    expect(ecosystemAnalyst?.awarenessDomain).toBe('Ecosystem Awareness');
    expect(communitySteward?.awarenessDomain).toBe('Community Awareness');
    expect(knowledgeCurator?.awarenessDomain).toBe('Knowledge Awareness');

    for (const agent of [ecosystemAnalyst, communitySteward, knowledgeCurator]) {
      expect(agent?.isReusedPlatformAgent).toBeFalsy();
      expect(agent?.reusedPersonaId).toBeUndefined();
    }
  });

  it('flags Marketa as a reused platform agent referencing the existing aigent-marketa persona, not a new one', () => {
    const marketa = getFoundersClubAgent('marketa');
    expect(marketa).toBeDefined();
    expect(marketa?.awarenessDomain).toBe('Market Awareness');
    expect(marketa?.isReusedPlatformAgent).toBe(true);
    expect(marketa?.reusedPersonaId).toBe('aigent-marketa');
    expect(marketa?.isOrchestrator).toBe(false);
  });

  it('does not include Journey Concierge — Phase-3-gated, explicitly out of scope through Increment 3 (PRD-FDC-001 §4.3b/§10)', () => {
    expect(FOUNDERS_CLUB_AGENT_ROSTER.some((a) => a.name === 'Journey Concierge')).toBe(false);
    expect(
      FOUNDERS_CLUB_AGENT_ROSTER.some((a) => (a.id as string) === 'journey-concierge'),
    ).toBe(false);
  });
});

describe('Founders Club Phase 1 interim matching heuristic (PRD-FDC-001 §5)', () => {
  const wellAlignedA: FoundersClubMatchCandidate = {
    ventureStage: 'formation',
    industryTags: ['fintech', 'climate'],
    geographicScope: 'Bay Area',
    activeActionModes: ['Build', 'Research'],
    standingScore: 72,
    currentObjectives: ['raise a seed round', 'ship v1'],
  };
  const wellAlignedB: FoundersClubMatchCandidate = {
    ventureStage: 'formation',
    industryTags: ['fintech', 'logistics'],
    geographicScope: 'bay area', // case-insensitive match
    activeActionModes: ['Build'],
    standingScore: 68,
    currentObjectives: ['raise a seed round'],
  };
  const misalignedC: FoundersClubMatchCandidate = {
    ventureStage: 'scale',
    industryTags: ['media'],
    geographicScope: 'Berlin',
    activeActionModes: ['Safeguard'],
    standingScore: 5,
    currentObjectives: ['exit planning'],
  };

  it('produces a non-empty explainability rationale when signals contribute', () => {
    const result = computeFoundersClubMatch(wellAlignedA, wellAlignedB);
    expect(result.score).toBeGreaterThan(0);
    expect(result.rationale).toBeTruthy();
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.rationale).toMatch(/^I matched you because/);
    expect(result.contributions.length).toBeGreaterThan(0);
  });

  it('produces a non-empty rationale even when nothing meaningfully overlaps', () => {
    const result = computeFoundersClubMatch(wellAlignedA, misalignedC);
    expect(result.rationale).toBeTruthy();
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('cites at least one of the nine named signals verbatim in the rationale detail set', () => {
    const result = computeFoundersClubMatch(wellAlignedA, wellAlignedB);
    const namedSignals = [
      'ventureStage',
      'industryDomain',
      'geography',
      'currentActionModes',
      'standing',
      'currentObjectives',
      'activeChallenges',
      'sharedInterests',
      'constitutionalCompatibility',
    ];
    expect(result.contributions.length).toBeGreaterThan(0);
    for (const c of result.contributions) {
      expect(namedSignals).toContain(c.signal);
    }
  });

  it('never fabricates activeChallenges/sharedInterests when the caller omits them', () => {
    const result = computeFoundersClubMatch(wellAlignedA, wellAlignedB);
    expect(result.contributions.some((c) => c.signal === 'activeChallenges')).toBe(false);
    expect(result.contributions.some((c) => c.signal === 'sharedInterests')).toBe(false);
  });

  it('scores activeChallenges/sharedInterests only when the caller explicitly supplies both sides', () => {
    const withExtras: FoundersClubMatchCandidate = {
      ...wellAlignedA,
      activeChallenges: ['hiring a technical co-founder'],
      sharedInterests: ['climate tech'],
    };
    const otherWithExtras: FoundersClubMatchCandidate = {
      ...wellAlignedB,
      activeChallenges: ['hiring a technical co-founder'],
      sharedInterests: ['climate tech'],
    };
    const result = computeFoundersClubMatch(withExtras, otherWithExtras);
    expect(result.contributions.some((c) => c.signal === 'activeChallenges')).toBe(true);
    expect(result.contributions.some((c) => c.signal === 'sharedInterests')).toBe(true);
  });

  it('labels constitutionalCompatibility as an explicit Phase 1 proxy, never the ratified engine', () => {
    const result = computeFoundersClubMatch(wellAlignedA, wellAlignedB);
    const proxyContribution = result.contributions.find(
      (c) => c.signal === 'constitutionalCompatibility',
    );
    expect(proxyContribution).toBeDefined();
    expect(proxyContribution?.detail).toMatch(/Phase 1 proxy/);
  });

  it('keeps the composite score clamped to 0..100', () => {
    const result = computeFoundersClubMatch(wellAlignedA, wellAlignedB);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
