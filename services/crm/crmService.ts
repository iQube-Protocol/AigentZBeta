/**
 * AgentiQ CRM Service
 * 
 * Business logic layer for CRM operations.
 * Implements PoKW computation, reward allocation, and unified profile views.
 * Designed for CopilotKit integration and A2A API exposure.
 * 
 * HIERARCHY: Franchise → Tenant → Persona (many-to-many)
 * IDENTITY: Kybe DID → Root DID → Auth Profile → Multiple Personas
 */

import * as db from './crmDataAccess';
import {
  TenantId,
  CrmPersona,
  CrmContribution,
  CrmEngagementEvent,
  CrmEntitlement,
  CrmReward,
  CrmSegment,
  CrmFranchise,
  CrmTenant,
  CrmAuthProfile,
  CrmWalletEvent,
  CrmReputationEvent,
  CrmAuditLog,
  CrmCopilotHistory,
  PersonaSummary,
  TopContributor,
  UnifiedProfile,
  RecordContributionInput,
  RecordContributionResponse,
  RecordEngagementInput,
  RecordEngagementResponse,
  RecordWalletEventInput,
  RecordReputationEventInput,
  RecordCopilotHistoryInput,
  ProposeRewardsInput,
  ProposeRewardsResponse,
  UpdateRewardInput,
  CreateEntitlementInput,
  UpdateEntitlementInput,
  CreateSegmentInput,
  computePokwScore,
  getEngagementPokwDelta,
  TokenType,
  ReputationBucket,
  RewardStatus,
} from '@/types/crm';

// ============================================================================
// FRANCHISE OPERATIONS
// ============================================================================

/**
 * List all franchises
 */
export async function listFranchises(activeOnly = true): Promise<CrmFranchise[]> {
  return db.listFranchises({ activeOnly });
}

/**
 * Get franchise by ID or slug
 */
export async function getFranchise(idOrSlug: string): Promise<CrmFranchise | null> {
  return db.getFranchise(idOrSlug);
}

/**
 * Get tenants for a franchise
 */
export async function getFranchiseTenants(franchiseId: string, activeOnly = true): Promise<CrmTenant[]> {
  return db.listTenants({ franchiseId, activeOnly });
}

// ============================================================================
// TENANT OPERATIONS
// ============================================================================

/**
 * List all tenants (optionally filtered by franchise)
 */
export async function listTenants(franchiseId?: string, activeOnly = true): Promise<CrmTenant[]> {
  return db.listTenants({ franchiseId, activeOnly });
}

/**
 * Get tenant by ID or slug
 */
export async function getTenant(idOrSlug: string): Promise<CrmTenant | null> {
  return db.getTenant(idOrSlug);
}

// ============================================================================
// AGENTIQ ANCHOR HIERARCHY OPERATIONS
// ============================================================================

/**
 * Get AgentiQ anchor franchise (the mother ship)
 */
export async function getAgentiqAnchor(): Promise<CrmFranchise | null> {
  return db.getFranchiseBySlug('agentiq');
}

/**
 * Get complete franchise hierarchy under AgentiQ
 */
