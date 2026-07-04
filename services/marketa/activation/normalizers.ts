import {
  EMPTY_HUMAN_MOBILITY,
  EMPTY_IQUBE_REGISTRY_STUB,
  EMPTY_PASSPORT_STUB,
  EMPTY_REPUTATION_STUB,
  EMPTY_REVENUE_TRACKING,
  EMPTY_SCORES,
  EMPTY_TOP_BOTTOM_RELEVANCE,
} from './defaults';
import { classifyCandidate } from './classification';
import { cleanRevenueScreen } from './policy';
import { scoreCandidate } from './scoring';
import type {
  ActivationStatus,
  CandidateAgent,
  CandidateAgentInput,
  CandidateOpportunity,
  CandidateSourceType,
  CandidateVertical,
  LegalTrack,
  OutreachStatus,
  StrategicLane,
} from './types';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asSourceType(value: unknown): CandidateSourceType {
  const raw = asString(value, 'manual');
  return ['github', 'hugging_face', 'mcp_registry', 'a2a_card', 'directory', 'manual', 'other'].includes(raw)
    ? (raw as CandidateSourceType)
    : 'manual';
}

function asActivationStatus(value: unknown): ActivationStatus {
  const raw = asString(value, 'discovered');
  return [
    'discovered', 'enriched', 'scored', 'shortlisted', 'needs_review', 'approved_for_outreach',
    'outreach_drafted', 'outreach_approved', 'outreach_sent', 'responded', 'qualified',
    'application_recommended', 'passport_application_started', 'pending_passport', 'passport_approved',
    'provisionally_approved', 'activated', 'revenue_active', 'deferred', 'rejected', 'do_not_contact',
  ].includes(raw) ? (raw as ActivationStatus) : 'discovered';
}

function asOutreachStatus(value: unknown): OutreachStatus {
  const raw = asString(value, 'not_started');
  return ['not_started', 'drafted', 'approved', 'sent', 'responded', 'declined', 'opted_out'].includes(raw)
    ? (raw as OutreachStatus)
    : 'not_started';
}

/** Human Mobility Services amendment: map the legacy lane id on any read path. */
function asLanes(value: unknown): StrategicLane[] {
  return asStringArray(value).map((lane) =>
    lane === 'mobility_residency_being' ? 'human_mobility_services' : lane,
  ) as StrategicLane[];
}

function camelToSnake(input: CandidateAgentInput) {
  const classification = classifyCandidate(input);
  const screen = cleanRevenueScreen(input);
  const scores = scoreCandidate(input);
  return {
    name: input.name,
    description: input.description ?? '',
    source_type: input.sourceType ?? 'manual',
    source_url: input.sourceUrl ?? '',
    agent_card_url: input.agentCardUrl ?? '',
    mcp_server_url: input.mcpServerUrl ?? '',
    openapi_url: input.openapiUrl ?? '',
    repository_url: input.repositoryUrl ?? '',
    website_url: input.websiteUrl ?? '',
    operator_name: input.operatorName ?? '',
    operator_type: input.operatorType ?? 'unknown',
    strategic_lanes: input.strategicLanes ?? classification.strategicLanes,
    verticals: input.verticals ?? classification.verticals,
    capabilities: input.capabilities ?? [],
    target_users: input.targetUsers ?? [],
    top_bottom_relevance: {
      ...classification.topBottomRelevance,
      ...(input.topBottomRelevance ?? {}),
    },
    human_mobility: {
      ...classification.humanMobility,
      ...(input.humanMobility ?? {}),
    },
    legal_track: input.legalTrack ?? classification.legalTrack,
    scores,
    risk_flags: screen.riskFlags,
    policy_flags: screen.policyFlags,
    outreach_status: input.outreachStatus ?? 'not_started',
    activation_status: input.activationStatus ?? (screen.status === 'needs_review' || screen.status === 'rejected' ? 'needs_review' : 'discovered'),
    passport_integration: EMPTY_PASSPORT_STUB,
    iqube_registry: EMPTY_IQUBE_REGISTRY_STUB,
    reputation: EMPTY_REPUTATION_STUB,
    revenue_tracking: { ...EMPTY_REVENUE_TRACKING, ...(input.revenueTracking ?? {}) },
    notes: input.notes ?? '',
  };
}

