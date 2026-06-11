export const STRATEGIC_LANES = [
  'aigentme_chief_of_staff',
  'high_yield_legal',
  'mobility_residency_being',
  'media_communications_public_affairs',
  'agentic_ai_blockchain_infrastructure',
] as const;

export type StrategicLane = (typeof STRATEGIC_LANES)[number];

export const VERTICALS = [
  'legal',
  'immigration',
  'housing',
  'corporate_mobility',
  'media',
  'blockchain',
  'agentic_ai',
  'founder_operator_services',
] as const;

export type CandidateVertical = (typeof VERTICALS)[number];

export const LEGAL_TRACKS = [
  'none',
  'high_yield_legal',
  'polity_legal_aid',
  'both',
] as const;

export type LegalTrack = (typeof LEGAL_TRACKS)[number];

export const MOBILITY_REFERENCE_TAGS = [
  'none',
  'exec_mobility',
  'vulnerable_persons_mobility',
  'both',
] as const;

export type MobilityReferenceTag = (typeof MOBILITY_REFERENCE_TAGS)[number];

export const MOBILITY_SPINE_TAGS = [
  'intake',
  'identity_profile',
  'jurisdiction_matching',
  'eligibility_orientation',
  'document_checklist',
  'housing_workflow',
  'residency_workflow',
  'partner_routing',
  'status_tracking',
  'renewal_tracking',
  'compliance_tracking',
  'escalation',
] as const;

export type MobilitySpineTag = (typeof MOBILITY_SPINE_TAGS)[number];

export const ACTIVATION_STATUSES = [
  'discovered',
  'enriched',
  'scored',
  'shortlisted',
  'needs_review',
  'approved_for_outreach',
  'outreach_drafted',
  'outreach_approved',
  'outreach_sent',
  'responded',
  'qualified',
  'application_recommended',
  'passport_application_started',
  'pending_passport',
  'passport_approved',
  'provisionally_approved',
  'activated',
  'revenue_active',
  'deferred',
  'rejected',
  'do_not_contact',
] as const;

export type ActivationStatus = (typeof ACTIVATION_STATUSES)[number];

