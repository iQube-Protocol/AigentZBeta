import {
  type CandidateAgentInput,
  type CandidateVertical,
  type LegalTrack,
  type MobilityReferenceTag,
  type MobilitySpineTag,
  type StrategicLane,
} from './types';
import { includesAny, textBlob } from './text';
import { EMPTY_TOP_BOTTOM_RELEVANCE } from './defaults';

const CHIEF_OF_STAFF_TERMS = [
  'scheduling', 'calendar', 'inbox', 'crm', 'investor', 'research', 'document',
  'proposal', 'grant', 'dealflow', 'compliance', 'board', 'meeting', 'project',
  'workflow', 'founder', 'chief of staff', 'operations',
];

const LEGAL_TERMS = [
  'legal', 'contract', 'matter', 'counsel', 'compliance', 'regulatory',
  'due diligence', 'law firm', 'legal research', 'policy tracking',
];

const POLITY_LEGAL_AID_TERMS = [
  'stateless', 'refugee', 'asylum', 'aid', 'clinic', 'rights navigation',
  'housing-insecure', 'vulnerable', 'immigration orientation', 'legal aid',
];

const MOBILITY_TERMS = [
  'immigration', 'residency', 'housing', 'relocation', 'lawful presence',
  'visa', 'work authorization', 'jurisdiction', 'renewal', 'shelter',
];

const EXEC_MOBILITY_TERMS = [
  'executive', 'corporate mobility', 'global mobility', 'relocation service',
  'senior executive', 'chief people', 'corporate housing',
];

const VULNERABLE_MOBILITY_TERMS = [
  'stateless', 'refugee', 'asylum', 'housing-insecure', 'shelter', 'aid',
  'vulnerable', 'lawful presence', 'rights navigation',
];

const MEDIA_TERMS = [
  'pr', 'public affairs', 'communications', 'social', 'press', 'media',
  'podcast', 'newsletter', 'campaign', 'community', 'thought leadership',
];

const BLOCKCHAIN_AGENT_TERMS = [
  'agent card', 'mcp', 'a2a', 'wallet', 'smart contract', 'token', 'did',
  'credential', 'registry', 'reputation', 'x402', 'blockchain', 'agentic ai',
];

const FOUNDER_SERVICE_TERMS = [
  'founder', 'operator', 'startup', 'executive', 'small team', 'venture',
];

function sourceText(input: CandidateAgentInput): string {
  return textBlob(input);
}

export function classifyLane(input: CandidateAgentInput): StrategicLane[] {
  const text = sourceText(input);
  const lanes = new Set<StrategicLane>(input.strategicLanes ?? []);
  if (includesAny(text, CHIEF_OF_STAFF_TERMS)) lanes.add('aigentme_chief_of_staff');
  if (includesAny(text, LEGAL_TERMS)) lanes.add('high_yield_legal');
  if (includesAny(text, MOBILITY_TERMS)) lanes.add('mobility_residency_being');
  if (includesAny(text, MEDIA_TERMS)) lanes.add('media_communications_public_affairs');
  if (includesAny(text, BLOCKCHAIN_AGENT_TERMS)) lanes.add('agentic_ai_blockchain_infrastructure');
  return Array.from(lanes);
}

export function classifyVertical(input: CandidateAgentInput): CandidateVertical[] {
  const text = sourceText(input);
  const verticals = new Set<CandidateVertical>(input.verticals ?? []);
  if (includesAny(text, LEGAL_TERMS) || includesAny(text, POLITY_LEGAL_AID_TERMS)) verticals.add('legal');
  if (includesAny(text, ['immigration', 'visa', 'lawful presence', 'asylum', 'work authorization'])) verticals.add('immigration');
  if (includesAny(text, ['housing', 'shelter', 'corporate housing', 'relocation accommodation'])) verticals.add('housing');
  if (includesAny(text, EXEC_MOBILITY_TERMS)) verticals.add('corporate_mobility');
  if (includesAny(text, MEDIA_TERMS)) verticals.add('media');
  if (includesAny(text, ['blockchain', 'wallet', 'smart contract', 'token', 'x402', 'did'])) verticals.add('blockchain');
  if (includesAny(text, ['agentic ai', 'agent card', 'mcp', 'a2a', 'agent registry'])) verticals.add('agentic_ai');
  if (includesAny(text, FOUNDER_SERVICE_TERMS) || includesAny(text, CHIEF_OF_STAFF_TERMS)) verticals.add('founder_operator_services');
  return Array.from(verticals);
}