export function normalizeCandidateInput(raw: unknown): CandidateAgentInput {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const name = asString(body.name).trim();
  if (!name) throw new Error('Candidate name is required');
  return {
    name,
    description: asString(body.description),
    sourceType: asSourceType(body.sourceType ?? body.source_type),
    sourceUrl: asString(body.sourceUrl ?? body.source_url),
    agentCardUrl: asString(body.agentCardUrl ?? body.agent_card_url),
    mcpServerUrl: asString(body.mcpServerUrl ?? body.mcp_server_url),
    openapiUrl: asString(body.openapiUrl ?? body.openapi_url),
    repositoryUrl: asString(body.repositoryUrl ?? body.repository_url),
    websiteUrl: asString(body.websiteUrl ?? body.website_url),
    operatorName: asString(body.operatorName ?? body.operator_name),
    operatorType: asString(body.operatorType ?? body.operator_type, 'unknown'),
    capabilities: asStringArray(body.capabilities),
    targetUsers: asStringArray(body.targetUsers ?? body.target_users),
    strategicLanes: asLanes(body.strategicLanes ?? body.strategic_lanes),
    verticals: asStringArray(body.verticals) as CandidateVertical[],
    legalTrack: asString(body.legalTrack ?? body.legal_track, 'none') as LegalTrack,
    activationStatus: asActivationStatus(body.activationStatus ?? body.activation_status),
    outreachStatus: asOutreachStatus(body.outreachStatus ?? body.outreach_status),
    notes: asString(body.notes),
  };
}

export function candidateInputToDb(input: CandidateAgentInput) {
  return camelToSnake(input);
}

export function candidatePatchToDb(raw: unknown) {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const patch: Record<string, unknown> = {};
  const scalarMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    sourceType: 'source_type',
    sourceUrl: 'source_url',
    agentCardUrl: 'agent_card_url',
    mcpServerUrl: 'mcp_server_url',
    openapiUrl: 'openapi_url',
    repositoryUrl: 'repository_url',
    websiteUrl: 'website_url',
    operatorName: 'operator_name',
    operatorType: 'operator_type',
    legalTrack: 'legal_track',
    outreachStatus: 'outreach_status',
    activationStatus: 'activation_status',
    notes: 'notes',
  };
  for (const [camel, snake] of Object.entries(scalarMap)) {
    if (body[camel] !== undefined) patch[snake] = body[camel];
    if (body[snake] !== undefined) patch[snake] = body[snake];
  }
  const jsonMap: Record<string, string> = {
    strategicLanes: 'strategic_lanes',
    verticals: 'verticals',
    capabilities: 'capabilities',
    targetUsers: 'target_users',
    topBottomRelevance: 'top_bottom_relevance',
    humanMobility: 'human_mobility',
    passportIntegration: 'passport_integration',
    iqubeRegistry: 'iqube_registry',
    reputation: 'reputation',
    revenueTracking: 'revenue_tracking',
  };
  for (const [camel, snake] of Object.entries(jsonMap)) {
    if (body[camel] !== undefined) patch[snake] = body[camel];
    if (body[snake] !== undefined) patch[snake] = body[snake];
  }
  patch.updated_at = new Date().toISOString();
  return patch;
}

