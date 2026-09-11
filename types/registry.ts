export type IQubeType = 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube' | 'ClusterQube';
export type InstanceType = 'template' | 'instance';
export type BusinessModel = 'Buy' | 'Sell' | 'Rent' | 'Lease' | 'Subscribe' | 'Stake' | 'License' | 'Donate';

export interface IQubeTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  iQubeType?: IQubeType;
  iQubeInstanceType?: InstanceType;
  businessModel?: BusinessModel;
  price?: number;
  version?: string;
  provenance?: number;
  parentTemplateId?: string;
  blakqubeLabels?: any;
  metaExtras?: Array<{ k: string; v: string }>; // Additional MetaQube Records
  sensitivityScore?: number;
  accuracyScore: number;
  verifiabilityScore: number;
  riskScore: number;
  // DiDQube identity & reputation policy hints (optional, non-breaking)
  identity_state?: 'anonymous' | 'semi_anonymous' | 'semi_identifiable' | 'identifiable';
  min_reputation_bucket?: number;
  require_human_proof?: boolean;
  require_agent_declare?: boolean;
}

export interface RegistryFilter {
  search?: string;
  type?: IQubeType | '';
  instance?: InstanceType | '';
  businessModel?: BusinessModel | '';
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// Canonical iQube registry plane (Stage 1) — see types/registry-canonical.ts
// Re-exported here so consumers can `from '@/types/registry'` without
// remembering the file split. The internal record and projections live in
// the dedicated file to keep this module focused on the legacy IQubeTemplate
// surface that the existing registry UI / template store consume.
export type {
  CanonicalIQubeInternalRecord,
  RegistryAdminView,
  RegistryCartridgeView,
  RegistryPublicView,
  IQubeInternalLifecycleState,
  ToolSubtype,
  WrapperStrategy,
  IQubeInstanceModel,
  MintSagaState,
  MintStatus,
  CanonicalToolBlock,
  CanonicalAigentBlock,
  AigentQubeGovernance,
  CanonicalClusterBlock,
  ChainAnchor,
  EditionSupply,
  ShardSpec,
  ContentHierarchy,
  IQubeIdMapSource,
  IQubeIdMapEntry,
} from './registry-canonical';
