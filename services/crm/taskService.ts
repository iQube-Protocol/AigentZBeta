/**
 * Task Service
 * 
 * Manages task templates, task claims, and the task completion flow.
 * Tasks are the bridge between rewards and reputation systems.
 * 
 * Architecture:
 *   Task → Contribution → Reward Event + Reputation Event
 * 
 * Both reward and reputation systems can function independently,
 * but tasks orchestrate them together when work is task-based.
 */

import { getCrmClient } from './crmDataAccess';
import * as db from './crmDataAccess';
import { accrueStanding } from './standingAccrualService';
import {
  CrmTaskTemplate,
  CrmTaskTemplateRow,
  CrmPersonaReputation,
  CrmPersonaReputationRow,
  CrmReputationEventNew,
  CrmReputationEventNewRow,
  CrmCategoryDefaults,
  CrmCategoryDefaultsRow,
  CrmContribution,
  CrmContributionRow,
  CrmReward,
  CreateTaskTemplateInput,
  TaskCategory,
  ContributionStatus,
  ReputationEventSourceType,
  TokenType,
  TenantId,
  rowToTaskTemplate,
  rowToPersonaReputation,
  rowToReputationEventNew,
  rowToCategoryDefaults,
  rowToContribution,
  calculateCVS,
  calculateReputationDeltas,
  calculateTaskRewards,
} from '@/types/crm';

// ============================================================================
// TASK TEMPLATE OPERATIONS
// ============================================================================

export interface ListTaskTemplatesOptions {
  tenantId: TenantId;
  category?: TaskCategory;
  isActive?: boolean;
  isKnowledgePillar?: boolean;
  isComputePillar?: boolean;
  limit?: number;
  offset?: number;
}

export async function listTaskTemplates(
  options: ListTaskTemplatesOptions
): Promise<CrmTaskTemplate[]> {
  const client = getCrmClient();
  const { tenantId, category, isActive, isKnowledgePillar, isComputePillar, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_task_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (isActive !== undefined) query = query.eq('is_active', isActive);
  if (isKnowledgePillar !== undefined) query = query.eq('is_knowledge_pillar', isKnowledgePillar);
  if (isComputePillar !== undefined) query = query.eq('is_compute_pillar', isComputePillar);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmTaskTemplateRow[]).map(rowToTaskTemplate);
}

export async function getTaskTemplate(
  tenantId: TenantId,
  taskTemplateId: string
): Promise<CrmTaskTemplate | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_task_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', taskTemplateId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToTaskTemplate(data as CrmTaskTemplateRow);
}

export async function getTaskTemplateBySlug(
  tenantId: TenantId,
  slug: string
): Promise<CrmTaskTemplate | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_task_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToTaskTemplate(data as CrmTaskTemplateRow);
}

export async function createTaskTemplate(
  input: CreateTaskTemplateInput
): Promise<CrmTaskTemplate> {
  const client = getCrmClient();

  // Get category defaults if weights not specified
  let defaults: CrmCategoryDefaults | null = null;
  if (
    input.repWeightTechnical === undefined &&
    input.repWeightCreative === undefined &&
    input.repWeightEntrepreneurial === undefined &&
    input.repWeightDataArch === undefined &&
    input.repWeightCommunity === undefined
  ) {
    defaults = await getCategoryDefaults(input.category);
  }

  const insertData = {
    tenant_id: input.tenantId,
    slug: input.slug,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    is_knowledge_pillar: input.isKnowledgePillar ?? true,
    is_compute_pillar: input.isComputePillar ?? false,
    difficulty_level: input.difficultyLevel ?? 3,
    expected_impact_level: input.expectedImpactLevel ?? 3,
    verification_mode: input.verificationMode ?? 'manual',
    verification_config: input.verificationConfig ?? null,
    reward_qct: input.rewardQct ?? 0,
    reward_qoyn: input.rewardQoyn ?? 0,
    reward_knyt: input.rewardKnyt ?? 0,
    rep_weight_technical: input.repWeightTechnical ?? defaults?.defaultRepTechnical ?? 0,
    rep_weight_creative: input.repWeightCreative ?? defaults?.defaultRepCreative ?? 0,
    rep_weight_entrepreneurial: input.repWeightEntrepreneurial ?? defaults?.defaultRepEntrepreneurial ?? 0,
    rep_weight_data_arch: input.repWeightDataArch ?? defaults?.defaultRepDataArch ?? 0,
    rep_weight_community: input.repWeightCommunity ?? defaults?.defaultRepCommunity ?? 0,
    impact_enabled: input.impactEnabled ?? false,
    impact_multiplier_max: input.impactMultiplierMax ?? 3.0,
    impact_lookback_days: input.impactLookbackDays ?? 365,
    max_claims: input.maxClaims ?? null,
    expires_at: input.expiresAt ?? null,
    created_by_persona_id: input.createdByPersonaId ?? null,
  };

  const { data, error } = await client
    .from('crm_task_templates')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return rowToTaskTemplate(data as CrmTaskTemplateRow);
}