export function classifyLegalTrack(input: CandidateAgentInput): LegalTrack {
  if (input.legalTrack && input.legalTrack !== 'none') return input.legalTrack;
  const text = sourceText(input);
  // The bare 'legal' substring also matches aid-context phrases ('legal aid',
  // 'legal clinics'), which would mislabel Polity Legal Aid candidates as
  // high-yield — exclude it here; the specific terms carry the signal.
  const highYield = includesAny(text, LEGAL_TERMS.filter((term) => term !== 'legal')) || includesAny(text, ['general counsel', 'law firm', 'legal ops', 'client development']);
  const legalAid = includesAny(text, POLITY_LEGAL_AID_TERMS) || includesAny(text, ['immigration orientation', 'licensed partner escalation']);
  if (highYield && legalAid) return 'both';
  if (highYield) return 'high_yield_legal';
  if (legalAid) return 'polity_legal_aid';
  return 'none';
}

export function classifyMobilitySpine(input: CandidateAgentInput) {
  const text = sourceText(input);
  const explicit = input.topBottomRelevance;
  const supportsExecMobility = explicit?.supportsExecMobility ?? includesAny(text, EXEC_MOBILITY_TERMS);
  const supportsVulnerablePersonsMobility = explicit?.supportsVulnerablePersonsMobility ?? includesAny(text, VULNERABLE_MOBILITY_TERMS);

  let mobilityReferenceTag: MobilityReferenceTag = 'none';
  if (supportsExecMobility && supportsVulnerablePersonsMobility) mobilityReferenceTag = 'both';
  else if (supportsExecMobility) mobilityReferenceTag = 'exec_mobility';
  else if (supportsVulnerablePersonsMobility) mobilityReferenceTag = 'vulnerable_persons_mobility';
  else if (explicit?.mobilityReferenceTag) mobilityReferenceTag = explicit.mobilityReferenceTag;

  const tags = new Set<MobilitySpineTag>(explicit?.sharedProcessSpine ?? []);
  const tagTerms: Array<[MobilitySpineTag, string[]]> = [
    ['intake', ['intake', 'onboarding', 'application']],
    ['identity_profile', ['identity', 'persona', 'profile', 'documentation']],
    ['jurisdiction_matching', ['jurisdiction', 'country comparison', 'state comparison']],
    ['eligibility_orientation', ['eligibility', 'pathway', 'orientation', 'visa']],
    ['document_checklist', ['document checklist', 'checklist', 'forms']],
    ['housing_workflow', ['housing', 'shelter', 'accommodation']],
    ['residency_workflow', ['residency', 'lawful presence', 'relocation']],
    ['partner_routing', ['partner routing', 'vendor coordination', 'escalation']],
    ['status_tracking', ['status tracking', 'dashboard', 'case status']],
    ['renewal_tracking', ['renewal', 'deadline', 'reminder']],
    ['compliance_tracking', ['compliance', 'regulatory', 'audit']],
    ['escalation', ['escalation', 'licensed partner', 'human review']],
  ];
  for (const [tag, terms] of tagTerms) {
    if (includesAny(text, terms)) tags.add(tag);
  }

  return {
    ...EMPTY_TOP_BOTTOM_RELEVANCE,
    ...explicit,
    supportsExecMobility,
    supportsVulnerablePersonsMobility,
    mobilityReferenceTag,
    sharedProcessSpine: Array.from(tags),
  };
}

export function classifyCandidate(input: CandidateAgentInput) {
  return {
    strategicLanes: classifyLane(input),
    verticals: classifyVertical(input),
    legalTrack: classifyLegalTrack(input),
    topBottomRelevance: classifyMobilitySpine(input),
  };
}
