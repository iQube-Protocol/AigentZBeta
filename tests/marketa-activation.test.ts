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

describe('Opportunity revenue roll-up', () => {
  const opp = (activationStatus: string, estimatedValue: number) => ({
    id: 'opp', candidateAgentId: 'cand', opportunityType: 'other', targetUser: 'other',
    description: 'x', estimatedValue, cleanRevenueStatus: 'unknown', policyRisk: 'low',
    requiresPassport: true, requiresStewardReview: false, requiresHumanSignoff: true,
    activationStatus, createdAt: '', updatedAt: '',
  });

  it('sums open opportunities into the pipeline and completed into closed revenue', async () => {
    const { rollUpRevenue } = await import('@/services/marketa/activation/normalizers');
    const rollUp = rollUpRevenue([
      opp('proposed', 100), opp('approved', 200), opp('active', 300),
      opp('paused', 50), opp('completed', 1000), opp('rejected', 9999),
    ] as never);
    expect(rollUp.estimatedPipelineValue).toBe(650);
    expect(rollUp.closedCleanRevenue).toBe(1000);
    expect(rollUp.recurringMonthlyRevenue).toBe(0);
    expect(rollUp.opportunityCount).toBe(5); // rejected counts nowhere
  });

  it('counts active subscriptions as MRR, not one-shot pipeline', async () => {
    const { rollUpRevenue } = await import('@/services/marketa/activation/normalizers');
    const sub = (activationStatus: string, estimatedValue: number) => ({
      ...opp(activationStatus, estimatedValue),
      opportunityType: 'subscription',
    });
    const rollUp = rollUpRevenue([
      sub('proposed', 99),   // pipeline at monthly value
      sub('active', 49),     // MRR — not pipeline
      sub('completed', 500), // ended subscription rolls into closed
      opp('active', 300),    // one-shot active stays in pipeline
    ] as never);
    expect(rollUp.estimatedPipelineValue).toBe(399); // 99 + 300
    expect(rollUp.recurringMonthlyRevenue).toBe(49);
    expect(rollUp.closedCleanRevenue).toBe(500);
  });

  it('normalizes opportunity create payloads and requires a description', async () => {
    const { opportunityInputToDb } = await import('@/services/marketa/activation/normalizers');
    const row = opportunityInputToDb({ description: 'Intro to founder', estimatedValue: '250' }, 'cand-1');
    expect(row.candidate_agent_id).toBe('cand-1');
    expect(row.estimated_value).toBe(250);
    expect(row.activation_status).toBe('proposed');
    expect(() => opportunityInputToDb({}, 'cand-1')).toThrow(/description/i);
  });
});