export async function updateTaskTemplate(
  tenantId: TenantId,
  taskTemplateId: string,
  updates: Partial<Omit<CreateTaskTemplateInput, 'tenantId' | 'slug'>>
): Promise<CrmTaskTemplate> {
  const client = getCrmClient();

  const updateData: Record<string, unknown> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.isKnowledgePillar !== undefined) updateData.is_knowledge_pillar = updates.isKnowledgePillar;
  if (updates.isComputePillar !== undefined) updateData.is_compute_pillar = updates.isComputePillar;
  if (updates.difficultyLevel !== undefined) updateData.difficulty_level = updates.difficultyLevel;
  if (updates.expectedImpactLevel !== undefined) updateData.expected_impact_level = updates.expectedImpactLevel;
  if (updates.verificationMode !== undefined) updateData.verification_mode = updates.verificationMode;
  if (updates.verificationConfig !== undefined) updateData.verification_config = updates.verificationConfig;
  if (updates.rewardQct !== undefined) updateData.reward_qct = updates.rewardQct;
  if (updates.rewardQoyn !== undefined) updateData.reward_qoyn = updates.rewardQoyn;
  if (updates.rewardKnyt !== undefined) updateData.reward_knyt = updates.rewardKnyt;
  if (updates.repWeightTechnical !== undefined) updateData.rep_weight_technical = updates.repWeightTechnical;
  if (updates.repWeightCreative !== undefined) updateData.rep_weight_creative = updates.repWeightCreative;
  if (updates.repWeightEntrepreneurial !== undefined) updateData.rep_weight_entrepreneurial = updates.repWeightEntrepreneurial;
  if (updates.repWeightDataArch !== undefined) updateData.rep_weight_data_arch = updates.repWeightDataArch;
  if (updates.repWeightCommunity !== undefined) updateData.rep_weight_community = updates.repWeightCommunity;
  if (updates.impactEnabled !== undefined) updateData.impact_enabled = updates.impactEnabled;
  if (updates.impactMultiplierMax !== undefined) updateData.impact_multiplier_max = updates.impactMultiplierMax;
  if (updates.impactLookbackDays !== undefined) updateData.impact_lookback_days = updates.impactLookbackDays;
  if (updates.maxClaims !== undefined) updateData.max_claims = updates.maxClaims;
  if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt;

  const { data, error } = await client
    .from('crm_task_templates')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', taskTemplateId)
    .select()
    .single();

  if (error) throw error;
  return rowToTaskTemplate(data as CrmTaskTemplateRow);
}

export async function deactivateTaskTemplate(
  tenantId: TenantId,
  taskTemplateId: string
): Promise<CrmTaskTemplate> {
  return updateTaskTemplate(tenantId, taskTemplateId, { isKnowledgePillar: false });
}

// ============================================================================
// CATEGORY DEFAULTS
// ============================================================================

export async function getCategoryDefaults(
  category: TaskCategory
): Promise<CrmCategoryDefaults | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_category_defaults')
    .select('*')
    .eq('category', category)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToCategoryDefaults(data as CrmCategoryDefaultsRow);
}