export async function getAgentiqHierarchy(): Promise<{
  franchises: CrmFranchise[];
  hierarchy: {
    [franchiseId: string]: {
      franchise: CrmFranchise;
      children: string[];
      tenants: CrmTenant[];
      level: number;
      path: string[];
    };
  };
}> {
  const franchises = await db.listFranchises(); // All active franchises
  const tenants = await db.listAllTenants(); // All tenants
  
  // Build hierarchy
  const hierarchy: any = {};
  
  // Try to get AgentiQ anchor from crm_franchises first, then regular franchises
  let agentiqFranchise = await db.getFranchiseBySlug('agentiq');
  
  if (!agentiqFranchise) {
    throw new Error('AgentiQ anchor franchise not found');
  }
  
  // Initialize hierarchy
  franchises.forEach(franchise => {
    hierarchy[franchise.id] = {
      franchise,
      children: [],
      tenants: tenants.filter(t => t.franchiseId === franchise.id),
      level: franchise.config?.hierarchy_level || 1,
      path: [], // Will be filled below
    };
  });
  
  // Build parent-child relationships
  franchises.forEach(franchise => {
    const parentId = franchise.config?.parent_franchise_id as string | undefined;
    if (parentId && hierarchy[parentId]) {
      hierarchy[parentId].children.push(franchise.id);
    }
  });
  
  // Calculate paths
  const calculatePath = (franchiseId: string, currentPath: string[] = []): string[] => {
    const franchise = hierarchy[franchiseId];
    if (!franchise) return currentPath;
    
    const newPath = [franchise.franchise.slug, ...currentPath];
    
    if (franchise.franchise.config?.parent_franchise_id) {
      return calculatePath(franchise.franchise.config?.parent_franchise_id, newPath);
    }
    
    return newPath;
  };
  
  Object.keys(hierarchy).forEach(franchiseId => {
    hierarchy[franchiseId].path = calculatePath(franchiseId);
  });
  
  return {
    franchises,
    hierarchy,
  };
}

/**
 * Check if a franchise can govern a tenant (hierarchy validation)
 */
export async function canFranchiseGovernTenant(
  franchiseId: string, 
  tenantId: string
): Promise<boolean> {
  const franchise = await db.getFranchise(franchiseId);
  const tenant = await db.getTenant(tenantId);
  
  if (!franchise || !tenant) return false;
  
  // AgentiQ anchor can govern everyone
  if (franchise.slug === 'agentiq') return true;
  
  // Direct ownership
  if (tenant.franchiseId === franchiseId) return true;
  
  // Check hierarchy (franchise must be higher than tenant's franchise)
  const franchiseLevel = franchise.config?.hierarchy_level || 1;
  const tenantFranchise = await db.getFranchise(tenant.franchiseId);
  const tenantFranchiseLevel = tenantFranchise?.config?.hierarchy_level || 1;
  
  return franchiseLevel < tenantFranchiseLevel;
}

/**
 * Get all tenants under AgentiQ (directly or indirectly)
 */
export async function getAgentiqTenantHierarchy(): Promise<{
  agentiq: CrmFranchise;
  directTenants: CrmTenant[];
  allTenants: CrmTenant[];
  tenantByFranchise: { [franchiseId: string]: CrmTenant[] };
}> {
  const agentiq = await getAgentiqAnchor();
  if (!agentiq) {
    throw new Error('AgentiQ anchor franchise not found');
  }
  
  const allTenants = await db.listAllTenants();
  const franchises = await db.listFranchises();
  
  // Direct AgentiQ tenants
  const directTenants = allTenants.filter(t => t.franchiseId === agentiq.id);
  
  // Group tenants by franchise
  const tenantByFranchise: { [franchiseId: string]: CrmTenant[] } = {};
  allTenants.forEach(tenant => {
    if (!tenantByFranchise[tenant.franchiseId]) {
      tenantByFranchise[tenant.franchiseId] = [];
    }
    tenantByFranchise[tenant.franchiseId].push(tenant);
  });
  
  return {
    agentiq,
    directTenants,
    allTenants,
    tenantByFranchise,
  };
}

// ============================================================================
// PERSONA OPERATIONS
// ============================================================================

/**
 * Get persona summary with PoKW stats, contributions, and entitlements
 */
export async function getPersonaSummary(
  tenantId: TenantId,
  personaId: string
): Promise<PersonaSummary | null> {
  // Get persona
  const persona = await db.getPersona(tenantId, personaId);
  if (!persona) return null;

  // Get PoKW totals
  const pokwTotal = await db.getPersonaPokwTotal(tenantId, personaId);
  
  // Get last 30 days PoKW
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const pokwLast30 = await db.getPersonaPokwTotal(
    tenantId,
    personaId,
    thirtyDaysAgo.toISOString()
  );

  // Get recent contributions (last 10)
  const recentContributions = await db.listContributions({
    tenantId,
    personaId,
    limit: 10,
  });

  // Get current entitlements
  const entitlements = await db.listEntitlements({
    tenantId,
    personaId,
    includeExpired: false,
  });

  return {
    persona,
    pokw: {
      total: pokwTotal.total,
      last30Days: pokwLast30.total,
    },
    recentContributions,
    entitlements,
  };
}

