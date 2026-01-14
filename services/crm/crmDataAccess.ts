/**
 * AgentiQ CRM Data Access Layer
 * 
 * Provides typed database operations for CRM tables.
 * Uses Supabase client with service role for backend operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CrmPersona,
  CrmContribution,
  CrmEngagementEvent,
  CrmEntitlement,
  CrmReward,
  CrmSegment,
  CrmSegmentMember,
  CrmFranchise,
  CrmTenant,
  CrmAuthProfile,
  CrmWalletEvent,
  CrmReputationEvent,
  CrmAuditLog,
  CrmCopilotHistory,
  CrmPlatformAccount,
  CrmPlatformFranchiseAccess,
  CrmRegistryProfile,
  CrmRegistryPersonaLink,
  CrmAdminCategory,
  CrmAdminRole,
  CrmAdminRoleExpanded,
  AdminPermissions,
  CrmPersonaRow,
  CrmContributionRow,
  CrmEngagementEventRow,
  CrmEntitlementRow,
  CrmRewardRow,
  CrmSegmentRow,
  CrmSegmentMemberRow,
  CrmFranchiseRow,
  CrmTenantRow,
  CrmAuthProfileRow,
  CrmWalletEventRow,
  CrmReputationEventRow,
  CrmAuditLogRow,
  CrmPlatformAccountRow,
  CrmPlatformFranchiseAccessRow,
  CrmRegistryProfileRow,
  CrmRegistryPersonaLinkRow,
  CrmAdminCategoryRow,
  CrmAdminRoleRow,
  CrmAdminRoleExpandedRow,
  rowToPersona,
  rowToContribution,
  rowToEngagementEvent,
  rowToEntitlement,
  rowToReward,
  rowToSegment,
  rowToFranchise,
  rowToTenant,
  rowToAuthProfile,
  rowToWalletEvent,
  rowToReputationEvent,
  rowToAuditLog,
  rowToPlatformAccount,
  rowToPlatformFranchiseAccess,
  rowToRegistryProfile,
  rowToRegistryPersonaLink,
  rowToAdminCategory,
  rowToAdminRole,
  rowToAdminRoleExpanded,
  DEFAULT_ADMIN_PERMISSIONS,
  UBER_ADMIN_PERMISSIONS,
  TenantId,
  PersonaState,
  Modality,
  AccessLevel,
  EntitlementOrigin,
  TokenType,
  RewardStatus,
  ReputationBucket,
  WalletEventType,
  WalletEventStatus,
  ReputationEventType,
  PlatformAccountType,
  PrivacyLevel,
  VisibilityLevel,
  OriginLayer,
  PlatformFranchiseRole,
  AdminRoleType,
  AdminCategorySlug,
} from '@/types/crm';

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client for CRM operations
 * Uses service role key for backend operations (bypasses RLS)
 */
export function getCrmClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('[CRM] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  supabaseClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

/**
 * Check if CRM database is configured
 */
export function isCrmConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return !!(url && key);
}

// ============================================================================
// PERSONA OPERATIONS
// ============================================================================

export interface ListPersonasOptions {
  tenantId: TenantId;
  limit?: number;
  offset?: number;
  personaState?: PersonaState;
  search?: string;
}

export async function listPersonas(options: ListPersonasOptions): Promise<CrmPersona[]> {
  const client = getCrmClient();
  const { tenantId, limit = 50, offset = 0, personaState, search } = options;

  let query = client
    .from('crm_personas')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaState) {
    query = query.eq('persona_state', personaState);
  }

  if (search) {
    query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmPersonaRow[]).map(rowToPersona);
}

export async function getPersona(tenantId: TenantId, personaId: string): Promise<CrmPersona | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_personas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', personaId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return rowToPersona(data as CrmPersonaRow);
}

export interface CreatePersonaData {
  tenantId: TenantId;
  kybeDid?: string;
  rootDidProxyId?: string;
  personaState?: PersonaState;
  externalUserId?: string;
  displayName?: string;
  email?: string;
  personaDataqubeId?: string;
}

export async function createPersona(data: CreatePersonaData): Promise<CrmPersona> {
  const client = getCrmClient();

  const { data: row, error } = await client
    .from('crm_personas')
    .insert({
      tenant_id: data.tenantId,
      kybe_did: data.kybeDid ?? null,
      root_did_proxy_id: data.rootDidProxyId ?? null,
      persona_state: data.personaState ?? 'pseudonymous',
      external_user_id: data.externalUserId ?? null,
      display_name: data.displayName ?? null,
      email: data.email ?? null,
      persona_dataqube_id: data.personaDataqubeId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToPersona(row as CrmPersonaRow);
}

export async function updatePersona(
  tenantId: TenantId,
  personaId: string,
  updates: Partial<Omit<CreatePersonaData, 'tenantId'>>
): Promise<CrmPersona> {
  const client = getCrmClient();

  const updateData: Record<string, unknown> = {};
  if (updates.kybeDid !== undefined) updateData.kybe_did = updates.kybeDid;
  if (updates.rootDidProxyId !== undefined) updateData.root_did_proxy_id = updates.rootDidProxyId;
  if (updates.personaState !== undefined) updateData.persona_state = updates.personaState;
  if (updates.externalUserId !== undefined) updateData.external_user_id = updates.externalUserId;
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.personaDataqubeId !== undefined) updateData.persona_dataqube_id = updates.personaDataqubeId;

  const { data: row, error } = await client
    .from('crm_personas')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', personaId)
    .select()
    .single();

  if (error) throw error;
  return rowToPersona(row as CrmPersonaRow);
}

// ============================================================================
// CONTRIBUTION OPERATIONS
// ============================================================================

export interface ListContributionsOptions {
  tenantId: TenantId;
  personaId?: string;
  clusterqubeId?: string;
  contributionType?: string;
  periodStart?: string;
  periodEnd?: string;
  status?: string;
  hasTask?: boolean;
  limit?: number;
  offset?: number;
}

export async function listContributions(options: ListContributionsOptions): Promise<CrmContribution[]> {
  const client = getCrmClient();
  const { tenantId, personaId, clusterqubeId, contributionType, periodStart, periodEnd, status, hasTask, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_contributions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaId) query = query.eq('persona_id', personaId);
  if (clusterqubeId) query = query.eq('clusterqube_id', clusterqubeId);
  if (contributionType) query = query.eq('contribution_type', contributionType);
  if (periodStart) query = query.gte('created_at', periodStart);
  if (periodEnd) query = query.lte('created_at', periodEnd);
  if (status) query = query.eq('status', status);
  if (hasTask === true) query = query.not('task_template_id', 'is', null);
  if (hasTask === false) query = query.is('task_template_id', null);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmContributionRow[]).map(rowToContribution);
}