export const OUTREACH_STATUSES = [
  'not_started',
  'drafted',
  'approved',
  'sent',
  'responded',
  'declined',
  'opted_out',
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const SOURCE_TYPES = [
  'github',
  'hugging_face',
  'mcp_registry',
  'a2a_card',
  'directory',
  'manual',
  'other',
] as const;

export type CandidateSourceType = (typeof SOURCE_TYPES)[number];

export interface TopBottomRelevance {
  supportsExecMobility: boolean;
  supportsVulnerablePersonsMobility: boolean;
  mobilityReferenceTag: MobilityReferenceTag;
  sharedProcessSpine: MobilitySpineTag[];
}

export interface CandidateScores {
  strategicFitScore: number;
  aigentmeFitScore: number;
  marketaMultiplierScore: number;
  cleanRevenuePotentialScore: number;
  trustReadinessScore: number;
  passportReadinessScore: number;
  technicalIntegrationScore: number;
  policyAlignmentScore: number;
  riskScore: number;
  overallPriorityScore: number;
}

export interface ScoreWeights {
  strategicFitScore: number;
  aigentmeFitScore: number;
  marketaMultiplierScore: number;
  cleanRevenuePotentialScore: number;
  trustReadinessScore: number;
  passportReadinessScore: number;
  riskScore: number;
}

export interface PassportIntegrationStub {
  integrationStatus: 'stub' | 'connected' | 'failed';
  participantPassportApplicationUrl: string;
  participantPassportSchemaUrl: string;
  passportApplicationStatus:
    | 'not_started'
    | 'draft'
    | 'submitted'
    | 'pending_approval'
    | 'needs_more_information'
    | 'provisionally_approved'
    | 'approved'
    | 'denied'
    | 'withdrawn'
    | 'restricted'
    | 'suspended'
    | 'revoked'
    | 'delisted';
  participantPassportId: string;
  registryRecordId: string;
  agentIqubeId: string;
  reputationBindingId: string;
  lastSyncAt: string | null;
}

export interface IqubeRegistryStub {
  registryStatus: 'not_registered' | 'pending' | 'registered' | 'restricted' | 'suspended' | 'revoked' | 'delisted';
  agentIqubeId: string;
  registryRecordId: string;
  publicRegistryUrl: string;
  agentCardRef: string;
  lastRegistrySyncAt: string | null;
}

export interface ReputationStub {
  reputationBindingId: string;
  standingStatus: 'unknown' | 'good_standing' | 'watchlist' | 'restricted' | 'under_review' | 'suspended' | 'revoked';
  publicScore: number | null;
  infractionCount: number;
  activeRestrictions: string[];
  lastReputationCheckAt: string | null;
}

export interface RevenueTrackingSummary {
  opportunityCount: number;
  estimatedPipelineValue: number;
  closedCleanRevenue: number;
  revenueAttributionNotes: string;
}

export interface CandidateAgentInput {
  name: string;
  description?: string;
  sourceType?: CandidateSourceType;
  sourceUrl?: string;
  agentCardUrl?: string;
  mcpServerUrl?: string;
  openapiUrl?: string;
  repositoryUrl?: string;
  websiteUrl?: string;
  operatorName?: string;
  operatorType?: string;
  capabilities?: string[];
  targetUsers?: string[];
  strategicLanes?: StrategicLane[];
  verticals?: CandidateVertical[];
  legalTrack?: LegalTrack;
  topBottomRelevance?: Partial<TopBottomRelevance>;
  activationStatus?: ActivationStatus;
  outreachStatus?: OutreachStatus;
  revenueTracking?: Partial<RevenueTrackingSummary>;
  notes?: string;
}

export interface CandidateAgent extends Required<Omit<CandidateAgentInput,
  'description' |
  'sourceType' |
  'sourceUrl' |
  'agentCardUrl' |
  'mcpServerUrl' |
  'openapiUrl' |
  'repositoryUrl' |
  'websiteUrl' |
  'operatorName' |
  'operatorType' |
  'capabilities' |
  'targetUsers' |
  'strategicLanes' |
  'verticals' |
  'legalTrack' |
  'topBottomRelevance' |
  'activationStatus' |
  'outreachStatus' |
  'revenueTracking' |
  'notes'
>> {
  id: string;
  description: string;
  sourceType: CandidateSourceType;
  sourceUrl: string;
  agentCardUrl: string;
  mcpServerUrl: string;
  openapiUrl: string;
  repositoryUrl: string;
  websiteUrl: string;
  operatorName: string;
  operatorType: string;
  capabilities: string[];
  targetUsers: string[];
  strategicLanes: StrategicLane[];
  verticals: CandidateVertical[];
  legalTrack: LegalTrack;
  topBottomRelevance: TopBottomRelevance;
  scores: CandidateScores;
  riskFlags: string[];
  policyFlags: string[];
  outreachStatus: OutreachStatus;
  activationStatus: ActivationStatus;
  passportIntegration: PassportIntegrationStub;
  iqubeRegistry: IqubeRegistryStub;
  reputation: ReputationStub;
  revenueTracking: RevenueTrackingSummary;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateOpportunity {
  id: string;
  candidateAgentId: string;
  opportunityType: string;
  targetUser: string;
  description: string;
  estimatedValue: number;
  cleanRevenueStatus: 'unknown' | 'likely_clean' | 'needs_review' | 'rejected';
  policyRisk: 'low' | 'medium' | 'high' | 'critical';
  requiresPassport: boolean;
  requiresStewardReview: boolean;
  requiresHumanSignoff: boolean;
  activationStatus: 'proposed' | 'approved' | 'active' | 'paused' | 'completed' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface ActivationEvent {
  id: string;
  candidateAgentId: string;
  eventType: string;
  summary: string;
  actor: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