describe('discovery parsers', () => {
  it('maps an A2A agent card onto a candidate input', async () => {
    const { parseAgentCard } = await import('@/services/marketa/activation/discovery');
    const card = {
      name: 'Atlas Research Agent',
      description: 'Research briefs with cited sources.',
      url: 'https://agents.example.com/atlas',
      provider: { organization: 'Atlas Labs', url: 'https://atlaslabs.example.com' },
      skills: [
        { id: 'research', name: 'Research', tags: ['research', 'briefs'] },
        { id: 'crm', name: 'CRM support', tags: ['crm'] },
      ],
    };
    const input = parseAgentCard(card, 'https://agents.example.com/.well-known/agent-card.json');
    expect(input.name).toBe('Atlas Research Agent');
    expect(input.sourceType).toBe('a2a_card');
    expect(input.agentCardUrl).toBe('https://agents.example.com/.well-known/agent-card.json');
    expect(input.sourceUrl).toBe('https://agents.example.com/atlas');
    expect(input.operatorName).toBe('Atlas Labs');
    expect(input.websiteUrl).toBe('https://atlaslabs.example.com');
    expect(input.capabilities).toEqual(['Research', 'research', 'briefs', 'CRM support', 'crm']);
    expect(() => parseAgentCard({}, 'https://x.example.com')).toThrow(/name/i);
  });

  it('maps an MCP registry listing (array or { servers }) onto candidate inputs', async () => {
    const { parseMcpRegistryListing } = await import('@/services/marketa/activation/discovery');
    const listing = {
      servers: [
        {
          name: 'weather-mcp',
          description: 'Weather data MCP server.',
          repository: { url: 'https://github.com/example/weather-mcp' },
          remotes: [{ url: 'https://mcp.example.com/weather' }],
        },
        { description: 'nameless entry is skipped' },
      ],
    };
    const inputs = parseMcpRegistryListing(listing, 'https://registry.example.com/v0/servers');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].name).toBe('weather-mcp');
    expect(inputs[0].sourceType).toBe('mcp_registry');
    expect(inputs[0].mcpServerUrl).toBe('https://mcp.example.com/weather');
    expect(inputs[0].repositoryUrl).toBe('https://github.com/example/weather-mcp');
    const bare = parseMcpRegistryListing([{ name: 'solo' }], 'https://r.example.com');
    expect(bare).toHaveLength(1);
  });

  it('builds dedupe keys from URLs (normalized) and name', async () => {
    const { candidateDedupeKeys, normalizeUrlKey } = await import('@/services/marketa/activation/discovery');
    expect(normalizeUrlKey('https://Example.com/Path/')).toBe('https://example.com/path');
    const keys = candidateDedupeKeys({
      name: 'Atlas',
      sourceUrl: 'https://agents.example.com/atlas/',
      agentCardUrl: '',
    });
    expect(keys).toContain('url:https://agents.example.com/atlas');
    expect(keys).toContain('name:atlas');
    expect(keys).toHaveLength(2);
  });

  it('parses MARKETA_DISCOVERY_SOURCES env config, dropping invalid entries', async () => {
    const { parseConfiguredSources } = await import('@/services/marketa/activation/discovery');
    const sources = parseConfiguredSources(JSON.stringify([
      { kind: 'a2a_card', url: 'https://a.example.com/card.json' },
      { kind: 'bogus', url: 'https://b.example.com' },
      { kind: 'mcp_registry' },
    ]));
    expect(sources).toEqual([{ kind: 'a2a_card', url: 'https://a.example.com/card.json' }]);
    expect(parseConfiguredSources(undefined)).toEqual([]);
    expect(parseConfiguredSources('not json')).toEqual([]);
  });
});

