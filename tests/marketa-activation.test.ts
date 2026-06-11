import { describe, expect, it } from 'vitest';

import { classifyCandidate, classifyHumanMobility, classifyLegalTrack, classifyMobilitySpine } from '@/services/marketa/activation/classification';
import { cleanRevenueScreen } from '@/services/marketa/activation/policy';
import { scoreCandidate } from '@/services/marketa/activation/scoring';

const execMobilityCandidate = {
  name: 'Executive Mobility Agent',
  description: 'Supports senior executive relocation, visa tracking, corporate housing coordination, renewal reminders, and jurisdiction comparison.',
  capabilities: ['executive relocation', 'visa tracking', 'corporate housing', 'renewal tracking'],
  targetUsers: ['corporate mobility teams', 'general counsel'],
};

const vulnerableMobilityCandidate = {
  name: 'Stateless Citizen Navigator',
  description: 'Provides lawful presence orientation, shelter routing, document checklist preparation, aid routing, and licensed partner escalation for refugees.',
  capabilities: ['lawful presence orientation', 'housing workflow', 'document checklist', 'licensed partner escalation'],
  targetUsers: ['stateless citizens', 'refugees', 'legal clinics'],
};

const legalOpsCandidate = {
  name: 'GC Ops Agent',
  description: 'Legal ops and contract workflow assistant for general counsel, law firms, due diligence, compliance tracking, and outside counsel coordination.',
  capabilities: ['contract workflow', 'matter intake', 'regulatory watch'],
  targetUsers: ['general counsel', 'law firms'],
  agentCardUrl: 'https://example.com/agent-card.json',
  mcpServerUrl: 'https://example.com/mcp',
  operatorName: 'Example LegalTech Co',
};

describe('Marketa Activation Engine classifiers', () => {
  it('classifies Exec mobility as the user-facing top-reference mobility tag', () => {
    const mobility = classifyMobilitySpine(execMobilityCandidate);
    expect(mobility.supportsExecMobility).toBe(true);
    expect(mobility.mobilityReferenceTag).toBe('exec_mobility');
    expect(mobility.sharedProcessSpine).toContain('renewal_tracking');
  });

  it('classifies Vulnerable persons mobility as the user-facing bottom-reference mobility tag', () => {
    const mobility = classifyMobilitySpine(vulnerableMobilityCandidate);
    expect(mobility.supportsVulnerablePersonsMobility).toBe(true);
    expect(mobility.mobilityReferenceTag).toBe('vulnerable_persons_mobility');
    expect(mobility.sharedProcessSpine).toContain('document_checklist');
    expect(mobility.sharedProcessSpine).toContain('escalation');
  });

  it('keeps High-Yield Legal distinct from Polity Legal Aid', () => {
    expect(classifyLegalTrack(legalOpsCandidate)).toBe('high_yield_legal');
    expect(classifyLegalTrack(vulnerableMobilityCandidate)).toBe('polity_legal_aid');
  });

  it('assigns strategic lanes and verticals for reusable Marketa activation candidates', () => {
    const classification = classifyCandidate(legalOpsCandidate);
    expect(classification.strategicLanes).toContain('high_yield_legal');
    expect(classification.verticals).toContain('legal');
    expect(classification.verticals).toContain('founder_operator_services');
  });
});

describe('Marketa Activation Engine scoring and policy', () => {
  it('scores high-yield legal candidates with Passport and integration readiness signals', () => {
    const score = scoreCandidate(legalOpsCandidate);
    expect(score.passportReadinessScore).toBeGreaterThanOrEqual(65);
    expect(score.technicalIntegrationScore).toBeGreaterThanOrEqual(55);
    expect(score.overallPriorityScore).toBeGreaterThan(30);
  });

  it('routes vulnerable-person legal/mobility use cases to human review', () => {
    const screen = cleanRevenueScreen(vulnerableMobilityCandidate);
    expect(screen.status).toBe('needs_review');
    expect(screen.riskFlags).toContain('vulnerable_person_interaction');
    expect(screen.policyFlags).toContain('needs_licensed_partner_escalation');
  });
});

describe('Human Mobility Services amendment', () => {
  const execTravelCandidate = {
    name: 'Executive Travel Coordinator',
    description: 'Coordinates executive travel, flight booking, hotel accommodation, itinerary planning and travel compliance for corporate roadshows.',
    capabilities: ['flight booking', 'hotel accommodation', 'itinerary planning', 'travel compliance'],
    targetUsers: ['executive operations teams', 'corporate mobility teams'],
  };

  const crisisShelterCandidate = {
    name: 'Crisis Shelter Router',
    description: 'Routes refugees to temporary shelter during evacuation and emergency relocation, with aid placement follow-up.',
    capabilities: ['shelter routing', 'aid placement', 'evacuation support'],
    targetUsers: ['NGOs', 'aid organizations'],
  };

  it('classifies executive travel as short-term top-reference human mobility', () => {
    const mobility = classifyHumanMobility(execTravelCandidate);
    expect(mobility.supportsShortTerm).toBe(true);
    expect(mobility.supportsTopReferenceCase).toBe(true);
    expect(mobility.mobilityDomains).toContain('executive_travel');
    expect(mobility.mobilityDomains).toContain('temporary_accommodation');
    expect(mobility.processSpineSupport).toContain('travel_coordination');
    expect(mobility.processSpineSupport).toContain('accommodation_coordination');
  });

  it('classifies crisis shelter routing as short-term bottom-reference human mobility', () => {
    const mobility = classifyHumanMobility(crisisShelterCandidate);
    expect(mobility.supportsShortTerm).toBe(true);
    expect(mobility.supportsBottomReferenceCase).toBe(true);
    expect(mobility.mobilityDomains).toContain('crisis_mobility');
    expect(mobility.mobilityDomains).toContain('shelter_routing');
  });

  it('uses the renamed human_mobility_services lane', () => {
    const classification = classifyCandidate(execTravelCandidate);
    expect(classification.strategicLanes).toContain('human_mobility_services');
    expect(classification.strategicLanes).not.toContain('mobility_residency_being');
  });

  it('scores mobility frequency, leverage and continuity dimensions', () => {
    const scores = scoreCandidate(execTravelCandidate);
    expect(scores.mobilityFrequencyScore).toBeGreaterThanOrEqual(70);
    expect(scores.mobilityLeverageScore).toBeGreaterThan(0);
    const continuityFull = scoreCandidate({
      name: 'Full Lifecycle Mobility Agent',
      description: 'Supports business travel, secondment placements with temporary accommodation, and long-term executive relocation with permanent residency planning.',
    });
    expect(continuityFull.mobilityContinuityScore).toBe(100);
  });
});
