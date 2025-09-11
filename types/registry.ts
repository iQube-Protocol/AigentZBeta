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
  sensitivityScore?: number;
  accuracyScore: number;
  verifiabilityScore: number;
  riskScore: number;
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