describe('outreach template library', () => {
  const candidate = {
    name: 'Atlas Research Agent',
    operatorName: 'Atlas Labs',
    strategicLanes: ['founder_operator_enablement'],
    capabilities: ['research', 'crm'],
    legalTrack: 'none',
    topBottomRelevance: { mobilityReferenceTag: 'none' },
  } as never;

  it('renders the built-in template with candidate placeholders filled', async () => {
    const { BUILT_IN_OUTREACH_TEMPLATE, renderOutreachTemplate } = await import('@/services/marketa/activation/outreachTemplates');
    const draft = renderOutreachTemplate(BUILT_IN_OUTREACH_TEMPLATE, candidate, 'warm intro via KNYT');
    expect(draft.subject).toBe('Explore Polity Participant activation for Atlas Labs');
    expect(draft.body).toContain('Hi Atlas Labs,');
    expect(draft.body).toContain('Atlas Research Agent appears relevant to founder operator enablement.');
    expect(draft.body).toContain('- research\n- crm');
    expect(draft.body).toContain('Operator note / angle: warm intro via KNYT');
    expect(draft.body).not.toContain('{{'); // every placeholder resolved
    expect(draft.body).not.toContain('Legal track'); // legalTrack none → line omitted
    expect(draft.body).not.toMatch(/\n{3,}/); // empty lines collapsed
  });

  it('drops unknown placeholders and the angle note when no angle is given', async () => {
    const { renderOutreachTemplate } = await import('@/services/marketa/activation/outreachTemplates');
    const draft = renderOutreachTemplate(
      { subjectTemplate: 'Hello {{operator}} {{bogus_field}}', bodyTemplate: '{{angle_note}}\n\nBody for {{candidate_name}}', cta: 'cta' },
      candidate,
      '',
    );
    expect(draft.subject).toBe('Hello Atlas Labs');
    expect(draft.body).toBe('Body for Atlas Research Agent');
  });

  it('picks lane-matching template over any-lane, skipping disabled', async () => {
    const { pickOutreachTemplate } = await import('@/services/marketa/activation/outreachTemplates');
    const tpl = (id: string, strategicLane: string, enabled = true) => ({
      id, name: id, strategicLane, subjectTemplate: 's', bodyTemplate: 'b', cta: '',
      enabled, createdAt: '', updatedAt: '',
    });
    const templates = [
      tpl('disabled-lane', 'founder_operator_enablement', false),
      tpl('catch-all', 'any'),
      tpl('lane-match', 'founder_operator_enablement'),
    ];
    expect(pickOutreachTemplate(templates, ['founder_operator_enablement'])?.id).toBe('lane-match');
    expect(pickOutreachTemplate(templates, ['other_lane'])?.id).toBe('catch-all');
    expect(pickOutreachTemplate([tpl('x', 'some_lane')], ['other_lane'])).toBeNull();
  });

  it('validates template create input', async () => {
    const { outreachTemplateInputToDb } = await import('@/services/marketa/activation/outreachTemplates');
    const row = outreachTemplateInputToDb({ name: 'Intro v1', subjectTemplate: 's {{operator}}', bodyTemplate: 'b' });
    expect(row.strategic_lane).toBe('any');
    expect(row.enabled).toBe(true);
    expect(() => outreachTemplateInputToDb({ subjectTemplate: 's', bodyTemplate: 'b' })).toThrow(/name/i);
    expect(() => outreachTemplateInputToDb({ name: 'n', subjectTemplate: 's' })).toThrow(/subject and body/i);
  });
});

describe('revenue attribution', () => {
  it('groups candidate roll-ups by primary lane and source, dropping empty buckets', async () => {
    const { attributeRevenue } = await import('@/services/marketa/activation/normalizers');
    const cand = (
      lanes: string[],
      sourceType: string,
      tracking: { opportunityCount: number; estimatedPipelineValue: number; closedCleanRevenue: number; recurringMonthlyRevenue: number },
    ) => ({ strategicLanes: lanes, sourceType, revenueTracking: { ...tracking, revenueAttributionNotes: '' } });
    const { byLane, bySource } = attributeRevenue([
      cand(['founder_operator_enablement'], 'a2a_card', { opportunityCount: 2, estimatedPipelineValue: 500, closedCleanRevenue: 100, recurringMonthlyRevenue: 0 }),
      cand(['founder_operator_enablement'], 'mcp_registry', { opportunityCount: 1, estimatedPipelineValue: 0, closedCleanRevenue: 0, recurringMonthlyRevenue: 49 }),
      cand([], 'manual', { opportunityCount: 1, estimatedPipelineValue: 250, closedCleanRevenue: 0, recurringMonthlyRevenue: 0 }),
      cand(['dormant_lane'], 'manual', { opportunityCount: 0, estimatedPipelineValue: 0, closedCleanRevenue: 0, recurringMonthlyRevenue: 0 }),
    ] as never);

    expect(byLane.map(b => b.key)).toEqual(['founder_operator_enablement', 'unassigned']); // dormant dropped, sorted by value
    expect(byLane[0]).toMatchObject({ opportunityCount: 3, pipeline: 500, closed: 100, mrr: 49 });
    expect(bySource.map(b => b.key)).toEqual(['a2a_card', 'manual', 'mcp_registry']);
    expect(bySource.find(b => b.key === 'mcp_registry')).toMatchObject({ mrr: 49, pipeline: 0 });
  });
});
