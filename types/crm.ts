/**
 * AgentiQ CRM Type Definitions
 * 
 * Phase 1: Core types for personas, contributions, engagement, entitlements, rewards, and segments
 * Enhanced: Franchises, Tenants hierarchy, Auth Profiles, Wallet Events, Reputation
 * Phase 1c: Platform-level accounts, Registry profiles, Auto-provisioning
 * Phase 1d: Admin role hierarchy (Uber Admins, Super Admins, Category Admins)
 * 
 * HIERARCHY (top to bottom):
 *   AgentiQ Platform Account (optional - platform-level users)
 *     └── Franchise (optional - user may have direct tenant access)
 *           └── Tenant (application)
 *                 └── Persona (auto-created on ANY account signup)
 * 
 * ADMIN HIERARCHY (outside → inside):
 *   1. Uber Admins - Estate-wide, outside hierarchy, can manage all
 *   2. Category Uber Admins - Domain-specific estate-wide (e.g., Content, Ecommerce)
 *   3. Platform Super Admins - Platform-wide admin rights
 *   4. Franchise Super Admins - Franchise-wide admin rights (all tenants)
 *   5. Tenant Super Admins - Tenant-specific admin rights
 *   6. Category Admins - Domain-specific at their access level
 * 
 * KEY PRINCIPLES:
 * - Users can have accounts at ANY layer independently
 * - Any account signup auto-creates persona + registry profile
 * - All data exposed to AgentiQ platform per DiDQube policy
 * - Kybe DID is the universal identifier across all layers
 * 
 * IDENTITY: Kybe DID → Root DID → Auth Profile → Multiple Personas
 */

// ============================================================================
// PLATFORM ACCOUNT TYPES (Top-level - sits above Franchises)
// ============================================================================

export type PlatformAccountType = 'standard' | 'operator' | 'admin' | 'super_admin';
export type PrivacyLevel = 'minimal' | 'standard' | 'enhanced';
export type VisibilityLevel = 'private' | 'standard' | 'public';
export type OriginLayer = 'platform' | 'franchise' | 'tenant';
export type PlatformFranchiseRole = 'member' | 'manager' | 'owner';