/**
 * List personas for a tenant
 */
export async function listPersonas(
  tenantId: TenantId,
  options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }
): Promise<CrmPersona[]> {
  return db.listPersonas({
    tenantId,
    ...options,
  });
}

export async function getPersona(tenantId: TenantId, personaId: string): Promise<CrmPersona | null> {
  return db.getPersona(tenantId, personaId);
}

/**
 * Create a new persona
 */
export async function createPersona(input: {
  tenantId: TenantId;
  displayName?: string;
  email?: string;
  kybeDid?: string;
  rootDidProxyId?: string;
  externalUserId?: string;
  primaryWalletAddress?: string;
  authProfileId?: string;
  primaryFranchiseId?: string;
}): Promise<CrmPersona> {
  return db.createPersona(input);
}

/**
 * Get all personas for a Kybe DID (cross-tenant)
 */
export async function getPersonasByKybeDid(kybeDid: string): Promise<CrmPersona[]> {
  return db.getPersonasByKybeDid(kybeDid);
}

// ============================================================================
// CONTRIBUTION OPERATIONS
// ============================================================================

/**
 * Record a contribution and compute PoKW score
 * 
 * MVP: pokw_score = units * basePokwWeight
 * Future: Will incorporate PoR/PoS/PoP scores
 */
export async function recordContribution(
  input: RecordContributionInput
): Promise<RecordContributionResponse> {
  const units = input.units ?? 1;
  const basePokwWeight = input.basePokwWeight ?? 1;
  
  // Compute PoKW score (MVP formula)
  // Future: This will call Aigent_PoR, Aigent_PoS, Aigent_PoP for additional scores
  const pokwScore = computePokwScore(units, basePokwWeight);

  const contribution = await db.createContribution({
    tenantId: input.tenantId,
    personaId: input.personaId,
    qubeId: input.qubeId,
    clusterqubeId: input.clusterQubeId,
    contributionType: input.contributionType,
    units,
    basePokwWeight,
    pokwScore,
    source: input.source,
  });

  // Log audit event
  await logAuditEvent({
    tenantId: input.tenantId,
    tableName: 'crm_contributions',
    recordId: contribution.id,
    action: 'INSERT',
    newValues: contribution as unknown as Record<string, unknown>,
  });

  return {
    id: contribution.id,
    pokwScore: contribution.pokwScore,
  };
}

/**
 * List contributions with filters
 */