export interface CreateContributionData {
  tenantId: TenantId;
  personaId: string;
  qubeId?: string;
  clusterqubeId?: string;
  contributionType: string;
  units: number;
  basePokwWeight: number;
  pokwScore: number;
  source?: string;
}

export async function createContribution(data: CreateContributionData): Promise<CrmContribution> {
  const client = getCrmClient();

  const { data: row, error } = await client
    .from('crm_contributions')
    .insert({
      tenant_id: data.tenantId,
      persona_id: data.personaId,
      qube_id: data.qubeId ?? null,
      clusterqube_id: data.clusterqubeId ?? null,
      contribution_type: data.contributionType,
      units: data.units,
      base_pokw_weight: data.basePokwWeight,
      pokw_score: data.pokwScore,
      source: data.source ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToContribution(row as CrmContributionRow);
}

// ============================================================================
// ENGAGEMENT EVENT OPERATIONS
// ============================================================================

export interface ListEngagementEventsOptions {
  tenantId: TenantId;
  personaId?: string;
  clusterqubeId?: string;
  eventType?: string;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  offset?: number;
}

export async function listEngagementEvents(options: ListEngagementEventsOptions): Promise<CrmEngagementEvent[]> {
  const client = getCrmClient();
  const { tenantId, personaId, clusterqubeId, eventType, periodStart, periodEnd, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_engagement_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaId) query = query.eq('persona_id', personaId);
  if (clusterqubeId) query = query.eq('clusterqube_id', clusterqubeId);
  if (eventType) query = query.eq('event_type', eventType);
  if (periodStart) query = query.gte('created_at', periodStart);
  if (periodEnd) query = query.lte('created_at', periodEnd);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmEngagementEventRow[]).map(rowToEngagementEvent);
}

export interface CreateEngagementEventData {
  tenantId: TenantId;
  personaId: string;
  qubeId?: string;
  clusterqubeId?: string;
  eventType: string;
  weight: number;
  pokwDelta: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export async function createEngagementEvent(data: CreateEngagementEventData): Promise<CrmEngagementEvent> {
  const client = getCrmClient();

  const { data: row, error } = await client
    .from('crm_engagement_events')
    .insert({
      tenant_id: data.tenantId,
      persona_id: data.personaId,
      qube_id: data.qubeId ?? null,
      clusterqube_id: data.clusterqubeId ?? null,
      event_type: data.eventType,
      weight: data.weight,
      pokw_delta: data.pokwDelta,
      source: data.source ?? null,
      metadata: data.metadata ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToEngagementEvent(row as CrmEngagementEventRow);
}

// ============================================================================
// ENTITLEMENT OPERATIONS
// ============================================================================

export interface ListEntitlementsOptions {
  tenantId: TenantId;
  personaId?: string;
  clusterqubeId?: string;
  modality?: Modality;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

export async function listEntitlements(options: ListEntitlementsOptions): Promise<CrmEntitlement[]> {
  const client = getCrmClient();
  const { tenantId, personaId, clusterqubeId, modality, includeExpired = false, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_entitlements')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaId) query = query.eq('persona_id', personaId);
  if (clusterqubeId) query = query.eq('clusterqube_id', clusterqubeId);
  if (modality) query = query.eq('modality', modality);
  if (!includeExpired) {
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmEntitlementRow[]).map(rowToEntitlement);
}

export async function getEntitlement(tenantId: TenantId, entitlementId: string): Promise<CrmEntitlement | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_entitlements')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', entitlementId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToEntitlement(data as CrmEntitlementRow);
}

export interface CreateEntitlementData {
  tenantId: TenantId;
  personaId: string;
  clusterqubeId: string;
  qubeId?: string;
  modality: Modality;
  accessLevel?: AccessLevel;
  origin?: EntitlementOrigin;
  expiresAt?: string;
}

export async function createEntitlement(data: CreateEntitlementData): Promise<CrmEntitlement> {
  const client = getCrmClient();

  const { data: row, error } = await client
    .from('crm_entitlements')
    .insert({
      tenant_id: data.tenantId,
      persona_id: data.personaId,
      clusterqube_id: data.clusterqubeId,
      qube_id: data.qubeId ?? null,
      modality: data.modality,
      access_level: data.accessLevel ?? 'full',
      origin: data.origin ?? 'manual',
      expires_at: data.expiresAt ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToEntitlement(row as CrmEntitlementRow);
}

export interface UpdateEntitlementData {
  accessLevel?: AccessLevel;
  origin?: EntitlementOrigin;
  expiresAt?: string | null;
}

export async function updateEntitlement(
  tenantId: TenantId,
  entitlementId: string,
  updates: UpdateEntitlementData
): Promise<CrmEntitlement> {
  const client = getCrmClient();

  const updateData: Record<string, unknown> = {};
  if (updates.accessLevel !== undefined) updateData.access_level = updates.accessLevel;
  if (updates.origin !== undefined) updateData.origin = updates.origin;
  if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt;

  const { data: row, error } = await client
    .from('crm_entitlements')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', entitlementId)
    .select()
    .single();

  if (error) throw error;
  return rowToEntitlement(row as CrmEntitlementRow);
}

// ============================================================================
// REWARD OPERATIONS
// ============================================================================

export interface ListRewardsOptions {
  tenantId: TenantId;
  personaId?: string;
  status?: RewardStatus;
  tokenType?: TokenType;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  offset?: number;
}

export async function listRewards(options: ListRewardsOptions): Promise<CrmReward[]> {
  const client = getCrmClient();
  const { tenantId, personaId, status, tokenType, periodStart, periodEnd, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_rewards')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaId) query = query.eq('persona_id', personaId);
  if (status) query = query.eq('status', status);
  if (tokenType) query = query.eq('token_type', tokenType);
  if (periodStart) query = query.gte('period_start', periodStart);
  if (periodEnd) query = query.lte('period_end', periodEnd);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmRewardRow[]).map(rowToReward);
}

export async function getReward(tenantId: TenantId, rewardId: string): Promise<CrmReward | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_rewards')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', rewardId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToReward(data as CrmRewardRow);
}

export interface CreateRewardData {
  tenantId: TenantId;
  personaId: string;
  periodStart: string;
  periodEnd: string;
  pokwScoreUsed: number;
  tokenType: TokenType;
  amount: number;
  status?: RewardStatus;
  notes?: string;
}

export async function createReward(data: CreateRewardData): Promise<CrmReward> {
  const client = getCrmClient();

  const { data: row, error } = await client
    .from('crm_rewards')
    .insert({
      tenant_id: data.tenantId,
      persona_id: data.personaId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      pokw_score_used: data.pokwScoreUsed,
      token_type: data.tokenType,
      amount: data.amount,
      status: data.status ?? 'draft',
      notes: data.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToReward(row as CrmRewardRow);
}

export interface UpdateRewardData {
  status?: RewardStatus;
  txHash?: string;
  chainId?: string;
  notes?: string;
}

export async function updateReward(
  tenantId: TenantId,
  rewardId: string,
  updates: UpdateRewardData
): Promise<CrmReward> {
  const client = getCrmClient();

  const updateData: Record<string, unknown> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.txHash !== undefined) updateData.tx_hash = updates.txHash;
  if (updates.chainId !== undefined) updateData.chain_id = updates.chainId;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data: row, error } = await client
    .from('crm_rewards')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', rewardId)
    .select()
    .single();

  if (error) throw error;
  return rowToReward(row as CrmRewardRow);
}

export async function createRewardsBatch(rewards: CreateRewardData[]): Promise<CrmReward[]> {
  const client = getCrmClient();

  const insertData = rewards.map(data => ({
    tenant_id: data.tenantId,
    persona_id: data.personaId,
    period_start: data.periodStart,
    period_end: data.periodEnd,
    pokw_score_used: data.pokwScoreUsed,
    token_type: data.tokenType,
    amount: data.amount,
    status: data.status ?? 'draft',
    notes: data.notes ?? null,
  }));

  const { data: rows, error } = await client
    .from('crm_rewards')
    .insert(insertData)
    .select();

  if (error) throw error;
  return (rows as CrmRewardRow[]).map(rowToReward);
}

// ============================================================================
// SEGMENT OPERATIONS
// ============================================================================

export interface ListSegmentsOptions {
  tenantId: TenantId;
  limit?: number;
  offset?: number;
}

export async function listSegments(options: ListSegmentsOptions): Promise<CrmSegment[]> {
  const client = getCrmClient();
  const { tenantId, limit = 50, offset = 0 } = options;

  const { data, error } = await client
    .from('crm_segments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data as CrmSegmentRow[]).map(rowToSegment);
}

export async function getSegment(tenantId: TenantId, segmentId: string): Promise<CrmSegment | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_segments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', segmentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToSegment(data as CrmSegmentRow);
}

export interface CreateSegmentData {
  tenantId: TenantId;
  name: string;
  description?: string;
  ruleDefinition?: Record<string, unknown>;
  isDynamic?: boolean;
}

export async function createSegment(data: CreateSegmentData): Promise<CrmSegment> {
  const client = getCrmClient();

  const { data: row, error } = await client
    .from('crm_segments')
    .insert({
      tenant_id: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      rule_definition: data.ruleDefinition ?? null,
      is_dynamic: data.isDynamic ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToSegment(row as CrmSegmentRow);
}

export async function addSegmentMember(segmentId: string, personaId: string): Promise<CrmSegmentMember> {
  const client = getCrmClient();

  const { data: row, error } = await client
    .from('crm_segment_members')
    .insert({
      segment_id: segmentId,
      persona_id: personaId,
    })
    .select()
    .single();

  if (error) throw error;
  const memberRow = row as CrmSegmentMemberRow;
  return {
    id: memberRow.id,
    segmentId: memberRow.segment_id,
    personaId: memberRow.persona_id,
    createdAt: memberRow.created_at,
  };
}

export async function removeSegmentMember(segmentId: string, personaId: string): Promise<void> {
  const client = getCrmClient();

  const { error } = await client
    .from('crm_segment_members')
    .delete()
    .eq('segment_id', segmentId)
    .eq('persona_id', personaId);

  if (error) throw error;
}

export async function getSegmentMembers(segmentId: string): Promise<string[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_segment_members')
    .select('persona_id')
    .eq('segment_id', segmentId);

  if (error) throw error;
  return (data as { persona_id: string }[]).map(row => row.persona_id);
}

// ============================================================================
// AGGREGATION QUERIES
// ============================================================================

export interface PokwTotalResult {
  total: number;
  contributionTotal: number;
  engagementTotal: number;
}

/**
 * Get total PoKW for a persona within an optional period
 */
export async function getPersonaPokwTotal(
  tenantId: TenantId,
  personaId: string,
  periodStart?: string,
  periodEnd?: string
): Promise<PokwTotalResult> {
  const client = getCrmClient();

  // Get contribution PoKW
  let contribQuery = client
    .from('crm_contributions')
    .select('pokw_score')
    .eq('tenant_id', tenantId)
    .eq('persona_id', personaId);

  if (periodStart) contribQuery = contribQuery.gte('created_at', periodStart);
  if (periodEnd) contribQuery = contribQuery.lte('created_at', periodEnd);

  const { data: contribData, error: contribError } = await contribQuery;
  if (contribError) throw contribError;

  const contributionTotal = (contribData as { pokw_score: number }[])
    .reduce((sum, row) => sum + Number(row.pokw_score), 0);

  // Get engagement PoKW
  let engageQuery = client
    .from('crm_engagement_events')
    .select('pokw_delta')
    .eq('tenant_id', tenantId)
    .eq('persona_id', personaId);

  if (periodStart) engageQuery = engageQuery.gte('created_at', periodStart);
  if (periodEnd) engageQuery = engageQuery.lte('created_at', periodEnd);

  const { data: engageData, error: engageError } = await engageQuery;
  if (engageError) throw engageError;

  const engagementTotal = (engageData as { pokw_delta: number }[])
    .reduce((sum, row) => sum + Number(row.pokw_delta), 0);

  return {
    total: contributionTotal + engagementTotal,
    contributionTotal,
    engagementTotal,
  };
}

export interface TopContributorRow {
  personaId: string;
  displayName: string | null;
  totalPokw: number;
  contributionCount: number;
  engagementCount: number;
}

/**
 * Get top contributors for a tenant within a period
 */
export async function getTopContributors(
  tenantId: TenantId,
  periodStart: string,
  periodEnd: string,
  limit: number = 10
): Promise<TopContributorRow[]> {
  const client = getCrmClient();

  // Get contribution totals per persona
  const { data: contribData, error: contribError } = await client
    .from('crm_contributions')
    .select('persona_id, pokw_score')
    .eq('tenant_id', tenantId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  if (contribError) throw contribError;

  // Get engagement totals per persona
  const { data: engageData, error: engageError } = await client
    .from('crm_engagement_events')
    .select('persona_id, pokw_delta')
    .eq('tenant_id', tenantId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  if (engageError) throw engageError;

  // Aggregate by persona
  const personaScores: Map<string, { pokw: number; contribCount: number; engageCount: number }> = new Map();

  for (const row of contribData as { persona_id: string; pokw_score: number }[]) {
    const existing = personaScores.get(row.persona_id) || { pokw: 0, contribCount: 0, engageCount: 0 };
    existing.pokw += Number(row.pokw_score);
    existing.contribCount += 1;
    personaScores.set(row.persona_id, existing);
  }

  for (const row of engageData as { persona_id: string; pokw_delta: number }[]) {
    const existing = personaScores.get(row.persona_id) || { pokw: 0, contribCount: 0, engageCount: 0 };
    existing.pokw += Number(row.pokw_delta);
    existing.engageCount += 1;
    personaScores.set(row.persona_id, existing);
  }

  // Sort by PoKW and take top N
  const sorted = Array.from(personaScores.entries())
    .sort((a, b) => b[1].pokw - a[1].pokw)
    .slice(0, limit);

  // Fetch persona details
  const personaIds = sorted.map(([id]) => id);
  const { data: personas, error: personaError } = await client
    .from('crm_personas')
    .select('id, display_name')
    .in('id', personaIds);

  if (personaError) throw personaError;

  const personaMap = new Map((personas as { id: string; display_name: string | null }[])
    .map(p => [p.id, p.display_name]));

  return sorted.map(([personaId, scores]) => ({
    personaId,
    displayName: personaMap.get(personaId) ?? null,
    totalPokw: scores.pokw,
    contributionCount: scores.contribCount,
    engagementCount: scores.engageCount,
  }));
}

// ============================================================================
// FRANCHISE OPERATIONS
// ============================================================================

export interface ListFranchisesOptions {
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listFranchises(options: ListFranchisesOptions = {}): Promise<CrmFranchise[]> {
  const client = getCrmClient();
  const { activeOnly = true, limit = 50, offset = 0 } = options;

  // Query the main 'franchises' table (same as Copilot) for consistency
  let query = client
    .from('franchises')
    .select('*')
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Map from franchises table format to CrmFranchise format
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    config: row.config || { chains: row.chains || [], websiteUrl: row.website_url },
    isActive: row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getFranchise(idOrSlug: string): Promise<CrmFranchise | null> {
  const client = getCrmClient();

  // Query the main 'franchises' table (same as Copilot)
  // Try by ID first
  let { data, error } = await client
    .from('franchises')
    .select('*')
    .eq('id', idOrSlug)
    .single();

  if (error?.code === 'PGRST116') {
    // Not found by ID, try by slug
    const result = await client
      .from('franchises')
      .select('*')
      .eq('slug', idOrSlug)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  // Map from franchises table format to CrmFranchise format
  const row = data as any;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    config: row.config || { chains: row.chains || [], websiteUrl: row.website_url },
    isActive: row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// TENANT OPERATIONS
// ============================================================================

export interface ListTenantsOptions {
  franchiseId?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listTenants(options: ListTenantsOptions = {}): Promise<CrmTenant[]> {
  const client = getCrmClient();
  const { franchiseId, activeOnly = true, limit = 50, offset = 0 } = options;

  // Query the main 'tenants' table (same as Copilot) for consistency
  let query = client
    .from('tenants')
    .select('*')
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (franchiseId) {
    query = query.eq('franchise_id', franchiseId);
  }

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Map from tenants table format to CrmTenant format
  return (data || []).map((row: any) => ({
    id: row.id,
    franchiseId: row.franchise_id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    domain: row.domain,
    config: row.config || { chains: row.chains || [] },
    supportedTokens: row.supported_tokens || ['QCT'],
    defaultModalities: row.default_modalities || ['content'],
    isActive: row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getTenant(idOrSlug: string): Promise<CrmTenant | null> {
  const client = getCrmClient();

  // Query the main 'tenants' table (same as Copilot)
  // Try by ID first
  let { data, error } = await client
    .from('tenants')
    .select('*')
    .eq('id', idOrSlug)
    .single();

  if (error?.code === 'PGRST116') {
    // Not found by ID, try by slug
    const result = await client
      .from('tenants')
      .select('*')
      .eq('slug', idOrSlug)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  // Map from tenants table format to CrmTenant format
  const row = data as any;
  return {
    id: row.id,
    franchiseId: row.franchise_id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    domain: row.domain,
    config: row.config || { chains: row.chains || [] },
    supportedTokens: row.supported_tokens || ['QCT'],
    defaultModalities: row.default_modalities || ['content'],
    isActive: row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// AUTH PROFILE OPERATIONS
// ============================================================================

export async function getAuthProfileByEmail(email: string): Promise<CrmAuthProfile | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_auth_profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToAuthProfile(data as CrmAuthProfileRow);
}

export async function getAuthProfileByKybeDid(kybeDid: string): Promise<CrmAuthProfile | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_auth_profiles')
    .select('*')
    .eq('kybe_did', kybeDid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToAuthProfile(data as CrmAuthProfileRow);
}

export async function getAuthProfilePersonas(authProfileId: string): Promise<CrmPersona[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_auth_profile_personas')
    .select('persona_id')
    .eq('auth_profile_id', authProfileId);

  if (error) throw error;

  const personaIds = (data as { persona_id: string }[]).map(r => r.persona_id);
  if (personaIds.length === 0) return [];

  const { data: personas, error: personaError } = await client
    .from('crm_personas')
    .select('*')
    .in('id', personaIds);

  if (personaError) throw personaError;

  return (personas as CrmPersonaRow[]).map(rowToPersona);
}

export async function linkPersonaToAuthProfile(
  authProfileId: string,
  personaId: string,
  isPrimary = false
): Promise<void> {
  const client = getCrmClient();

  const { error } = await client
    .from('crm_auth_profile_personas')
    .upsert({
      auth_profile_id: authProfileId,
      persona_id: personaId,
      is_primary: isPrimary,
    }, { onConflict: 'auth_profile_id,persona_id' });

  if (error) throw error;
}

export async function isPersonaPrimaryForAuthProfile(
  authProfileId: string,
  personaId: string
): Promise<boolean> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_auth_profile_personas')
    .select('is_primary')
    .eq('auth_profile_id', authProfileId)
    .eq('persona_id', personaId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false;
    throw error;
  }

  return data?.is_primary ?? false;
}

// ============================================================================
// PERSONA CROSS-TENANT OPERATIONS
// ============================================================================

export async function getPersonasByKybeDid(kybeDid: string): Promise<CrmPersona[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_personas')
    .select('*')
    .eq('kybe_did', kybeDid)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data as CrmPersonaRow[]).map(rowToPersona);
}

export async function updatePersonaReputation(
  tenantId: TenantId,
  personaId: string,
  updates: {
    reputationBucket?: ReputationBucket;
    reputationBucketUpdatedAt?: string;
    primaryWalletAddress?: string;
    displayName?: string;
  }
): Promise<CrmPersona> {
  const client = getCrmClient();

  const updateData: Record<string, unknown> = {};
  if (updates.reputationBucket !== undefined) updateData.reputation_bucket = updates.reputationBucket;
  if (updates.reputationBucketUpdatedAt !== undefined) updateData.reputation_bucket_updated_at = updates.reputationBucketUpdatedAt;
  if (updates.primaryWalletAddress !== undefined) updateData.primary_wallet_address = updates.primaryWalletAddress;
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;

  const { data, error } = await client
    .from('crm_personas')
    .update(updateData)
    .eq('tenant_id', tenantId)
    .eq('id', personaId)
    .select()
    .single();

  if (error) throw error;
  return rowToPersona(data as CrmPersonaRow);
}

// ============================================================================
// WALLET EVENT OPERATIONS
// ============================================================================

export interface ListWalletEventsOptions {
  tenantId: TenantId;
  personaId?: string;
  eventType?: string;
  chainId?: string;
  limit?: number;
  offset?: number;
}

export async function listWalletEvents(options: ListWalletEventsOptions): Promise<CrmWalletEvent[]> {
  const client = getCrmClient();
  const { tenantId, personaId, eventType, chainId, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_wallet_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaId) query = query.eq('persona_id', personaId);
  if (eventType) query = query.eq('event_type', eventType);
  if (chainId) query = query.eq('chain_id', chainId);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmWalletEventRow[]).map(rowToWalletEvent);
}

export async function createWalletEvent(input: {
  tenantId: TenantId;
  personaId: string;
  walletAddress: string;
  eventType: WalletEventType;
  tokenType?: string;
  tokenAddress?: string;
  amount?: number;
  nftTokenId?: string;
  nftMetadata?: Record<string, unknown>;
  chainId: string;
  txHash?: string;
  blockNumber?: number;
  counterpartyAddress?: string;
  counterpartyPersonaId?: string;
  status?: WalletEventStatus;
  metadata?: Record<string, unknown>;
  source?: string;
}): Promise<CrmWalletEvent> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_wallet_events')
    .insert({
      tenant_id: input.tenantId,
      persona_id: input.personaId,
      wallet_address: input.walletAddress,
      event_type: input.eventType,
      token_type: input.tokenType ?? null,
      token_address: input.tokenAddress ?? null,
      amount: input.amount ?? null,
      nft_token_id: input.nftTokenId ?? null,
      nft_metadata: input.nftMetadata ?? null,
      chain_id: input.chainId,
      tx_hash: input.txHash ?? null,
      block_number: input.blockNumber ?? null,
      counterparty_address: input.counterpartyAddress ?? null,
      counterparty_persona_id: input.counterpartyPersonaId ?? null,
      status: input.status ?? 'confirmed',
      metadata: input.metadata ?? null,
      source: input.source ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToWalletEvent(data as CrmWalletEventRow);
}

// ============================================================================
// REPUTATION EVENT OPERATIONS
// ============================================================================

export interface ListReputationEventsOptions {
  tenantId: TenantId;
  personaId?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
}

export async function listReputationEvents(options: ListReputationEventsOptions): Promise<CrmReputationEvent[]> {
  const client = getCrmClient();
  const { tenantId, personaId, eventType, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_reputation_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (personaId) query = query.eq('persona_id', personaId);
  if (eventType) query = query.eq('event_type', eventType);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmReputationEventRow[]).map(rowToReputationEvent);
}

export async function createReputationEvent(input: {
  tenantId: TenantId;
  personaId: string;
  eventType: ReputationEventType;
  reputationBucket?: ReputationBucket;
  previousBucket?: ReputationBucket;
  reason?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  cohortId?: string;
  isAnonymized?: boolean;
  metadata?: Record<string, unknown>;
  source?: string;
}): Promise<CrmReputationEvent> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_reputation_events')
    .insert({
      tenant_id: input.tenantId,
      persona_id: input.personaId,
      event_type: input.eventType,
      reputation_bucket: input.reputationBucket ?? null,
      previous_bucket: input.previousBucket ?? null,
      reason: input.reason ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      cohort_id: input.cohortId ?? null,
      is_anonymized: input.isAnonymized ?? true,
      metadata: input.metadata ?? null,
      source: input.source ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToReputationEvent(data as CrmReputationEventRow);
}

// ============================================================================
// AUDIT LOG OPERATIONS
// ============================================================================

export interface ListAuditLogsOptions {
  tenantId?: string;
  tableName?: string;
  recordId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLogs(options: ListAuditLogsOptions): Promise<CrmAuditLog[]> {
  const client = getCrmClient();
  const { tenantId, tableName, recordId, action, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantId) query = query.eq('tenant_id', tenantId);
  if (tableName) query = query.eq('table_name', tableName);
  if (recordId) query = query.eq('record_id', recordId);
  if (action) query = query.eq('action', action);

  const { data, error } = await query;
  if (error) throw error;

  return (data as CrmAuditLogRow[]).map(rowToAuditLog);
}

export async function createAuditLog(input: {
  tenantId?: string;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changedFields?: string[];
  changedByPersonaId?: string;
  changedByAuthProfileId?: string;
  changedByAgentId?: string;
  changeReason?: string;
}): Promise<CrmAuditLog> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_audit_logs')
    .insert({
      tenant_id: input.tenantId ?? null,
      table_name: input.tableName,
      record_id: input.recordId,
      action: input.action,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      changed_fields: input.changedFields ?? null,
      changed_by_persona_id: input.changedByPersonaId ?? null,
      changed_by_auth_profile_id: input.changedByAuthProfileId ?? null,
      changed_by_agent_id: input.changedByAgentId ?? null,
      change_reason: input.changeReason ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToAuditLog(data as CrmAuditLogRow);
}

// ============================================================================
// COPILOT HISTORY OPERATIONS
// ============================================================================

export interface ListCopilotHistoryOptions {
  tenantId?: string;
  personaId?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export async function listCopilotHistory(options: ListCopilotHistoryOptions): Promise<CrmCopilotHistory[]> {
  const client = getCrmClient();
  const { tenantId, personaId, success, limit = 50, offset = 0 } = options;

  let query = client
    .from('crm_copilot_history')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tenantId) query = query.eq('tenant_id', tenantId);
  if (personaId) query = query.eq('persona_id', personaId);
  if (success !== undefined) query = query.eq('success', success);

  const { data, error } = await query;
  if (error) throw error;

  // Map to CrmCopilotHistory type
  return (data as any[]).map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    queryText: row.query_text,
    parsedIntent: row.parsed_intent,
    extractedEntities: row.extracted_entities,
    toolCalls: row.tool_calls,
    executedActions: row.executed_actions,
    resultSummary: row.result_summary,
    resultCount: row.result_count,
    executionTimeMs: row.execution_time_ms,
    success: row.success,
    errorMessage: row.error_message,
    sessionId: row.session_id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
  }));
}

export async function createCopilotHistory(input: {
  tenantId?: string;
  personaId?: string;
  queryText: string;
  parsedIntent?: string;
  extractedEntities?: Record<string, unknown>;
  toolCalls?: Record<string, unknown>[];
  executedActions?: string[];
  resultSummary?: string;
  resultCount?: number;
  executionTimeMs?: number;
  success?: boolean;
  errorMessage?: string;
  sessionId?: string;
  conversationId?: string;
}): Promise<CrmCopilotHistory> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_copilot_history')
    .insert({
      tenant_id: input.tenantId ?? null,
      persona_id: input.personaId ?? null,
      query_text: input.queryText,
      parsed_intent: input.parsedIntent ?? null,
      extracted_entities: input.extractedEntities ?? null,
      tool_calls: input.toolCalls ?? null,
      executed_actions: input.executedActions ?? null,
      result_summary: input.resultSummary ?? null,
      result_count: input.resultCount ?? null,
      execution_time_ms: input.executionTimeMs ?? null,
      success: input.success ?? true,
      error_message: input.errorMessage ?? null,
      session_id: input.sessionId ?? null,
      conversation_id: input.conversationId ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    tenantId: data.tenant_id,
    personaId: data.persona_id,
    queryText: data.query_text,
    parsedIntent: data.parsed_intent,
    extractedEntities: data.extracted_entities,
    toolCalls: data.tool_calls,
    executedActions: data.executed_actions,
    resultSummary: data.result_summary,
    resultCount: data.result_count,
    executionTimeMs: data.execution_time_ms,
    success: data.success,
    errorMessage: data.error_message,
    sessionId: data.session_id,
    conversationId: data.conversation_id,
    createdAt: data.created_at,
  };
}

// ============================================================================
// PLATFORM ACCOUNT OPERATIONS
// ============================================================================

export async function getPlatformAccountByKybeDid(kybeDid: string): Promise<CrmPlatformAccount | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_platform_accounts')
    .select('*')
    .eq('kybe_did', kybeDid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToPlatformAccount(data as CrmPlatformAccountRow);
}

export async function createPlatformAccount(input: {
  kybeDid?: string;
  authProfileId?: string;
  accountType?: PlatformAccountType;
  displayName?: string;
  avatarUrl?: string;
  settings?: Record<string, unknown>;
  privacyLevel?: PrivacyLevel;
}): Promise<CrmPlatformAccount> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_platform_accounts')
    .insert({
      kybe_did: input.kybeDid ?? null,
      auth_profile_id: input.authProfileId ?? null,
      account_type: input.accountType ?? 'standard',
      display_name: input.displayName ?? null,
      avatar_url: input.avatarUrl ?? null,
      settings: input.settings ?? {},
      privacy_level: input.privacyLevel ?? 'standard',
    })
    .select()
    .single();

  if (error) throw error;
  return rowToPlatformAccount(data as CrmPlatformAccountRow);
}

export async function getPlatformFranchiseAccess(
  platformAccountId: string
): Promise<CrmPlatformFranchiseAccess[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_platform_franchise_access')
    .select('*')
    .eq('platform_account_id', platformAccountId);

  if (error) throw error;
  return (data as CrmPlatformFranchiseAccessRow[]).map(rowToPlatformFranchiseAccess);
}

export async function grantPlatformFranchiseAccess(input: {
  platformAccountId: string;
  franchiseId: string;
  accessRole?: PlatformFranchiseRole;
  grantedByPlatformAccountId?: string;
}): Promise<CrmPlatformFranchiseAccess> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_platform_franchise_access')
    .insert({
      platform_account_id: input.platformAccountId,
      franchise_id: input.franchiseId,
      access_role: input.accessRole ?? 'member',
      granted_by_platform_account_id: input.grantedByPlatformAccountId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToPlatformFranchiseAccess(data as CrmPlatformFranchiseAccessRow);
}

// ============================================================================
// REGISTRY PROFILE OPERATIONS
// ============================================================================

export async function getRegistryProfileByKybeDid(kybeDid: string): Promise<CrmRegistryProfile | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_registry_profiles')
    .select('*')
    .eq('kybe_did', kybeDid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToRegistryProfile(data as CrmRegistryProfileRow);
}

export async function createRegistryProfile(input: {
  kybeDid: string;
  platformAccountId?: string;
  authProfileId?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  visibilityLevel?: VisibilityLevel;
  originLayer: OriginLayer;
  originTenantId?: string;
  originFranchiseId?: string;
}): Promise<CrmRegistryProfile> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_registry_profiles')
    .insert({
      kybe_did: input.kybeDid,
      platform_account_id: input.platformAccountId ?? null,
      auth_profile_id: input.authProfileId ?? null,
      display_name: input.displayName ?? null,
      avatar_url: input.avatarUrl ?? null,
      bio: input.bio ?? null,
      visibility_level: input.visibilityLevel ?? 'standard',
      origin_layer: input.originLayer,
      origin_tenant_id: input.originTenantId ?? null,
      origin_franchise_id: input.originFranchiseId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToRegistryProfile(data as CrmRegistryProfileRow);
}

export async function updateRegistryProfile(
  kybeDid: string,
  updates: {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    visibilityLevel?: VisibilityLevel;
    reputationBucket?: ReputationBucket;
    reputationScoreCached?: number;
  }
): Promise<CrmRegistryProfile> {
  const client = getCrmClient();

  const updateData: Record<string, unknown> = {};
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
  if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
  if (updates.bio !== undefined) updateData.bio = updates.bio;
  if (updates.visibilityLevel !== undefined) updateData.visibility_level = updates.visibilityLevel;
  if (updates.reputationBucket !== undefined) {
    updateData.reputation_bucket = updates.reputationBucket;
    updateData.reputation_updated_at = new Date().toISOString();
  }
  if (updates.reputationScoreCached !== undefined) updateData.reputation_score_cached = updates.reputationScoreCached;

  const { data, error } = await client
    .from('crm_registry_profiles')
    .update(updateData)
    .eq('kybe_did', kybeDid)
    .select()
    .single();

  if (error) throw error;
  return rowToRegistryProfile(data as CrmRegistryProfileRow);
}

export async function getRegistryPersonaLinks(
  registryProfileId: string
): Promise<CrmRegistryPersonaLink[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_registry_persona_links')
    .select('*')
    .eq('registry_profile_id', registryProfileId);

  if (error) throw error;
  return (data as CrmRegistryPersonaLinkRow[]).map(rowToRegistryPersonaLink);
}

export async function linkPersonaToRegistry(input: {
  registryProfileId: string;
  personaId: string;
  tenantId: string;
  isPrimaryForTenant?: boolean;
}): Promise<CrmRegistryPersonaLink> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_registry_persona_links')
    .insert({
      registry_profile_id: input.registryProfileId,
      persona_id: input.personaId,
      tenant_id: input.tenantId,
      is_primary_for_tenant: input.isPrimaryForTenant ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToRegistryPersonaLink(data as CrmRegistryPersonaLinkRow);
}

// ============================================================================
// USER ACCOUNT LAYERS (Cross-layer view)
// ============================================================================

export interface UserAccountLayersResult {
  kybeDid: string;
  registryProfile: CrmRegistryProfile | null;
  platformAccount: CrmPlatformAccount | null;
  franchiseAccess: CrmPlatformFranchiseAccess[];
  personaLinks: CrmRegistryPersonaLink[];
}

/**
 * Get complete account layers for a Kybe DID
 * Shows what layers a user has accounts at
 */
export async function getUserAccountLayers(kybeDid: string): Promise<UserAccountLayersResult> {
  // Get registry profile
  const registryProfile = await getRegistryProfileByKybeDid(kybeDid);
  
  // Get platform account
  const platformAccount = await getPlatformAccountByKybeDid(kybeDid);
  
  // Get franchise access if platform account exists
  let franchiseAccess: CrmPlatformFranchiseAccess[] = [];
  if (platformAccount) {
    franchiseAccess = await getPlatformFranchiseAccess(platformAccount.id);
  }
  
  // Get persona links if registry profile exists
  let personaLinks: CrmRegistryPersonaLink[] = [];
  if (registryProfile) {
    personaLinks = await getRegistryPersonaLinks(registryProfile.id);
  }
  
  return {
    kybeDid,
    registryProfile,
    platformAccount,
    franchiseAccess,
    personaLinks,
  };
}

/**
 * Ensure a registry profile exists for a Kybe DID
 * Auto-provisions if needed (called on any account signup)
 */
export async function ensureRegistryProfile(input: {
  kybeDid: string;
  displayName?: string;
  originLayer: OriginLayer;
  originTenantId?: string;
  originFranchiseId?: string;
}): Promise<CrmRegistryProfile> {
  // Check if already exists
  const existing = await getRegistryProfileByKybeDid(input.kybeDid);
  if (existing) return existing;
  
  // Create new registry profile
  return createRegistryProfile({
    kybeDid: input.kybeDid,
    displayName: input.displayName,
    originLayer: input.originLayer,
    originTenantId: input.originTenantId,
    originFranchiseId: input.originFranchiseId,
  });
}

// ============================================================================
// ADMIN CATEGORY OPERATIONS
// ============================================================================

export async function listAdminCategories(activeOnly = true): Promise<CrmAdminCategory[]> {
  const client = getCrmClient();

  let query = client.from('crm_admin_categories').select('*');
  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('name');
  if (error) throw error;

  return (data as CrmAdminCategoryRow[]).map(rowToAdminCategory);
}

export async function getAdminCategoryBySlug(slug: AdminCategorySlug): Promise<CrmAdminCategory | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_admin_categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToAdminCategory(data as CrmAdminCategoryRow);
}

// ============================================================================
// ADMIN ROLE OPERATIONS
// ============================================================================

export async function getAdminRolesByKybeDid(kybeDid: string): Promise<CrmAdminRoleExpanded[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_admin_roles_expanded')
    .select('*')
    .eq('kybe_did', kybeDid)
    .order('access_level');

  if (error) throw error;
  return (data as CrmAdminRoleExpandedRow[]).map(rowToAdminRoleExpanded);
}

export async function getAdminRole(roleId: string): Promise<CrmAdminRole | null> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_admin_roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToAdminRole(data as CrmAdminRoleRow);
}

export async function createAdminRole(input: {
  platformAccountId?: string;
  authProfileId?: string;
  kybeDid?: string;
  roleType: AdminRoleType;
  franchiseId?: string;
  tenantId?: string;
  categoryId?: string;
  permissions?: Partial<AdminPermissions>;
  grantedByAdminRoleId?: string;
  expiresAt?: string;
}): Promise<CrmAdminRole> {
  const client = getCrmClient();

  // Determine default permissions based on role type
  const defaultPerms = input.roleType === 'uber_admin' 
    ? UBER_ADMIN_PERMISSIONS 
    : DEFAULT_ADMIN_PERMISSIONS;

  const permissions = { ...defaultPerms, ...input.permissions };

  const { data, error } = await client
    .from('crm_admin_roles')
    .insert({
      platform_account_id: input.platformAccountId ?? null,
      auth_profile_id: input.authProfileId ?? null,
      kybe_did: input.kybeDid ?? null,
      role_type: input.roleType,
      franchise_id: input.franchiseId ?? null,
      tenant_id: input.tenantId ?? null,
      category_id: input.categoryId ?? null,
      permissions,
      granted_by_admin_role_id: input.grantedByAdminRoleId ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToAdminRole(data as CrmAdminRoleRow);
}

export async function updateAdminRole(
  roleId: string,
  updates: {
    permissions?: Partial<AdminPermissions>;
    expiresAt?: string | null;
    isActive?: boolean;
    suspensionReason?: string;
  }
): Promise<CrmAdminRole> {
  const client = getCrmClient();

  const updateData: Record<string, unknown> = {};
  
  if (updates.permissions !== undefined) {
    // Merge with existing permissions
    const existing = await getAdminRole(roleId);
    if (existing) {
      updateData.permissions = { ...existing.permissions, ...updates.permissions };
    }
  }
  if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt;
  if (updates.isActive !== undefined) {
    updateData.is_active = updates.isActive;
    if (!updates.isActive) {
      updateData.suspended_at = new Date().toISOString();
      updateData.suspension_reason = updates.suspensionReason ?? null;
    } else {
      updateData.suspended_at = null;
      updateData.suspension_reason = null;
    }
  }

  const { data, error } = await client
    .from('crm_admin_roles')
    .update(updateData)
    .eq('id', roleId)
    .select()
    .single();

  if (error) throw error;
  return rowToAdminRole(data as CrmAdminRoleRow);
}

export async function deleteAdminRole(roleId: string): Promise<void> {
  const client = getCrmClient();

  const { error } = await client
    .from('crm_admin_roles')
    .delete()
    .eq('id', roleId);

  if (error) throw error;
}

/**
 * Check if a user has admin access for a specific action
 * Uses the database function for comprehensive checking
 */
export async function checkAdminAccess(input: {
  kybeDid: string;
  action: keyof AdminPermissions;
  franchiseId?: string;
  tenantId?: string;
  categorySlug?: AdminCategorySlug;
}): Promise<boolean> {
  const client = getCrmClient();

  const { data, error } = await client.rpc('check_admin_access', {
    p_kybe_did: input.kybeDid,
    p_action: input.action,
    p_franchise_id: input.franchiseId ?? null,
    p_tenant_id: input.tenantId ?? null,
    p_category_slug: input.categorySlug ?? null,
  });

  if (error) {
    console.error('[CRM] checkAdminAccess error:', error);
    return false;
  }

  return data === true;
}

/**
 * Get all admin roles for a specific scope
 */
export async function getAdminRolesForScope(input: {
  franchiseId?: string;
  tenantId?: string;
  categoryId?: string;
  roleType?: AdminRoleType;
}): Promise<CrmAdminRoleExpanded[]> {
  const client = getCrmClient();

  let query = client.from('crm_admin_roles_expanded').select('*');

  if (input.franchiseId) {
    query = query.eq('franchise_id', input.franchiseId);
  }
  if (input.tenantId) {
    query = query.eq('tenant_id', input.tenantId);
  }
  if (input.categoryId) {
    query = query.eq('category_id', input.categoryId);
  }
  if (input.roleType) {
    query = query.eq('role_type', input.roleType);
  }

  const { data, error } = await query.order('access_level');
  if (error) throw error;

  return (data as CrmAdminRoleExpandedRow[]).map(rowToAdminRoleExpanded);
}

/**
 * Get uber admins (estate-wide)
 */
export async function getUberAdmins(): Promise<CrmAdminRoleExpanded[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_admin_roles_expanded')
    .select('*')
    .eq('role_type', 'uber_admin')
    .order('created_at');

  if (error) throw error;
  return (data as CrmAdminRoleExpandedRow[]).map(rowToAdminRoleExpanded);
}

/**
 * Get category uber admins for a specific category
 */
export async function getCategoryUberAdmins(categorySlug: AdminCategorySlug): Promise<CrmAdminRoleExpanded[]> {
  const client = getCrmClient();

  const { data, error } = await client
    .from('crm_admin_roles_expanded')
    .select('*')
    .eq('role_type', 'category_uber_admin')
    .eq('category_slug', categorySlug)
    .order('created_at');

  if (error) throw error;
  return (data as CrmAdminRoleExpandedRow[]).map(rowToAdminRoleExpanded);
}

/**
 * Check if user is an uber admin
 */
export async function isUberAdmin(kybeDid: string): Promise<boolean> {
  const roles = await getAdminRolesByKybeDid(kybeDid);
  return roles.some(r => r.roleType === 'uber_admin' && r.isActive);
}

/**
 * Check if user has any admin role
 */
export async function hasAnyAdminRole(kybeDid: string): Promise<boolean> {
  const roles = await getAdminRolesByKybeDid(kybeDid);
  return roles.length > 0;
}

/**
 * Get the highest access level admin role for a user
 */
export async function getHighestAdminRole(kybeDid: string): Promise<CrmAdminRoleExpanded | null> {
  const roles = await getAdminRolesByKybeDid(kybeDid);
  if (roles.length === 0) return null;
  
  // Roles are already sorted by access_level (ascending)
  return roles[0];
}

// ============================================================================
// PERSONA IDENTITY LINKING OPERATIONS
// ============================================================================

/**
 * Link a CRM persona to an identity persona
 * This creates the connection between CRM and Identity systems
 */
export async function linkCrmPersonaToIdentity(
  crmPersonaId: string,
  identityPersonaId: string
): Promise<boolean> {
  const client = getCrmClient();
  
  const { data, error } = await client.rpc('link_crm_persona_to_identity', {
    p_crm_persona_id: crmPersonaId,
    p_identity_persona_id: identityPersonaId,
  });
  
  if (error) throw error;
  return data === true;
}

/**
 * Sync reputation data from ReputationHub canister to CRM persona
 */
export async function syncPersonaReputation(
  crmPersonaId: string,
  reputationBucket: number,
  reputationScore: number
): Promise<boolean> {
  const client = getCrmClient();
  
  const { data, error } = await client.rpc('sync_crm_persona_reputation', {
    p_crm_persona_id: crmPersonaId,
    p_reputation_bucket: reputationBucket,
    p_reputation_score: reputationScore,
  });
  
  if (error) throw error;
  return data === true;
}

/**
 * Get CRM persona with full identity information
 */
export async function getPersonaWithIdentity(
  tenantId: string,
  personaId: string
): Promise<CrmPersona & { 
  identityId?: string;
  fioHandle?: string;
  identityState?: string;
  worldIdStatus?: string;
  rootDidUri?: string;
  kycStatus?: string;
} | null> {
  const client = getCrmClient();
  
  const { data, error } = await client
    .from('crm_personas_with_identity')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', personaId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  const row = data as any;
  return {
    ...rowToPersona(row),
    identityId: row.identity_id,
    fioHandle: row.fio_handle,
    identityState: row.default_identity_state,
    worldIdStatus: row.world_id_status,
    rootDidUri: row.root_did_uri,
    kycStatus: row.kyc_status,
  };
}

/**
 * Find identity persona by email or FIO handle for linking
 */
export async function findIdentityPersonaForLinking(
  emailOrFio: string
): Promise<{ id: string; fioHandle?: string; rootDid?: string } | null> {
  const client = getCrmClient();
  
  // Search in persona table
  const { data, error } = await client
    .from('persona')
    .select(`
      id,
      fio_handle,
      root_identity:root_id (
        did_uri
      )
    `)
    .or(`fio_handle.eq.${emailOrFio},fio_handle.ilike.%${emailOrFio}%`)
    .limit(1)
    .single();
  
  if (error || !data) return null;
  
  const row = data as any;
  return {
    id: row.id,
    fioHandle: row.fio_handle,
    rootDid: row.root_identity?.did_uri,
  };
}

// Additional functions for AgentiQ hierarchy
export async function getFranchiseBySlug(slug: string): Promise<CrmFranchise | null> {
  const client = getCrmClient();
  
  // First try crm_franchises table (where AgentiQ anchor is stored)
  let { data, error } = await client
    .from('crm_franchises')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    // If not found in crm_franchises, try the main franchises table
    const result = await client
      .from('franchises')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (result.error) return null;
    data = result.data;
  }
  
  // Map from table format to CrmFranchise format
  const row = data as any;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    config: row.config || {},
    isActive: row.is_active ?? row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAllTenants(): Promise<CrmTenant[]> {
  const client = getCrmClient();
  
  const { data, error } = await client
    .from('crm_tenants')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return data.map((row: any) => ({
    id: row.id,
    franchiseId: row.franchise_id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    domain: row.domain,
    config: row.config || {},
    supportedTokens: row.supported_tokens || ['QCT'],
    defaultModalities: row.default_modalities || ['content'],
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