const OPPORTUNITY_STATUSES = ['proposed', 'approved', 'active', 'paused', 'completed', 'rejected'] as const;
const CLEAN_REVENUE_STATUSES = ['unknown', 'likely_clean', 'needs_review', 'rejected'] as const;
const POLICY_RISKS = ['low', 'medium', 'high', 'critical'] as const;

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const raw = asString(value, fallback);
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function dbToOpportunity(row: Record<string, unknown>): CandidateOpportunity {
  return {
    id: asString(row.id),
    candidateAgentId: asString(row.candidate_agent_id),
    opportunityType: asString(row.opportunity_type, 'other'),
    targetUser: asString(row.target_user, 'other'),
    description: asString(row.description),
    estimatedValue: asNumber(row.estimated_value),
    cleanRevenueStatus: asEnum(row.clean_revenue_status, CLEAN_REVENUE_STATUSES, 'unknown'),
    policyRisk: asEnum(row.policy_risk, POLICY_RISKS, 'low'),
    requiresPassport: row.requires_passport !== false,
    requiresStewardReview: row.requires_steward_review === true,
    requiresHumanSignoff: row.requires_human_signoff !== false,
    activationStatus: asEnum(row.activation_status, OPPORTUNITY_STATUSES, 'proposed'),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

/** Create payload → DB row. Description is the only required field. */
export function opportunityInputToDb(raw: unknown, candidateAgentId: string) {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const description = asString(body.description).trim();
  if (!description) throw new Error('Opportunity description is required');
  return {
    candidate_agent_id: candidateAgentId,
    opportunity_type: asString(body.opportunityType ?? body.opportunity_type, 'other'),
    target_user: asString(body.targetUser ?? body.target_user, 'other'),
    description,
    estimated_value: asNumber(body.estimatedValue ?? body.estimated_value),
    clean_revenue_status: asEnum(body.cleanRevenueStatus ?? body.clean_revenue_status, CLEAN_REVENUE_STATUSES, 'unknown'),
    policy_risk: asEnum(body.policyRisk ?? body.policy_risk, POLICY_RISKS, 'low'),
    activation_status: asEnum(body.activationStatus ?? body.activation_status, OPPORTUNITY_STATUSES, 'proposed'),
  };
}

export function opportunityPatchToDb(raw: unknown) {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const patch: Record<string, unknown> = {};
  if (body.opportunityType !== undefined) patch.opportunity_type = asString(body.opportunityType, 'other');
  if (body.targetUser !== undefined) patch.target_user = asString(body.targetUser, 'other');
  if (body.description !== undefined) patch.description = asString(body.description);
  if (body.estimatedValue !== undefined) patch.estimated_value = asNumber(body.estimatedValue);
  if (body.cleanRevenueStatus !== undefined)
    patch.clean_revenue_status = asEnum(body.cleanRevenueStatus, CLEAN_REVENUE_STATUSES, 'unknown');
  if (body.policyRisk !== undefined) patch.policy_risk = asEnum(body.policyRisk, POLICY_RISKS, 'low');
  if (body.activationStatus !== undefined)
    patch.activation_status = asEnum(body.activationStatus, OPPORTUNITY_STATUSES, 'proposed');
  patch.updated_at = new Date().toISOString();
  return patch;
}

/**
 * Mechanical revenue roll-up (operator decisions 2026-06-11):
 * - one-shot opportunities: open (proposed/approved/active/paused) sum into
 *   the pipeline; completed sum into closed clean revenue.
 * - subscription-type opportunities (activation/subscription fee model):
 *   ACTIVE ones are recurring revenue — their estimatedValue is the monthly
 *   fee and sums into recurringMonthlyRevenue, not the one-shot pipeline.
 *   Proposed/approved/paused subscriptions still sit in the pipeline at
 *   monthly value; completed (ended) subscriptions roll into closed.
 * - rejected opportunities count nowhere.
 */
export function rollUpRevenue(opportunities: CandidateOpportunity[]) {
  const isSubscription = (o: CandidateOpportunity) => o.opportunityType === 'subscription';
  const open = opportunities.filter((o) =>
    ['proposed', 'approved', 'active', 'paused'].includes(o.activationStatus),
  );
  const activeSubscriptions = open.filter((o) => isSubscription(o) && o.activationStatus === 'active');
  const pipeline = open.filter((o) => !(isSubscription(o) && o.activationStatus === 'active'));
  const completed = opportunities.filter((o) => o.activationStatus === 'completed');
  return {
    opportunityCount: open.length + completed.length,
    estimatedPipelineValue: pipeline.reduce((sum, o) => sum + o.estimatedValue, 0),
    closedCleanRevenue: completed.reduce((sum, o) => sum + o.estimatedValue, 0),
    recurringMonthlyRevenue: activeSubscriptions.reduce((sum, o) => sum + o.estimatedValue, 0),
  };
}

export interface RevenueAttributionBucket {
  key: string;
  opportunityCount: number;
  pipeline: number;
  closed: number;
  mrr: number;
}

/**
 * Per-lane / per-source revenue attribution: groups each candidate's
 * rolled-up revenueTracking by its primary strategic lane (first lane,
 * 'unassigned' when none) and by its sourceType. Buckets with no revenue
 * activity are dropped; results sort by total attributed value descending.
 */
export function attributeRevenue(
  candidates: Array<Pick<CandidateAgent, 'strategicLanes' | 'sourceType' | 'revenueTracking'>>,
): { byLane: RevenueAttributionBucket[]; bySource: RevenueAttributionBucket[] } {
  const accumulate = (keyOf: (c: (typeof candidates)[number]) => string) => {
    const buckets = new Map<string, RevenueAttributionBucket>();
    for (const candidate of candidates) {
      const key = keyOf(candidate);
      const bucket = buckets.get(key) ?? { key, opportunityCount: 0, pipeline: 0, closed: 0, mrr: 0 };
      bucket.opportunityCount += candidate.revenueTracking.opportunityCount;
      bucket.pipeline += candidate.revenueTracking.estimatedPipelineValue;
      bucket.closed += candidate.revenueTracking.closedCleanRevenue;
      bucket.mrr += candidate.revenueTracking.recurringMonthlyRevenue ?? 0;
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values())
      .filter((bucket) => bucket.opportunityCount > 0 || bucket.pipeline > 0 || bucket.closed > 0 || bucket.mrr > 0)
      .sort((a, b) => (b.pipeline + b.closed + b.mrr) - (a.pipeline + a.closed + a.mrr));
  };
  return {
    byLane: accumulate((candidate) => candidate.strategicLanes[0] ?? 'unassigned'),
    bySource: accumulate((candidate) => candidate.sourceType || 'other'),
  };
}

export function dbToCandidate(row: Record<string, unknown>): CandidateAgent {
  return {
    id: asString(row.id),
    name: asString(row.name),
    description: asString(row.description),
    sourceType: asSourceType(row.source_type),
    sourceUrl: asString(row.source_url),
    agentCardUrl: asString(row.agent_card_url),
    mcpServerUrl: asString(row.mcp_server_url),
    openapiUrl: asString(row.openapi_url),
    repositoryUrl: asString(row.repository_url),
    websiteUrl: asString(row.website_url),
    operatorName: asString(row.operator_name),
    operatorType: asString(row.operator_type, 'unknown'),
    capabilities: asStringArray(row.capabilities),
    targetUsers: asStringArray(row.target_users),
    strategicLanes: asLanes(row.strategic_lanes),
    verticals: asStringArray(row.verticals) as CandidateVertical[],
    legalTrack: asString(row.legal_track, 'none') as LegalTrack,
    topBottomRelevance: { ...EMPTY_TOP_BOTTOM_RELEVANCE, ...(row.top_bottom_relevance as object) },
    humanMobility: { ...EMPTY_HUMAN_MOBILITY, ...(row.human_mobility as object) },
    scores: { ...EMPTY_SCORES, ...(row.scores as object) },
    riskFlags: asStringArray(row.risk_flags),
    policyFlags: asStringArray(row.policy_flags),
    outreachStatus: asOutreachStatus(row.outreach_status),
    activationStatus: asActivationStatus(row.activation_status),
    passportIntegration: { ...EMPTY_PASSPORT_STUB, ...(row.passport_integration as object) },
    iqubeRegistry: { ...EMPTY_IQUBE_REGISTRY_STUB, ...(row.iqube_registry as object) },
    reputation: { ...EMPTY_REPUTATION_STUB, ...(row.reputation as object) },
    revenueTracking: { ...EMPTY_REVENUE_TRACKING, ...(row.revenue_tracking as object) },
    notes: asString(row.notes),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}
