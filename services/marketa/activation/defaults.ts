import type {
  CandidateScores,
  IqubeRegistryStub,
  PassportIntegrationStub,
  ReputationStub,
  RevenueTrackingSummary,
  ScoreWeights,
  TopBottomRelevance,
} from './types';

export const DEFAULT_MARKETA_SCORE_WEIGHTS: ScoreWeights = {
  strategicFitScore: 0.20,
  aigentmeFitScore: 0.15,
  marketaMultiplierScore: 0.10,
  cleanRevenuePotentialScore: 0.25,
  trustReadinessScore: 0.15,
  passportReadinessScore: 0.10,
  riskScore: 0.15,
};

export const EMPTY_SCORES: CandidateScores = {
  strategicFitScore: 0,
  aigentmeFitScore: 0,
  marketaMultiplierScore: 0,
  cleanRevenuePotentialScore: 0,
  trustReadinessScore: 0,
  passportReadinessScore: 0,
  technicalIntegrationScore: 0,
  policyAlignmentScore: 0,
  riskScore: 0,
  overallPriorityScore: 0,
};

export const EMPTY_TOP_BOTTOM_RELEVANCE: TopBottomRelevance = {
  supportsExecMobility: false,
  supportsVulnerablePersonsMobility: false,
  mobilityReferenceTag: 'none',
  sharedProcessSpine: [],
};

export const EMPTY_PASSPORT_STUB: PassportIntegrationStub = {
  integrationStatus: 'stub',
  participantPassportApplicationUrl: '',
  participantPassportSchemaUrl: '',
  passportApplicationStatus: 'not_started',
  participantPassportId: '',
  registryRecordId: '',
  agentIqubeId: '',
  reputationBindingId: '',
  lastSyncAt: null,
};

export const EMPTY_IQUBE_REGISTRY_STUB: IqubeRegistryStub = {
  registryStatus: 'not_registered',
  agentIqubeId: '',
  registryRecordId: '',
  publicRegistryUrl: '',
  agentCardRef: '',
  lastRegistrySyncAt: null,
};

export const EMPTY_REPUTATION_STUB: ReputationStub = {
  reputationBindingId: '',
  standingStatus: 'unknown',
  publicScore: null,
  infractionCount: 0,
  activeRestrictions: [],
  lastReputationCheckAt: null,
};

export const EMPTY_REVENUE_TRACKING: RevenueTrackingSummary = {
  opportunityCount: 0,
  estimatedPipelineValue: 0,
  closedCleanRevenue: 0,
  revenueAttributionNotes: '',
};
