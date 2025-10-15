export type IQubeType = 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AigentQube';
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