export async function listCategoryDefaults(): Promise<CrmCategoryDefaults[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_category_defaults')
    .select('*')
    .order('category');

  if (error) throw error;
  return (data as CrmCategoryDefaultsRow[]).map(rowToCategoryDefaults);
}

// ============================================================================
// TASK CLAIM & SUBMISSION
// ============================================================================

export interface ClaimTaskInput {
  tenantId: TenantId;
  taskTemplateId: string;
  personaId: string;
  source?: string;
}

export interface ClaimTaskResult {
  contribution: CrmContribution;
  task: CrmTaskTemplate;
}

export interface GetTasksByPersonaInput {
  tenantId: TenantId;
  personaId: string;
  statuses?: ContributionStatus[];
  limit?: number;
  offset?: number;
}

export async function getTasksByPersona(input: GetTasksByPersonaInput): Promise<CrmContribution[]> {
  const client = getCrmClient();
  const { tenantId, personaId, statuses, limit = 50, offset = 0 } = input;

  let query = client
    .from('crm_contributions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('persona_id', personaId)
    .not('task_template_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statuses?.length) {
    query = query.in('status', statuses);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmContributionRow[]).map(rowToContribution);
}

/**
 * Claim a task for a persona
 * Creates a contribution in 'claimed' status
 */
export async function claimTask(input: ClaimTaskInput): Promise<ClaimTaskResult> {
  const client = getCrmClient();
  const { tenantId, taskTemplateId, personaId, source } = input;

  // Get task template
  const task = await getTaskTemplate(tenantId, taskTemplateId);
  if (!task) {
    throw new Error('Task template not found');
  }

  if (!task.isActive) {
    throw new Error('Task is not active');
  }

  if (task.expiresAt && new Date(task.expiresAt) < new Date()) {
    throw new Error('Task has expired');
  }

  if (typeof task.maxClaims === 'number' && task.currentClaims >= task.maxClaims) {
    throw new Error('Task has reached maximum claims');
  }

  // Check if persona already has an active claim on this task
  const { data: existingClaims } = await client
    .from('crm_contributions')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('task_template_id', taskTemplateId)
    .eq('persona_id', personaId)
    .in('status', ['claimed', 'submitted', 'under_review']);

  if (existingClaims && existingClaims.length > 0) {
    throw new Error('Persona already has an active claim on this task');
  }

  // Create contribution with claimed status
  const { data: contribution, error: contribError } = await client
    .from('crm_contributions')
    .insert({
      tenant_id: tenantId,
      persona_id: personaId,
      task_template_id: taskTemplateId,
      contribution_type: task.category,
      status: 'claimed',
      units: 1,
      base_pokw_weight: task.difficultyLevel,
      pokw_score: 0,  // Will be calculated on completion
      source: source ?? 'task_claim',
    })
    .select()
    .single();

  if (contribError) throw contribError;

  // Increment task claim count
  await client
    .from('crm_task_templates')
    .update({ current_claims: task.currentClaims + 1 })
    .eq('id', taskTemplateId);

  // Update persona reputation claimed count
  await incrementTasksClaimed(personaId);

  return {
    contribution: rowToContribution(contribution),
    task,
  };
}

export interface SubmitTaskInput {
  tenantId: TenantId;
  contributionId: string;
  artifactUrl?: string;
  artifactMetadata?: Record<string, unknown>;
  notes?: string;
}

/**
 * Submit work for a claimed task
 * Moves contribution from 'claimed' to 'submitted'
 */
export async function submitTask(input: SubmitTaskInput): Promise<CrmContribution> {
  const client = getCrmClient();
  const { tenantId, contributionId, artifactUrl, artifactMetadata, notes } = input;

  // Get contribution
  const { data: contrib, error: getError } = await client
    .from('crm_contributions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', contributionId)
    .single();

  if (getError) throw getError;
  if (!contrib) throw new Error('Contribution not found');
  if (contrib.status !== 'claimed') {
    throw new Error(`Cannot submit: contribution is in '${contrib.status}' status`);
  }

  // Update to submitted
  const updateData: Record<string, unknown> = {
    status: 'submitted',
  };
  if (artifactUrl) updateData.artifact_url = artifactUrl;
  if (artifactMetadata) updateData.artifact_metadata = artifactMetadata;
  if (notes) {
    // Append to existing notes or create new
    const existingNotes = contrib.notes || '';
    updateData.notes = existingNotes ? `${existingNotes}\n\nSubmission: ${notes}` : notes;
  }

  const { data: updated, error: updateError } = await client
    .from('crm_contributions')
    .update(updateData)
    .eq('id', contributionId)
    .select()
    .single();

  if (updateError) throw updateError;
  return rowToContribution(updated);
}

// ============================================================================
// TASK COMPLETION (THE CORE FLOW)
// ============================================================================

export interface CompleteTaskInput {
  tenantId: TenantId;
  contributionId: string;
  finalScore: number;  // 0-100
  qualityScore?: number;  // 0-100
  trustScore?: number;  // 0-100
  scoringBreakdown?: Record<string, unknown>;
  reviewerPersonaId?: string;
  notes?: string;
}

export interface CompleteTaskResult {
  contribution: CrmContribution;
  task: CrmTaskTemplate;
  rewards: CrmReward[];
  reputationEvent: CrmReputationEventNew;
  reputationDeltas: {
    technical: number;
    creative: number;
    entrepreneurial: number;
    dataArch: number;
    community: number;
    overall: number;
  };
  cvs: number;
}

/**
 * Complete a task - the core orchestration function
 * 
 * This function:
 * 1. Validates the contribution and task
 * 2. Updates contribution with scores and 'accepted' status
 * 3. Calculates CVS (Contribution Value Score)
 * 4. Creates reward events for each token type
 * 5. Calculates reputation deltas from task weights
 * 6. Creates reputation event
 * 7. Updates persona reputation vector
 * 
 * Both rewards and reputation are derived from the same task completion.
 */
export async function completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
  const client = getCrmClient();
  const {
    tenantId,
    contributionId,
    finalScore,
    qualityScore,
    trustScore,
    scoringBreakdown,
    reviewerPersonaId,
    notes,
  } = input;

  // Validate score
  if (finalScore < 0 || finalScore > 100) {
    throw new Error('Final score must be between 0 and 100');
  }

  // 1. Get contribution
  const { data: contrib, error: getError } = await client
    .from('crm_contributions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', contributionId)
    .single();

  if (getError) throw getError;
  if (!contrib) throw new Error('Contribution not found');
  if (!contrib.task_template_id) throw new Error('Contribution is not task-based');
  if (!['submitted', 'under_review'].includes(contrib.status)) {
    throw new Error(`Cannot complete: contribution is in '${contrib.status}' status`);
  }

  // 2. Get task template
  const task = await getTaskTemplate(tenantId, contrib.task_template_id);
  if (!task) throw new Error('Task template not found');

  // 3. Calculate PoKW score
  const pokwScore = (finalScore / 100) * task.difficultyLevel * contrib.units;

  // 4. Update contribution with scores and accepted status
  const updateData: Record<string, unknown> = {
    status: 'accepted',
    final_score: finalScore,
    pokw_score: pokwScore,
    reviewed_at: new Date().toISOString(),
  };
  if (qualityScore !== undefined) updateData.quality_score = qualityScore;
  if (trustScore !== undefined) updateData.trust_score = trustScore;
  if (scoringBreakdown) updateData.scoring_breakdown = scoringBreakdown;
  if (reviewerPersonaId) updateData.reviewed_by_persona_id = reviewerPersonaId;

  const { data: updatedContrib, error: updateError } = await client
    .from('crm_contributions')
    .update(updateData)
    .eq('id', contributionId)
    .select()
    .single();

  if (updateError) throw updateError;

  // 5. Calculate CVS
  const cvs = calculateCVS(finalScore, task.expectedImpactLevel);

  // 6. Calculate reward amounts
  const rewardAmounts = calculateTaskRewards(task, finalScore);

  // 7. Create rewards for each non-zero token type
  const rewards: CrmReward[] = [];
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 30);  // Last 30 days
  const periodEnd = new Date();

  for (const [tokenType, amount] of Object.entries(rewardAmounts)) {
    if (amount > 0) {
      const reward = await db.createReward({
        tenantId,
        personaId: contrib.persona_id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        pokwScoreUsed: pokwScore,
        tokenType: tokenType.toUpperCase() as TokenType,
        amount,
        status: 'draft',  // Needs approval before distribution
        notes: `Task completion: ${task.title} (score: ${finalScore})`,
      });

      // Update reward with task reference
      await client
        .from('crm_rewards')
        .update({
          task_template_id: task.id,
          contribution_id: contributionId,
          pillar: task.isKnowledgePillar ? 'knowledge' : 'compute',
        })
        .eq('id', reward.id);

      rewards.push(reward);
    }
  }

  // 8. Calculate reputation deltas
  const repDeltas = calculateReputationDeltas(cvs, {
    technical: task.repWeightTechnical,
    creative: task.repWeightCreative,
    entrepreneurial: task.repWeightEntrepreneurial,
    dataArch: task.repWeightDataArch,
    community: task.repWeightCommunity,
  });

  // 9. Create reputation event
  const repEvent = await createReputationEvent({
    tenantId,
    personaId: contrib.persona_id,
    sourceType: 'task_completion',
    sourceId: contributionId,
    deltaTechnical: repDeltas.deltaTechnical,
    deltaCreative: repDeltas.deltaCreative,
    deltaEntrepreneurial: repDeltas.deltaEntrepreneurial,
    deltaDataArch: repDeltas.deltaDataArch,
    deltaCommunity: repDeltas.deltaCommunity,
    deltaOverall: repDeltas.deltaOverall,
    cvs,
    taskTemplateId: task.id,
    finalScoreSnapshot: finalScore,
    reason: `Completed task: ${task.title} (score: ${finalScore}, CVS: ${cvs.toFixed(2)})`,
    createdByPersonaId: reviewerPersonaId,
  });

  // 10. Update persona reputation vector
  await updatePersonaReputation(contrib.persona_id, repDeltas, cvs);

  // 10b. Standing accrual (Phase 2 keystone + Phase 3 capacity credit) — runs
  // synchronously alongside reputation accrual; never fails the task
  // completion. Sponsor is auto-resolved via the identity spine; when the
  // contributor's standing_overall crosses the threshold, the sponsor's
  // sponsorship_capacity_earned is incremented.
  await accrueStanding({
    crmPersonaId: contrib.persona_id,
    cvs,
    standingType:
      (task as unknown as { standingType?: 'personal' | 'delegated' | 'stewardship' }).standingType ?? 'personal',
    sourceEventId: repEvent?.id ?? null,
  });

  return {
    contribution: rowToContribution(updatedContrib),
    task,
    rewards,
    reputationEvent: repEvent,
    reputationDeltas: {
      technical: repDeltas.deltaTechnical,
      creative: repDeltas.deltaCreative,
      entrepreneurial: repDeltas.deltaEntrepreneurial,
      dataArch: repDeltas.deltaDataArch,
      community: repDeltas.deltaCommunity,
      overall: repDeltas.deltaOverall,
    },
    cvs,
  };
}