export async function listContributions(
  tenantId: TenantId,
  options?: {
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
): Promise<CrmContribution[]> {
  return db.listContributions({
    tenantId,
    ...options,
  });
}

// ============================================================================
// ENGAGEMENT EVENT OPERATIONS
// ============================================================================

/**
 * Record an engagement event and compute PoKW delta
 * 
 * Uses lookup table for event type weights:
 * - view: 0.5
 * - complete: 2.0
 * - comment: 1.0
 * - share: 1.5
 * - like: 0.2
 * - bookmark: 0.3
 * - download: 0.5
 */
export async function recordEngagement(
  input: RecordEngagementInput
): Promise<RecordEngagementResponse> {
  const weight = input.weight ?? 1;
  
  // Get PoKW delta from lookup table
  const pokwDelta = getEngagementPokwDelta(input.eventType, weight);

  const event = await db.createEngagementEvent({
    tenantId: input.tenantId,
    personaId: input.personaId,
    qubeId: input.qubeId,
    clusterqubeId: input.clusterQubeId,
    eventType: input.eventType,
    weight,
    pokwDelta,
    source: input.source,
    metadata: input.metadata,
  });

  return {
    id: event.id,
    pokwDelta: event.pokwDelta,
  };
}

/**
 * List engagement events with filters
 */
export async function listEngagementEvents(
  tenantId: TenantId,
  options?: {
    personaId?: string;
    clusterqubeId?: string;
    eventType?: string;
    periodStart?: string;
    periodEnd?: string;
    limit?: number;
    offset?: number;
  }
): Promise<CrmEngagementEvent[]> {
  return db.listEngagementEvents({
    tenantId,
    ...options,
  });
}

// ============================================================================
// TOP CONTRIBUTORS
// ============================================================================

/**
 * Get top contributors for a tenant within a period
 */
export async function getTopContributors(
  tenantId: TenantId,
  periodStart: string,
  periodEnd: string,
  limit: number = 10
): Promise<TopContributor[]> {
  const rows = await db.getTopContributors(tenantId, periodStart, periodEnd, limit);
  
  return rows.map(row => ({
    personaId: row.personaId,
    displayName: row.displayName,
    totalPokw: row.totalPokw,
    contributionCount: row.contributionCount,
    engagementCount: row.engagementCount,
  }));
}

// ============================================================================
// REWARD OPERATIONS
// ============================================================================

/**
 * Propose rewards for top contributors in a period
 * 
 * Allocates budget pro-rata based on PoKW scores
 */
export async function proposeRewards(
  input: ProposeRewardsInput
): Promise<ProposeRewardsResponse> {
  const { tenantId, periodStart, periodEnd, budget, topN = 10 } = input;

  // Get top contributors
  const topContributors = await getTopContributors(tenantId, periodStart, periodEnd, topN);
  
  if (topContributors.length === 0) {
    return {
      rewards: [],
      totalPokw: 0,
      allocations: {} as Record<TokenType, number>,
    };
  }

  // Calculate total PoKW
  const totalPokw = topContributors.reduce((sum, c) => sum + c.totalPokw, 0);

  // Create reward proposals for each token type
  const rewards: CrmReward[] = [];
  const allocations: Record<TokenType, number> = {} as Record<TokenType, number>;

  for (const [tokenType, totalBudget] of Object.entries(budget)) {
    if (!totalBudget || totalBudget <= 0) continue;

    allocations[tokenType as TokenType] = 0;

    for (const contributor of topContributors) {
      // Pro-rata allocation
      const share = contributor.totalPokw / totalPokw;
      const amount = totalBudget * share;

      const reward = await db.createReward({
        tenantId,
        personaId: contributor.personaId,
        periodStart,
        periodEnd,
        pokwScoreUsed: contributor.totalPokw,
        tokenType: tokenType as TokenType,
        amount,
        status: 'draft',
        notes: `Auto-proposed: ${share.toFixed(4)} share of ${totalBudget} ${tokenType}`,
      });

      rewards.push(reward);
      allocations[tokenType as TokenType] += amount;
    }
  }

  return {
    rewards,
    totalPokw,
    allocations,
  };
}

/**
 * Update reward status (approve, pay, cancel)
 */
export async function updateReward(
  tenantId: TenantId,
  rewardId: string,
  updates: UpdateRewardInput
): Promise<CrmReward> {
  const oldReward = await db.getReward(tenantId, rewardId);
  
  const reward = await db.updateReward(tenantId, rewardId, updates);

  // Log audit event
  await logAuditEvent({
    tenantId,
    tableName: 'crm_rewards',
    recordId: rewardId,
    action: 'UPDATE',
    oldValues: oldReward as unknown as Record<string, unknown>,
    newValues: reward as unknown as Record<string, unknown>,
    changedFields: Object.keys(updates),
  });

  return reward;
}

/**
 * List rewards with filters
 */
export async function listRewards(
  tenantId: TenantId,
  options?: {
    personaId?: string;
    status?: RewardStatus;
    tokenType?: TokenType;
    limit?: number;
    offset?: number;
  }
): Promise<CrmReward[]> {
  return db.listRewards({
    tenantId,
    ...options,
  });
}

// ============================================================================
// ENTITLEMENT OPERATIONS
// ============================================================================

/**
 * Get entitlements for a persona
 */
export async function getPersonaEntitlements(
  tenantId: TenantId,
  personaId: string,
  includeExpired = false
): Promise<CrmEntitlement[]> {
  return db.listEntitlements({
    tenantId,
    personaId,
    includeExpired,
  });
}

/**
 * Create an entitlement
 */
export async function createEntitlement(
  input: CreateEntitlementInput
): Promise<CrmEntitlement> {
  const entitlement = await db.createEntitlement({
    tenantId: input.tenantId,
    personaId: input.personaId,
    clusterqubeId: input.clusterQubeId,
    qubeId: input.qubeId,
    modality: input.modality,
    accessLevel: input.accessLevel,
    origin: input.origin,
    expiresAt: input.expiresAt,
  });

  // Log audit event
  await logAuditEvent({
    tenantId: input.tenantId,
    tableName: 'crm_entitlements',
    recordId: entitlement.id,
    action: 'INSERT',
    newValues: entitlement as unknown as Record<string, unknown>,
  });

  return entitlement;
}

/**
 * Update an entitlement
 */
export async function updateEntitlement(
  tenantId: TenantId,
  entitlementId: string,
  updates: UpdateEntitlementInput
): Promise<CrmEntitlement> {
  const oldEntitlement = await db.getEntitlement(tenantId, entitlementId);
  
  const entitlement = await db.updateEntitlement(tenantId, entitlementId, updates);

  // Log audit event
  await logAuditEvent({
    tenantId,
    tableName: 'crm_entitlements',
    recordId: entitlementId,
    action: 'UPDATE',
    oldValues: oldEntitlement as unknown as Record<string, unknown>,
    newValues: entitlement as unknown as Record<string, unknown>,
  });

  return entitlement;
}

// ============================================================================
// WALLET EVENT OPERATIONS (x402 Integration)
// ============================================================================

/**
 * Record a wallet event
 */
export async function recordWalletEvent(
  input: RecordWalletEventInput
): Promise<CrmWalletEvent> {
  return db.createWalletEvent(input);
}

/**
 * List wallet events for a persona
 */
export async function listWalletEvents(
  tenantId: TenantId,
  personaId: string,
  options?: {
    eventType?: string;
    chainId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<CrmWalletEvent[]> {
  return db.listWalletEvents({
    tenantId,
    personaId,
    ...options,
  });
}

// ============================================================================
// REPUTATION EVENT OPERATIONS (DiDQube Integration)
// ============================================================================

/**
 * Record a reputation event (DiDQube compliant)
 */
export async function recordReputationEvent(
  input: RecordReputationEventInput
): Promise<CrmReputationEvent> {
  const event = await db.createReputationEvent({
    ...input,
    isAnonymized: input.isAnonymized ?? true,  // Default to anonymized for DiDQube compliance
  });

  // Update persona's cached reputation bucket if changed
  if (input.reputationBucket && input.eventType === 'bucket_change') {
    await db.updatePersonaReputation(input.tenantId, input.personaId, {
      reputationBucket: input.reputationBucket,
      reputationBucketUpdatedAt: new Date().toISOString(),
    });
  }

  return event;
}

/**
 * List reputation events for a persona
 */
export async function listReputationEvents(
  tenantId: TenantId,
  personaId: string,
  options?: {
    eventType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<CrmReputationEvent[]> {
  return db.listReputationEvents({
    tenantId,
    personaId,
    ...options,
  });
}

// ============================================================================
// UNIFIED PROFILE (Cross-Tenant View)
// ============================================================================

/**
 * Get unified profile for a Kybe DID holder
 * Shows activity across ALL tenants they participate in
 */
export async function getUnifiedProfile(kybeDid: string): Promise<UnifiedProfile | null> {
  // Get all personas for this Kybe DID
  const personas = await db.getPersonasByKybeDid(kybeDid);
  
  if (personas.length === 0) {
    return null;
  }

  // Get auth profile if exists
  const authProfile = await db.getAuthProfileByKybeDid(kybeDid);

  // Build persona details with tenant/franchise info
  const personaDetails: UnifiedProfile['personas'] = [];
  const tenantIds = new Set<string>();
  const franchiseIds = new Set<string>();

  for (const persona of personas) {
    const tenant = await db.getTenant(persona.tenantId);
    if (!tenant) continue;

    const franchise = await db.getFranchise(tenant.franchiseId);
    if (!franchise) continue;

    tenantIds.add(tenant.id);
    franchiseIds.add(franchise.id);

    // Check if this is the primary persona for the auth profile
    const isPrimary = authProfile 
      ? await db.isPersonaPrimaryForAuthProfile(authProfile.id, persona.id)
      : false;

    personaDetails.push({
      persona,
      tenant,
      franchise,
      isPrimary,
    });
  }

  // Aggregate stats across all tenants
  let totalPokw = 0;
  let totalContributions = 0;
  let totalEngagementEvents = 0;
  const totalRewardsEarned: Record<TokenType, number> = {
    QCT: 0,
    QOYN: 0,
    KNYT: 0,
  };

  for (const persona of personas) {
    const pokw = await db.getPersonaPokwTotal(persona.tenantId, persona.id);
    totalPokw += pokw.total;

    const contributions = await db.listContributions({
      tenantId: persona.tenantId,
      personaId: persona.id,
      limit: 1000,
    });
    totalContributions += contributions.length;

    const engagements = await db.listEngagementEvents({
      tenantId: persona.tenantId,
      personaId: persona.id,
      limit: 1000,
    });
    totalEngagementEvents += engagements.length;

    const rewards = await db.listRewards({
      tenantId: persona.tenantId,
      personaId: persona.id,
      status: 'paid',
    });
    for (const reward of rewards) {
      totalRewardsEarned[reward.tokenType] = 
        (totalRewardsEarned[reward.tokenType] || 0) + reward.amount;
    }
  }

  // Get recent activity (last 20 items across all personas)
  const recentActivity: UnifiedProfile['recentActivity'] = [];
  
  for (const persona of personas) {
    // Recent contributions
    const recentContribs = await db.listContributions({
      tenantId: persona.tenantId,
      personaId: persona.id,
      limit: 5,
    });
    for (const c of recentContribs) {
      recentActivity.push({
        type: 'contribution',
        tenantId: persona.tenantId,
        personaId: persona.id,
        summary: `${c.contributionType}: +${c.pokwScore.toFixed(2)} PoKW`,
        createdAt: c.createdAt,
      });
    }

    // Recent wallet events
    const recentWallet = await db.listWalletEvents({
      tenantId: persona.tenantId,
      personaId: persona.id,
      limit: 5,
    });
    for (const w of recentWallet) {
      recentActivity.push({
        type: 'wallet',
        tenantId: persona.tenantId,
        personaId: persona.id,
        summary: `${w.eventType}: ${w.amount ?? ''} ${w.tokenType ?? ''}`,
        createdAt: w.createdAt,
      });
    }
  }

  // Sort by date and take top 20
  recentActivity.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const topActivity = recentActivity.slice(0, 20);

  return {
    kybeDid,
    rootDidProxyId: personas[0]?.rootDidProxyId,
    authProfile,
    personas: personaDetails,
    aggregatedStats: {
      totalPokw,
      totalContributions,
      totalEngagementEvents,
      totalRewardsEarned,
      franchiseCount: franchiseIds.size,
      tenantCount: tenantIds.size,
    },
    recentActivity: topActivity,
  };
}

// ============================================================================
// AUDIT LOG OPERATIONS
// ============================================================================

/**
 * Log an audit event
 */
async function logAuditEvent(input: {
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
}): Promise<void> {
  try {
    await db.createAuditLog(input);
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('[CRM] Audit log failed:', error);
  }
}

/**
 * List audit logs
 */
export async function listAuditLogs(
  options: {
    tenantId?: string;
    tableName?: string;
    recordId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }
): Promise<CrmAuditLog[]> {
  return db.listAuditLogs(options);
}

// ============================================================================
// COPILOT HISTORY OPERATIONS
// ============================================================================

/**
 * Record a CopilotKit interaction
 */
export async function recordCopilotHistory(
  input: RecordCopilotHistoryInput
): Promise<CrmCopilotHistory> {
  return db.createCopilotHistory(input);
}

/**
 * List copilot history
 */
export async function listCopilotHistory(
  options: {
    tenantId?: string;
    personaId?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<CrmCopilotHistory[]> {
  return db.listCopilotHistory(options);
}

// ============================================================================
// SEGMENT OPERATIONS
// ============================================================================

/**
 * Create a segment
 */
export async function createSegment(input: CreateSegmentInput): Promise<CrmSegment> {
  return db.createSegment(input);
}

/**
 * List segments for a tenant
 */
export async function listSegments(tenantId: TenantId): Promise<CrmSegment[]> {
  return db.listSegments({ tenantId });
}

/**
 * Add persona to segment
 */
export async function addPersonaToSegment(
  segmentId: string,
  personaId: string
): Promise<void> {
  await db.addSegmentMember(segmentId, personaId);
}

/**
 * Remove persona from segment
 */
export async function removePersonaFromSegment(
  segmentId: string,
  personaId: string
): Promise<void> {
  await db.removeSegmentMember(segmentId, personaId);
}

/**
 * Get segment members
 */
export async function getSegmentMembers(segmentId: string): Promise<string[]> {
  return db.getSegmentMembers(segmentId);
}

// ============================================================================
// AUTH PROFILE OPERATIONS
// ============================================================================

/**
 * Get auth profile by email
 */
export async function getAuthProfileByEmail(email: string): Promise<CrmAuthProfile | null> {
  return db.getAuthProfileByEmail(email);
}

/**
 * Get personas controlled by an auth profile
 */
export async function getAuthProfilePersonas(authProfileId: string): Promise<CrmPersona[]> {
  return db.getAuthProfilePersonas(authProfileId);
}

/**
 * Link a persona to an auth profile
 */
export async function linkPersonaToAuthProfile(
  authProfileId: string,
  personaId: string,
  isPrimary = false
): Promise<void> {
  await db.linkPersonaToAuthProfile(authProfileId, personaId, isPrimary);
}

// Service export for API routes
export const crmService = {
  // Franchise operations
  listFranchises,
  getFranchise,
  getFranchiseTenants,
  listTenants,
  getTenant,
  getAgentiqAnchor,
  getAgentiqHierarchy,
  canFranchiseGovernTenant,
  getAgentiqTenantHierarchy,
  
  // Persona operations
  getPersonaSummary,
  listPersonas,
  createPersona,
  getPersonasByKybeDid,
  
  // Contribution operations
  recordContribution,
  listContributions,
  getTopContributors,
  
  // Engagement operations
  recordEngagement,
  listEngagementEvents,
  
  // Reward operations
  proposeRewards,
  updateReward,
  listRewards,
  
  // Entitlement operations
  getPersonaEntitlements,
  createEntitlement,
  updateEntitlement,
  
  // Wallet operations
  recordWalletEvent,
  listWalletEvents,
  
  // Reputation operations
  recordReputationEvent,
  listReputationEvents,
  
  // Profile operations
  getUnifiedProfile,
  
  // Audit operations
  listAuditLogs,
  
  // Copilot operations
  recordCopilotHistory,
  listCopilotHistory,
  
  // Segment operations
  createSegment,
  listSegments,
  addPersonaToSegment,
  removePersonaFromSegment,
  getSegmentMembers,
  
  // Auth operations
  getAuthProfileByEmail,
  getAuthProfilePersonas,
  linkPersonaToAuthProfile,
};