export interface CrmPlatformAccount {
  id: string;
  kybeDid?: string | null;
  authProfileId?: string | null;
  accountType: PlatformAccountType;
  displayName?: string | null;
  avatarUrl?: string | null;
  settings: Record<string, unknown>;
  didqubeConsentGiven: boolean;
  didqubeConsentAt?: string | null;
  privacyLevel: PrivacyLevel;
  isActive: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformAccountInput {
  kybeDid?: string;
  authProfileId?: string;
  accountType?: PlatformAccountType;
  displayName?: string;
  avatarUrl?: string;
  settings?: Record<string, unknown>;
  privacyLevel?: PrivacyLevel;
}

export interface CrmPlatformFranchiseAccess {
  id: string;
  platformAccountId: string;
  franchiseId: string;
  accessRole: PlatformFranchiseRole;
  grantedByPlatformAccountId?: string | null;
  grantedAt: string;
  createdAt: string;
}

// ============================================================================
// REGISTRY PROFILE TYPES (Auto-created for ANY account signup)
// ============================================================================

export interface CrmRegistryProfile {
  id: string;
  kybeDid: string;
  platformAccountId?: string | null;
  authProfileId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  reputationBucket?: ReputationBucket | null;
  reputationScoreCached?: number | null;
  reputationUpdatedAt?: string | null;
  visibilityLevel: VisibilityLevel;
  totalPokwAllTenants: number;
  totalContributionsAllTenants: number;
  totalRewardsEarned: Record<TokenType, number>;
  originLayer: OriginLayer;
  originTenantId?: string | null;
  originFranchiseId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistryProfileInput {
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
}

export interface CrmRegistryPersonaLink {
  id: string;
  registryProfileId: string;
  personaId: string;
  tenantId: string;
  isPrimaryForTenant: boolean;
  linkedAt: string;
}

// ============================================================================
// USER ACCOUNT LAYERS (Summary view)
// ============================================================================

export interface UserAccountLayers {
  kybeDid: string;
  registryProfileId: string;
  platformAccountId?: string | null;
  platformAccountType?: PlatformAccountType | null;
  franchiseAccess: Array<{
    franchiseId: string;
    franchiseName: string;
    accessRole: PlatformFranchiseRole;
  }>;
  tenantPersonas: Array<{
    tenantId: string;
    tenantName: string;
    franchiseId: string;
    personaId: string;
    personaDisplayName?: string | null;
  }>;
  originLayer: OriginLayer;
  createdAt: string;
}

// ============================================================================
// FRANCHISE TYPES (Owned by Platform, contains Tenants)
// ============================================================================

export interface CrmFranchise {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFranchiseInput {
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  config?: Record<string, unknown>;
}

// ============================================================================
// TENANT TYPES (Owned by Franchises)
// ============================================================================

export type TenantId = 'qriptonian' | 'kn0w1' | string;

export const SUPPORTED_TENANTS: TenantId[] = ['qriptonian', 'kn0w1'];

export interface CrmTenant {
  id: string;
  franchiseId: string;
  slug: string;
  name: string;
  description?: string | null;
  domain?: string | null;
  config: Record<string, unknown>;
  supportedTokens: TokenType[];
  defaultModalities: Modality[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  franchiseId: string;
  slug: string;
  name: string;
  description?: string;
  domain?: string;
  config?: Record<string, unknown>;
  supportedTokens?: TokenType[];
  defaultModalities?: Modality[];
}

export interface TenantConfig {
  id: TenantId;
  name: string;
  description?: string;
  tokens: TokenType[];
  defaultModalities: Modality[];
}

export const TENANT_CONFIGS: Record<string, TenantConfig> = {
  qriptonian: {
    id: 'qriptonian',
    name: 'Qriptonian Magazine',
    description: 'Agentic magazine for the Qripto ecosystem',
    tokens: ['QCT', 'QOYN'],
    defaultModalities: ['read', 'watch', 'listen'],
  },
  kn0w1: {
    id: 'kn0w1',
    name: 'Kn0w1 Application',
    description: 'Knowledge work and learning platform',
    tokens: ['QCT', 'KNYT'],
    defaultModalities: ['read', 'interact'],
  },
};

// ============================================================================
// AUTH PROFILE TYPES (Master Account)
// ============================================================================

export interface CrmAuthProfile {
  id: string;
  email: string;
  passwordHash?: string | null;
  oauthProviders: Record<string, string>;
  kybeDid?: string | null;
  rootDidProxyId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuthProfileInput {
  email: string;
  password?: string;  // Will be hashed
  kybeDid?: string;
  rootDidProxyId?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface AuthProfilePersonaLink {
  id: string;
  authProfileId: string;
  personaId: string;
  isPrimary: boolean;
  alias?: string | null;
  createdAt: string;
}

// ============================================================================
// PERSONA TYPES
// ============================================================================

export type PersonaState = 'anonymous' | 'pseudonymous' | 'identifiable';

export interface CrmPersona {
  id: string;
  tenantId: string;
  
  // Identity references (DIDQube integration)
  kybeDid?: string | null;
  rootDidProxyId?: string | null;
  personaState: PersonaState;
  
  // External references
  externalUserId?: string | null;
  displayName?: string | null;
  email?: string | null;
  
  // Link to existing persona DataQube
  personaDataqubeId?: string | null;
  
  // Enhanced fields (Phase 1b)
  primaryWalletAddress?: string | null;
  authProfileId?: string | null;
  reputationBucket?: ReputationBucket | null;
  reputationBucketUpdatedAt?: string | null;
  primaryFranchiseId?: string | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Reputation bucket from RQH (DiDQube compliant)
export type ReputationBucket = 'green' | 'amber' | 'red';

export interface PersonaFranchiseMembership {
  id: string;
  personaId: string;
  franchiseId: string;
  role: 'member' | 'contributor' | 'admin';
  joinedAt: string;
  createdAt: string;
}

export interface CreatePersonaInput {
  tenantId: TenantId;
  kybeDid?: string;
  rootDidProxyId?: string;
  personaState?: PersonaState;
  externalUserId?: string;
  displayName?: string;
  email?: string;
  personaDataqubeId?: string;
}

export interface PersonaSummary {
  persona: CrmPersona;
  pokw: {
    total: number;
    last30Days: number;
  };
  recentContributions: CrmContribution[];
  entitlements: CrmEntitlement[];
}

// ============================================================================
// CONTRIBUTION TYPES
// ============================================================================

export type ContributionType = 
  | 'article_created'
  | 'article_edited'
  | 'comment_posted'
  | 'review_submitted'
  | 'content_curated'
  | 'quiz_completed'
  | 'course_completed'
  | 'resource_shared'
  | 'custom';

export interface CrmContribution {
  id: string;
  tenantId: string;
  personaId: string;
  
  // Content references
  qubeId?: string | null;
  clusterqubeId?: string | null;
  
  // Contribution details
  contributionType: string;
  units: number;
  basePokwWeight: number;
  pokwScore: number;
  
  // Future PoR/PoS/PoP scores (populated by dedicated agents)
  porScore?: number | null;
  posScore?: number | null;
  popScore?: number | null;
  
  // Metadata
  source?: string | null;
  createdAt: string;
}

export interface RecordContributionInput {
  tenantId: TenantId;
  personaId: string;
  qubeId?: string;
  clusterQubeId?: string;
  contributionType: string;
  units?: number;
  basePokwWeight?: number;
  source?: string;
}

export interface RecordContributionResponse {
  id: string;
  pokwScore: number;
}

// ============================================================================
// ENGAGEMENT EVENT TYPES
// ============================================================================

export type EngagementEventType = 
  | 'view'
  | 'complete'
  | 'comment'
  | 'share'
  | 'like'
  | 'bookmark'
  | 'download'
  | 'custom';

/**
 * PoKW delta lookup table for engagement events
 * These values determine how much PoKW is awarded for each event type
 * 
 * Future: These could be configurable per tenant or dynamically adjusted
 */
export const ENGAGEMENT_POKW_WEIGHTS: Record<EngagementEventType, number> = {
  view: 0.5,
  complete: 2.0,
  comment: 1.0,
  share: 1.5,
  like: 0.2,
  bookmark: 0.3,
  download: 0.5,
  custom: 1.0,
};

export interface CrmEngagementEvent {
  id: string;
  tenantId: string;
  personaId: string;
  
  // Content references
  qubeId?: string | null;
  clusterqubeId?: string | null;
  
  // Event details
  eventType: string;
  weight: number;
  pokwDelta: number;
  
  // Metadata
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface RecordEngagementInput {
  tenantId: TenantId;
  personaId: string;
  qubeId?: string;
  clusterQubeId?: string;
  eventType: string;
  weight?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordEngagementResponse {
  id: string;
  pokwDelta: number;
}

// ============================================================================
// ENTITLEMENT TYPES
// ============================================================================

export type Modality = 'read' | 'watch' | 'listen' | 'interact';
export type AccessLevel = 'none' | 'preview' | 'full';
export type EntitlementOrigin = 'manual' | 'pokw' | 'purchase' | 'airdrop' | 'subscription';

export interface CrmEntitlement {
  id: string;
  tenantId: string;
  personaId: string;
  
  // Content references
  clusterqubeId: string;
  qubeId?: string | null;
  
  // Access details
  modality: Modality;
  accessLevel: AccessLevel;
  origin: EntitlementOrigin;
  
  // Expiry
  expiresAt?: string | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntitlementInput {
  tenantId: TenantId;
  personaId: string;
  clusterQubeId: string;
  qubeId?: string;
  modality: Modality;
  accessLevel?: AccessLevel;
  origin?: EntitlementOrigin;
  expiresAt?: string;
}

export interface UpdateEntitlementInput {
  accessLevel?: AccessLevel;
  origin?: EntitlementOrigin;
  expiresAt?: string | null;
}

// ============================================================================
// REWARD TYPES
// ============================================================================

export type TokenType = 'QCT' | 'QOYN' | 'KNYT';
export type RewardStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

export interface CrmReward {
  id: string;
  tenantId: string;
  personaId: string;
  
  // Period
  periodStart: string;
  periodEnd: string;
  
  // PoKW and token details
  pokwScoreUsed: number;
  tokenType: TokenType;
  amount: number;
  
  // Status
  status: RewardStatus;
  
  // Blockchain reference
  txHash?: string | null;
  chainId?: string | null;
  
  // Notes
  notes?: string | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ProposeRewardsInput {
  tenantId: TenantId;
  periodStart: string;
  periodEnd: string;
  budget: Partial<Record<TokenType, number>>;
  topN?: number;
}

export interface ProposeRewardsResponse {
  rewards: CrmReward[];
  totalPokw: number;
  allocations: Record<TokenType, number>;
}

export interface UpdateRewardInput {
  status?: RewardStatus;
  txHash?: string;
  chainId?: string;
  notes?: string;
}

// ============================================================================
// SEGMENT TYPES
// ============================================================================

export interface CrmSegment {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  ruleDefinition?: Record<string, unknown> | null;
  isDynamic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmSegmentMember {
  id: string;
  segmentId: string;
  personaId: string;
  createdAt: string;
}

export interface CreateSegmentInput {
  tenantId: TenantId;
  name: string;
  description?: string;
  ruleDefinition?: Record<string, unknown>;
  isDynamic?: boolean;
}

// ============================================================================
// TOP CONTRIBUTORS
// ============================================================================

export interface TopContributor {
  personaId: string;
  displayName?: string | null;
  totalPokw: number;
  contributionCount: number;
  engagementCount: number;
}

export interface TopContributorsQuery {
  tenantId: TenantId;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
}

// ============================================================================
// POKW COMPUTATION (MVP)
// ============================================================================

/**
 * MVP PoKW computation function
 * 
 * Current: pokw_score = units * base_pokw_weight
 * Future: pokw_score = f(units, baseWeight, por_score, pos_score, pop_score)
 * 
 * This function is isolated to allow easy extension for PoR/PoS/PoP integration
 */
export function computePokwScore(
  units: number,
  basePokwWeight: number,
  _porScore?: number | null,  // Future: Proof of Reputation
  _posScore?: number | null,  // Future: Proof of Stake
  _popScore?: number | null   // Future: Proof of Participation
): number {
  // MVP: Simple multiplication
  const baseScore = units * basePokwWeight;
  
  // Future: Incorporate PoR/PoS/PoP scores
  // Example future formula:
  // const porMultiplier = porScore ? 1 + (porScore / 100) : 1;
  // const posMultiplier = posScore ? 1 + (posScore / 100) : 1;
  // const popMultiplier = popScore ? 1 + (popScore / 100) : 1;
  // return baseScore * porMultiplier * posMultiplier * popMultiplier;
  
  return baseScore;
}

/**
 * Get PoKW delta for an engagement event type
 */
export function getEngagementPokwDelta(
  eventType: string,
  weight: number = 1
): number {
  const baseWeight = ENGAGEMENT_POKW_WEIGHTS[eventType as EngagementEventType] 
    ?? ENGAGEMENT_POKW_WEIGHTS.custom;
  return baseWeight * weight;
}

// ============================================================================
// DATABASE ROW TYPES (snake_case for direct DB mapping)
// ============================================================================

export interface CrmPersonaRow {
  id: string;
  tenant_id: string;
  kybe_did: string | null;
  root_did_proxy_id: string | null;
  persona_state: PersonaState;
  external_user_id: string | null;
  display_name: string | null;
  email: string | null;
  persona_dataqube_id: string | null;
  // Enhanced fields (Phase 1b)
  primary_wallet_address: string | null;
  auth_profile_id: string | null;
  reputation_bucket: string | null;
  reputation_bucket_updated_at: string | null;
  primary_franchise_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContributionRow {
  id: string;
  tenant_id: string;
  persona_id: string;
  qube_id: string | null;
  clusterqube_id: string | null;
  contribution_type: string;
  units: number;
  base_pokw_weight: number;
  pokw_score: number;
  por_score: number | null;
  pos_score: number | null;
  pop_score: number | null;
  source: string | null;
  created_at: string;
}

export interface CrmEngagementEventRow {
  id: string;
  tenant_id: string;
  persona_id: string;
  qube_id: string | null;
  clusterqube_id: string | null;
  event_type: string;
  weight: number;
  pokw_delta: number;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CrmEntitlementRow {
  id: string;
  tenant_id: string;
  persona_id: string;
  clusterqube_id: string;
  qube_id: string | null;
  modality: Modality;
  access_level: AccessLevel;
  origin: EntitlementOrigin;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmRewardRow {
  id: string;
  tenant_id: string;
  persona_id: string;
  period_start: string;
  period_end: string;
  pokw_score_used: number;
  token_type: TokenType;
  amount: number;
  status: RewardStatus;
  tx_hash: string | null;
  chain_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmSegmentRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  rule_definition: Record<string, unknown> | null;
  is_dynamic: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmSegmentMemberRow {
  id: string;
  segment_id: string;
  persona_id: string;
  created_at: string;
}

// ============================================================================
// ROW TO TYPE CONVERTERS
// ============================================================================

export function rowToPersona(row: CrmPersonaRow): CrmPersona {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kybeDid: row.kybe_did,
    rootDidProxyId: row.root_did_proxy_id,
    personaState: row.persona_state,
    externalUserId: row.external_user_id,
    displayName: row.display_name,
    email: row.email,
    personaDataqubeId: row.persona_dataqube_id,
    // Enhanced fields (Phase 1b)
    primaryWalletAddress: row.primary_wallet_address,
    authProfileId: row.auth_profile_id,
    reputationBucket: row.reputation_bucket as ReputationBucket | null,
    reputationBucketUpdatedAt: row.reputation_bucket_updated_at,
    primaryFranchiseId: row.primary_franchise_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToContribution(row: CrmContributionRow): CrmContribution {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    qubeId: row.qube_id,
    clusterqubeId: row.clusterqube_id,
    contributionType: row.contribution_type,
    units: Number(row.units),
    basePokwWeight: Number(row.base_pokw_weight),
    pokwScore: Number(row.pokw_score),
    porScore: row.por_score ? Number(row.por_score) : null,
    posScore: row.pos_score ? Number(row.pos_score) : null,
    popScore: row.pop_score ? Number(row.pop_score) : null,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function rowToEngagementEvent(row: CrmEngagementEventRow): CrmEngagementEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    qubeId: row.qube_id,
    clusterqubeId: row.clusterqube_id,
    eventType: row.event_type,
    weight: Number(row.weight),
    pokwDelta: Number(row.pokw_delta),
    source: row.source,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function rowToEntitlement(row: CrmEntitlementRow): CrmEntitlement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    clusterqubeId: row.clusterqube_id,
    qubeId: row.qube_id,
    modality: row.modality,
    accessLevel: row.access_level,
    origin: row.origin,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToReward(row: CrmRewardRow): CrmReward {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    pokwScoreUsed: Number(row.pokw_score_used),
    tokenType: row.token_type,
    amount: Number(row.amount),
    status: row.status,
    txHash: row.tx_hash,
    chainId: row.chain_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToSegment(row: CrmSegmentRow): CrmSegment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    ruleDefinition: row.rule_definition,
    isDynamic: row.is_dynamic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// WALLET EVENT TYPES (x402 Integration)
// ============================================================================

export type WalletEventType = 
  | 'deposit'
  | 'withdrawal'
  | 'transfer_in'
  | 'transfer_out'
  | 'reward_claim'
  | 'purchase'
  | 'nft_mint'
  | 'nft_transfer'
  | 'stake'
  | 'unstake'
  | 'fee';

export type WalletEventStatus = 'pending' | 'confirmed' | 'failed' | 'reverted';

export interface CrmWalletEvent {
  id: string;
  tenantId: string;
  personaId: string;
  walletAddress: string;
  eventType: WalletEventType;
  
  // Token details
  tokenType?: string | null;  // 'ETH', 'MATIC', 'QCT', 'QOYN', 'KNYT', 'NFT'
  tokenAddress?: string | null;
  amount?: number | null;
  
  // NFT specific
  nftTokenId?: string | null;
  nftMetadata?: Record<string, unknown> | null;
  
  // Blockchain reference
  chainId: string;
  txHash?: string | null;
  blockNumber?: number | null;
  
  // Counterparty
  counterpartyAddress?: string | null;
  counterpartyPersonaId?: string | null;
  
  // Status
  status: WalletEventStatus;
  
  // Metadata
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  createdAt: string;
}

export interface RecordWalletEventInput {
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
}

// ============================================================================
// REPUTATION EVENT TYPES (DiDQube/RQH Integration)
// ============================================================================

export type ReputationEventType = 
  | 'bucket_change'
  | 'flag_received'
  | 'flag_resolved'
  | 'dispute_filed'
  | 'dispute_resolved'
  | 'exoneration';

export interface CrmReputationEvent {
  id: string;
  tenantId: string;
  personaId: string;
  eventType: ReputationEventType;
  
  // Reputation details (privacy-preserving)
  reputationBucket?: ReputationBucket | null;
  previousBucket?: ReputationBucket | null;
  
  // Context
  reason?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  
  // DiDQube compliance
  cohortId?: string | null;
  isAnonymized: boolean;
  
  // Metadata
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  createdAt: string;
}

export interface RecordReputationEventInput {
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
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface CrmAuditLog {
  id: string;
  tenantId?: string | null;
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  changedByPersonaId?: string | null;
  changedByAuthProfileId?: string | null;
  changedByAgentId?: string | null;
  changeReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

// ============================================================================
// COPILOT HISTORY TYPES
// ============================================================================

export interface CrmCopilotHistory {
  id: string;
  tenantId?: string | null;
  personaId?: string | null;
  queryText: string;
  parsedIntent?: string | null;
  extractedEntities?: Record<string, unknown> | null;
  toolCalls?: Record<string, unknown>[] | null;
  executedActions?: string[] | null;
  resultSummary?: string | null;
  resultCount?: number | null;
  executionTimeMs?: number | null;
  success: boolean;
  errorMessage?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  createdAt: string;
}

export interface RecordCopilotHistoryInput {
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
}

// ============================================================================
// INTEREST TAG TYPES
// ============================================================================

export interface CrmInterestTag {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  description?: string | null;
  parentTagId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmPersonaInterest {
  id: string;
  personaId: string;
  tagId: string;
  weight: number;
  source: 'explicit' | 'inferred' | 'imported';
  createdAt: string;
}

// ============================================================================
// UNIFIED PROFILE VIEW (Cross-Tenant)
// ============================================================================

/**
 * Unified profile view for a Kybe DID holder
 * Shows activity across ALL tenants they participate in
 */
export interface UnifiedProfile {
  kybeDid: string;
  rootDidProxyId?: string | null;
  authProfile?: CrmAuthProfile | null;
  
  // All personas controlled by this identity
  personas: Array<{
    persona: CrmPersona;
    tenant: CrmTenant;
    franchise: CrmFranchise;
    isPrimary: boolean;
  }>;
  
  // Aggregated stats across all tenants
  aggregatedStats: {
    totalPokw: number;
    totalContributions: number;
    totalEngagementEvents: number;
    totalRewardsEarned: Record<TokenType, number>;
    franchiseCount: number;
    tenantCount: number;
  };
  
  // Recent activity (across all tenants)
  recentActivity: Array<{
    type: 'contribution' | 'engagement' | 'reward' | 'wallet' | 'reputation';
    tenantId: string;
    personaId: string;
    summary: string;
    createdAt: string;
  }>;
}

// ============================================================================
// FRANCHISE/TENANT SWITCHER CONTEXT
// ============================================================================

export interface CrmContext {
  currentFranchise?: CrmFranchise | null;
  currentTenant?: CrmTenant | null;
  availableFranchises: CrmFranchise[];
  availableTenants: CrmTenant[];
  
  // Filters
  showAllFranchises: boolean;
  showAllTenants: boolean;
}

// ============================================================================
// ADDITIONAL ROW TYPES FOR NEW TABLES
// ============================================================================

export interface CrmFranchiseRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmTenantRow {
  id: string;
  franchise_id: string;
  slug: string;
  name: string;
  description: string | null;
  domain: string | null;
  config: Record<string, unknown>;
  supported_tokens: string[];
  default_modalities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmAuthProfileRow {
  id: string;
  email: string;
  password_hash: string | null;
  oauth_providers: Record<string, string>;
  kybe_did: string | null;
  root_did_proxy_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmWalletEventRow {
  id: string;
  tenant_id: string;
  persona_id: string;
  wallet_address: string;
  event_type: string;
  token_type: string | null;
  token_address: string | null;
  amount: number | null;
  nft_token_id: string | null;
  nft_metadata: Record<string, unknown> | null;
  chain_id: string;
  tx_hash: string | null;
  block_number: number | null;
  counterparty_address: string | null;
  counterparty_persona_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  source: string | null;
  created_at: string;
}

export interface CrmReputationEventRow {
  id: string;
  tenant_id: string;
  persona_id: string;
  event_type: string;
  reputation_bucket: string | null;
  previous_bucket: string | null;
  reason: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  cohort_id: string | null;
  is_anonymized: boolean;
  metadata: Record<string, unknown> | null;
  source: string | null;
  created_at: string;
}

export interface CrmAuditLogRow {
  id: string;
  tenant_id: string | null;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  changed_by_persona_id: string | null;
  changed_by_auth_profile_id: string | null;
  changed_by_agent_id: string | null;
  change_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================================================
// ROW TO TYPE CONVERTERS FOR NEW TABLES
// ============================================================================

export function rowToFranchise(row: CrmFranchiseRow): CrmFranchise {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    config: row.config,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToTenant(row: CrmTenantRow): CrmTenant {
  return {
    id: row.id,
    franchiseId: row.franchise_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    domain: row.domain,
    config: row.config,
    supportedTokens: row.supported_tokens as TokenType[],
    defaultModalities: row.default_modalities as Modality[],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToAuthProfile(row: CrmAuthProfileRow): CrmAuthProfile {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    oauthProviders: row.oauth_providers,
    kybeDid: row.kybe_did,
    rootDidProxyId: row.root_did_proxy_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    emailVerified: row.email_verified,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToWalletEvent(row: CrmWalletEventRow): CrmWalletEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    walletAddress: row.wallet_address,
    eventType: row.event_type as WalletEventType,
    tokenType: row.token_type,
    tokenAddress: row.token_address,
    amount: row.amount,
    nftTokenId: row.nft_token_id,
    nftMetadata: row.nft_metadata,
    chainId: row.chain_id,
    txHash: row.tx_hash,
    blockNumber: row.block_number,
    counterpartyAddress: row.counterparty_address,
    counterpartyPersonaId: row.counterparty_persona_id,
    status: row.status as WalletEventStatus,
    metadata: row.metadata,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function rowToReputationEvent(row: CrmReputationEventRow): CrmReputationEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personaId: row.persona_id,
    eventType: row.event_type as ReputationEventType,
    reputationBucket: row.reputation_bucket as ReputationBucket | null,
    previousBucket: row.previous_bucket as ReputationBucket | null,
    reason: row.reason,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    cohortId: row.cohort_id,
    isAnonymized: row.is_anonymized,
    metadata: row.metadata,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function rowToAuditLog(row: CrmAuditLogRow): CrmAuditLog {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action as AuditAction,
    oldValues: row.old_values,
    newValues: row.new_values,
    changedFields: row.changed_fields,
    changedByPersonaId: row.changed_by_persona_id,
    changedByAuthProfileId: row.changed_by_auth_profile_id,
    changedByAgentId: row.changed_by_agent_id,
    changeReason: row.change_reason,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

// ============================================================================
// PLATFORM ACCOUNT & REGISTRY PROFILE ROW TYPES
// ============================================================================

export interface CrmPlatformAccountRow {
  id: string;
  kybe_did: string | null;
  auth_profile_id: string | null;
  account_type: string;
  display_name: string | null;
  avatar_url: string | null;
  settings: Record<string, unknown>;
  didqube_consent_given: boolean;
  didqube_consent_at: string | null;
  privacy_level: string;
  is_active: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmPlatformFranchiseAccessRow {
  id: string;
  platform_account_id: string;
  franchise_id: string;
  access_role: string;
  granted_by_platform_account_id: string | null;
  granted_at: string;
  created_at: string;
}

export interface CrmRegistryProfileRow {
  id: string;
  kybe_did: string;
  platform_account_id: string | null;
  auth_profile_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  reputation_bucket: string | null;
  reputation_score_cached: number | null;
  reputation_updated_at: string | null;
  visibility_level: string;
  total_pokw_all_tenants: number;
  total_contributions_all_tenants: number;
  total_rewards_earned: Record<string, number>;
  origin_layer: string;
  origin_tenant_id: string | null;
  origin_franchise_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmRegistryPersonaLinkRow {
  id: string;
  registry_profile_id: string;
  persona_id: string;
  tenant_id: string;
  is_primary_for_tenant: boolean;
  linked_at: string;
}

// ============================================================================
// PLATFORM ACCOUNT & REGISTRY PROFILE CONVERTERS
// ============================================================================

export function rowToPlatformAccount(row: CrmPlatformAccountRow): CrmPlatformAccount {
  return {
    id: row.id,
    kybeDid: row.kybe_did,
    authProfileId: row.auth_profile_id,
    accountType: row.account_type as PlatformAccountType,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    settings: row.settings,
    didqubeConsentGiven: row.didqube_consent_given,
    didqubeConsentAt: row.didqube_consent_at,
    privacyLevel: row.privacy_level as PrivacyLevel,
    isActive: row.is_active,
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToPlatformFranchiseAccess(row: CrmPlatformFranchiseAccessRow): CrmPlatformFranchiseAccess {
  return {
    id: row.id,
    platformAccountId: row.platform_account_id,
    franchiseId: row.franchise_id,
    accessRole: row.access_role as PlatformFranchiseRole,
    grantedByPlatformAccountId: row.granted_by_platform_account_id,
    grantedAt: row.granted_at,
    createdAt: row.created_at,
  };
}

export function rowToRegistryProfile(row: CrmRegistryProfileRow): CrmRegistryProfile {
  return {
    id: row.id,
    kybeDid: row.kybe_did,
    platformAccountId: row.platform_account_id,
    authProfileId: row.auth_profile_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    reputationBucket: row.reputation_bucket as ReputationBucket | null,
    reputationScoreCached: row.reputation_score_cached,
    reputationUpdatedAt: row.reputation_updated_at,
    visibilityLevel: row.visibility_level as VisibilityLevel,
    totalPokwAllTenants: row.total_pokw_all_tenants,
    totalContributionsAllTenants: row.total_contributions_all_tenants,
    totalRewardsEarned: row.total_rewards_earned as Record<TokenType, number>,
    originLayer: row.origin_layer as OriginLayer,
    originTenantId: row.origin_tenant_id,
    originFranchiseId: row.origin_franchise_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToRegistryPersonaLink(row: CrmRegistryPersonaLinkRow): CrmRegistryPersonaLink {
  return {
    id: row.id,
    registryProfileId: row.registry_profile_id,
    personaId: row.persona_id,
    tenantId: row.tenant_id,
    isPrimaryForTenant: row.is_primary_for_tenant,
    linkedAt: row.linked_at,
  };
}

// ============================================================================
// ADMIN ROLE TYPES
// ============================================================================

/**
 * Admin Role Types:
 * - uber_admin: Estate-wide, outside hierarchy, can manage ALL
 * - category_uber_admin: Domain-specific estate-wide (e.g., Content Marketing Uber Admin)
 * - platform_super_admin: Platform-wide admin rights
 * - franchise_super_admin: Franchise-wide admin rights (all tenants)
 * - tenant_super_admin: Tenant-specific admin rights
 * - category_admin: Domain-specific at their access level
 */
export type AdminRoleType =
  | 'uber_admin'
  | 'category_uber_admin'
  | 'platform_super_admin'
  | 'franchise_super_admin'
  | 'tenant_super_admin'
  | 'category_admin';

/**
 * Admin domain categories
 */
export type AdminCategorySlug =
  | 'content'
  | 'marketing'
  | 'sales'
  | 'social'
  | 'ecommerce'
  | 'support'
  | 'analytics'
  | 'finance'
  | 'operations'
  | 'identity'
  | string;

export interface CrmAdminCategory {
  id: string;
  slug: AdminCategorySlug;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  manage_users: boolean;
  manage_admins: boolean;
  manage_settings: boolean;
  view_audit_logs: boolean;
  export_data: boolean;
}

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  read: true,
  write: true,
  delete: false,
  manage_users: false,
  manage_admins: false,
  manage_settings: false,
  view_audit_logs: true,
  export_data: false,
};

export const UBER_ADMIN_PERMISSIONS: AdminPermissions = {
  read: true,
  write: true,
  delete: true,
  manage_users: true,
  manage_admins: true,
  manage_settings: true,
  view_audit_logs: true,
  export_data: true,
};

export interface CrmAdminRole {
  id: string;
  platformAccountId?: string | null;
  authProfileId?: string | null;
  kybeDid?: string | null;
  roleType: AdminRoleType;
  franchiseId?: string | null;
  tenantId?: string | null;
  categoryId?: string | null;
  permissions: AdminPermissions;
  grantedByAdminRoleId?: string | null;
  grantedAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmAdminRoleExpanded extends CrmAdminRole {
  adminDisplayName?: string | null;
  platformAccountType?: PlatformAccountType | null;
  categorySlug?: AdminCategorySlug | null;
  categoryName?: string | null;
  franchiseSlug?: string | null;
  franchiseName?: string | null;
  tenantSlug?: string | null;
  tenantName?: string | null;
  scopeDescription: string;
  accessLevel: number;
}

export interface CreateAdminRoleInput {
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
}

export interface AdminAccessCheckInput {
  kybeDid: string;
  action: keyof AdminPermissions;
  franchiseId?: string;
  tenantId?: string;
  categorySlug?: AdminCategorySlug;
}

// ============================================================================
// ADMIN ROLE ROW TYPES
// ============================================================================

export interface CrmAdminCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmAdminRoleRow {
  id: string;
  platform_account_id: string | null;
  auth_profile_id: string | null;
  kybe_did: string | null;
  role_type: string;
  franchise_id: string | null;
  tenant_id: string | null;
  category_id: string | null;
  permissions: AdminPermissions;
  granted_by_admin_role_id: string | null;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmAdminRoleExpandedRow extends CrmAdminRoleRow {
  admin_display_name: string | null;
  platform_account_type: string | null;
  category_slug: string | null;
  category_name: string | null;
  franchise_slug: string | null;
  franchise_name: string | null;
  tenant_slug: string | null;
  tenant_name: string | null;
  scope_description: string;
  access_level: number;
}

// ============================================================================
// ADMIN ROLE CONVERTERS
// ============================================================================

export function rowToAdminCategory(row: CrmAdminCategoryRow): CrmAdminCategory {
  return {
    id: row.id,
    slug: row.slug as AdminCategorySlug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToAdminRole(row: CrmAdminRoleRow): CrmAdminRole {
  return {
    id: row.id,
    platformAccountId: row.platform_account_id,
    authProfileId: row.auth_profile_id,
    kybeDid: row.kybe_did,
    roleType: row.role_type as AdminRoleType,
    franchiseId: row.franchise_id,
    tenantId: row.tenant_id,
    categoryId: row.category_id,
    permissions: row.permissions,
    grantedByAdminRoleId: row.granted_by_admin_role_id,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToAdminRoleExpanded(row: CrmAdminRoleExpandedRow): CrmAdminRoleExpanded {
  return {
    ...rowToAdminRole(row),
    adminDisplayName: row.admin_display_name,
    platformAccountType: row.platform_account_type as PlatformAccountType | null,
    categorySlug: row.category_slug as AdminCategorySlug | null,
    categoryName: row.category_name,
    franchiseSlug: row.franchise_slug,
    franchiseName: row.franchise_name,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    scopeDescription: row.scope_description,
    accessLevel: row.access_level,
  };
}

/**
 * Get human-readable description of an admin role
 */
export function getAdminRoleDescription(role: CrmAdminRole | CrmAdminRoleExpanded): string {
  switch (role.roleType) {
    case 'uber_admin':
      return 'Uber Admin - Estate-wide access across all platforms, franchises, and tenants';
    case 'category_uber_admin':
      return `Category Uber Admin - Estate-wide access for ${'categoryName' in role ? role.categoryName : 'category'} domain`;
    case 'platform_super_admin':
      return 'Platform Super Admin - Platform-wide access across all franchises and tenants';
    case 'franchise_super_admin':
      return `Franchise Super Admin - Access across all tenants in ${'franchiseName' in role ? role.franchiseName : 'franchise'}`;
    case 'tenant_super_admin':
      return `Tenant Super Admin - Access within ${'tenantName' in role ? role.tenantName : 'tenant'}`;
    case 'category_admin':
      return `Category Admin - ${'categoryName' in role ? role.categoryName : 'Category'} access at assigned scope`;
    default:
      return 'Unknown admin role';
  }
}

/**
 * Check if a role type can manage another role type
 */
export function canManageRole(managerRoleType: AdminRoleType, targetRoleType: AdminRoleType): boolean {
  const hierarchy: Record<AdminRoleType, number> = {
    uber_admin: 1,
    category_uber_admin: 2,
    platform_super_admin: 3,
    franchise_super_admin: 4,
    tenant_super_admin: 5,
    category_admin: 6,
  };
  
  return hierarchy[managerRoleType] < hierarchy[targetRoleType];
}
