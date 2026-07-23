/**
 * Founders Club — 8-agent roster + Phase 1 matching heuristic canary.
 *
 * PRD-FDC-001 (Founders Club) §4.2/§5, built as Increment 2 of the
 * implementation plan (`codexes/packs/agentiq/updates/
 * 2026-07-22_prd-foi-001-implementation-plan.md`).
 *
 * Verifies, per this session's own required acceptance bar:
 *   1. The roster registry has exactly 8 entries with the exact names PRD-
 *      FDC-001 §4.2 lists (no silent drift from that ratified list).
 *   2. The three no-named-domain agents (Event Curator, Circle Facilitator,
 *      Introduction Broker) are represented accurately — `awarenessDomain
 *      === null` — never asserting a domain PRD-FDC-001 does not name.
 *   3. `computeFoundersClubMatch`'s rationale string is always non-empty,
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

const RATIFIED_ROSTER_NAMES = [
  'Community Concierge',
  'Opportunity Scout',
  'Network Navigator',
  'Founder Coach',
  'Event Curator',
  'Circle Facilitator',
  'Recognition Steward',
  'Introduction Broker',
];

const NO_NAMED_DOMAIN_AGENT_IDS: FoundersClubAgentId[] = [
  'event-curator',
  'circle-facilitator',
  'introduction-broker',
];

describe('Founders Club agent roster (PRD-FDC-001 §4.2)', () => {
  it('has exactly 8 entries', () => {
    expect(FOUNDERS_CLUB_AGENT_ROSTER).toHaveLength(8);
  });

  it('matches the ratified 8-agent base roster names exactly, no more, no fewer', () => {
    const names = FOUNDERS_CLUB_AGENT_ROSTER.map((a) => a.name).sort();
    expect(names).toEqual([...RATIFIED_ROSTER_NAMES].sort());
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

  it('assigns a named awareness domain to the five base-roster agents that own one', () => {
    const withDomain = FOUNDERS_CLUB_AGENT_ROSTER.filter(
      (a) => !NO_NAMED_DOMAIN_AGENT_IDS.includes(a.id),
    );
    expect(withDomain).toHaveLength(5);
    for (const agent of withDomain) {
      expect(agent.awarenessDomain).not.toBeNull();
      expect(typeof agent.awarenessDomain).toBe('string');
    }
  });

  it('foundersClubSpecialists() excludes only the orchestrator', () => {
    const specialists = foundersClubSpecialists();
    expect(specialists).toHaveLength(7);
    expect(specialists.some((a) => a.id === 'community-concierge')).toBe(false);
  });

  it('getFoundersClubAgent returns undefined for an unknown id (no silent fallback)', () => {
    expect(getFoundersClubAgent('not-a-real-agent' as FoundersClubAgentId)).toBeUndefined();
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