/**
 * Reject a task submission
 */
export async function rejectTask(
  tenantId: TenantId,
  contributionId: string,
  reason: string,
  reviewerPersonaId?: string
): Promise<CrmContribution> {
  const client = getCrmClient();

  const { data: updated, error } = await client
    .from('crm_contributions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by_persona_id: reviewerPersonaId ?? null,
      scoring_breakdown: { rejection_reason: reason },
    })
    .eq('tenant_id', tenantId)
    .eq('id', contributionId)
    .select()
    .single();

  if (error) throw error;
  return rowToContribution(updated);
}

// ============================================================================
// PERSONA REPUTATION OPERATIONS
// ============================================================================

export async function getPersonaReputation(
  personaId: string
): Promise<CrmPersonaReputation | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_persona_reputation')
    .select('*')
    .eq('persona_id', personaId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToPersonaReputation(data as CrmPersonaReputationRow);
}

export async function updatePersonaReputation(
  personaId: string,
  deltas: {
    deltaTechnical: number;
    deltaCreative: number;
    deltaEntrepreneurial: number;
    deltaDataArch: number;
    deltaCommunity: number;
    deltaOverall: number;
  },
  cvs: number
): Promise<void> {
  const client = getCrmClient();

  // Try to get existing reputation
  const existing = await getPersonaReputation(personaId);

  if (existing) {
    // Update existing
    await client
      .from('crm_persona_reputation')
      .update({
        rep_technical: existing.repTechnical + deltas.deltaTechnical,
        rep_creative: existing.repCreative + deltas.deltaCreative,
        rep_entrepreneurial: existing.repEntrepreneurial + deltas.deltaEntrepreneurial,
        rep_data_arch: existing.repDataArch + deltas.deltaDataArch,
        rep_community: existing.repCommunity + deltas.deltaCommunity,
        rep_overall: existing.repOverall + deltas.deltaOverall,
        lifetime_cvs: existing.lifetimeCvs + cvs,
        total_tasks_completed: existing.totalTasksCompleted + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('persona_id', personaId);
  } else {
    // Create new
    await client
      .from('crm_persona_reputation')
      .insert({
        persona_id: personaId,
        rep_technical: deltas.deltaTechnical,
        rep_creative: deltas.deltaCreative,
        rep_entrepreneurial: deltas.deltaEntrepreneurial,
        rep_data_arch: deltas.deltaDataArch,
        rep_community: deltas.deltaCommunity,
        rep_overall: deltas.deltaOverall,
        lifetime_cvs: cvs,
        total_tasks_completed: 1,
        total_tasks_claimed: 1,
      });
  }
}

async function incrementTasksClaimed(personaId: string): Promise<void> {
  const client = getCrmClient();

  const existing = await getPersonaReputation(personaId);

  if (existing) {
    await client
      .from('crm_persona_reputation')
      .update({
        total_tasks_claimed: existing.totalTasksClaimed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('persona_id', personaId);
  } else {
    await client
      .from('crm_persona_reputation')
      .insert({
        persona_id: personaId,
        total_tasks_claimed: 1,
      });
  }
}

// ============================================================================
// REPUTATION EVENT OPERATIONS
// ============================================================================

export interface CreateReputationEventInput {
  tenantId: TenantId;
  personaId: string;
  sourceType: ReputationEventSourceType;
  sourceId?: string;
  deltaTechnical?: number;
  deltaCreative?: number;
  deltaEntrepreneurial?: number;
  deltaDataArch?: number;
  deltaCommunity?: number;
  deltaOverall?: number;
  cvs?: number;
  taskTemplateId?: string;
  finalScoreSnapshot?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdByPersonaId?: string;
}

export async function createReputationEvent(
  input: CreateReputationEventInput
): Promise<CrmReputationEventNew> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_reputation_events')
    .insert({
      tenant_id: input.tenantId,
      persona_id: input.personaId,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      delta_technical: input.deltaTechnical ?? 0,
      delta_creative: input.deltaCreative ?? 0,
      delta_entrepreneurial: input.deltaEntrepreneurial ?? 0,
      delta_data_arch: input.deltaDataArch ?? 0,
      delta_community: input.deltaCommunity ?? 0,
      delta_overall: input.deltaOverall ?? 0,
      cvs: input.cvs ?? null,
      task_template_id: input.taskTemplateId ?? null,
      final_score_snapshot: input.finalScoreSnapshot ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
      created_by_persona_id: input.createdByPersonaId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToReputationEventNew(data as CrmReputationEventNewRow);
}

export interface ListReputationEventsOptions {
  tenantId?: TenantId;
  personaId?: string;
  sourceType?: ReputationEventSourceType;
  limit?: number;
  offset?: number;
}

export async function listReputationEvents(
  options: ListReputationEventsOptions
): Promise<CrmReputationEventNew[]> {
  const client = getCrmClient();
  const { tenantId, personaId, sourceType, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_reputation_events')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantId) query = query.eq('tenant_id', tenantId);
  if (personaId) query = query.eq('persona_id', personaId);
  if (sourceType) query = query.eq('source_type', sourceType);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmReputationEventNewRow[]).map(rowToReputationEventNew);
}

/**
 * Get the latest reputation event for a persona
 */
export async function getLatestReputationEvent(
  personaId: string
): Promise<CrmReputationEventNew | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_reputation_events')
    .select('*')
    .eq('persona_id', personaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return rowToReputationEventNew(data as CrmReputationEventNewRow);
}

// ============================================================================
// MANUAL ATTESTATION (Non-task reputation changes)
// ============================================================================

export interface ManualAttestationInput {
  tenantId: TenantId;
  personaId: string;
  deltaTechnical?: number;
  deltaCreative?: number;
  deltaEntrepreneurial?: number;
  deltaDataArch?: number;
  deltaCommunity?: number;
  reason: string;
  createdByPersonaId?: string;
}

/**
 * Create a manual attestation (reputation change without a task)
 * Used for external verifications, peer attestations, corrections, etc.
 */
export async function createManualAttestation(
  input: ManualAttestationInput
): Promise<CrmReputationEventNew> {
  const deltaOverall = 
    (input.deltaTechnical ?? 0) +
    (input.deltaCreative ?? 0) +
    (input.deltaEntrepreneurial ?? 0) +
    (input.deltaDataArch ?? 0) +
    (input.deltaCommunity ?? 0);

  // Create reputation event
  const repEvent = await createReputationEvent({
    tenantId: input.tenantId,
    personaId: input.personaId,
    sourceType: 'manual_attestation',
    deltaTechnical: input.deltaTechnical ?? 0,
    deltaCreative: input.deltaCreative ?? 0,
    deltaEntrepreneurial: input.deltaEntrepreneurial ?? 0,
    deltaDataArch: input.deltaDataArch ?? 0,
    deltaCommunity: input.deltaCommunity ?? 0,
    deltaOverall,
    reason: input.reason,
    createdByPersonaId: input.createdByPersonaId,
  });

  // Update persona reputation
  await updatePersonaReputation(
    input.personaId,
    {
      deltaTechnical: input.deltaTechnical ?? 0,
      deltaCreative: input.deltaCreative ?? 0,
      deltaEntrepreneurial: input.deltaEntrepreneurial ?? 0,
      deltaDataArch: input.deltaDataArch ?? 0,
      deltaCommunity: input.deltaCommunity ?? 0,
      deltaOverall,
    },
    0  // No CVS for manual attestations
  );

  return repEvent;
}

// ============================================================================
// TASK STATISTICS
// ============================================================================

export interface TaskStats {
  totalTasks: number;
  activeTasks: number;
  totalClaims: number;
  totalCompletions: number;
  byCategory: Record<TaskCategory, number>;
}

export async function getTaskStats(tenantId: TenantId): Promise<TaskStats> {
  const client = getCrmClient();

  // Get task counts
  const { data: tasks } = await client
    .from('crm_task_templates')
    .select('id, category, is_active, current_claims')
    .eq('tenant_id', tenantId);

  // Get completion counts
  const { data: completions } = await client
    .from('crm_contributions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'accepted')
    .not('task_template_id', 'is', null);

  const byCategory: Record<TaskCategory, number> = {
    technical: 0,
    creative: 0,
    entrepreneurial: 0,
    data: 0,
    iqube_design: 0,
    community: 0,
  };

  let activeTasks = 0;
  let totalClaims = 0;

  for (const task of tasks || []) {
    byCategory[task.category as TaskCategory]++;
    if (task.is_active) activeTasks++;
    totalClaims += task.current_claims || 0;
  }

  return {
    totalTasks: tasks?.length || 0,
    activeTasks,
    totalClaims,
    totalCompletions: completions?.length || 0,
    byCategory,
  };
}

// Service export for API routes
export const taskService = {
  // Task template operations
  createTaskTemplate,
  updateTaskTemplate,
  getTaskTemplate,
  listTaskTemplates,
  
  getTasksByPersona,
  
  claimTask,
  submitTask,
  completeTask,
  
  // Stats
  getTaskStats,
};
