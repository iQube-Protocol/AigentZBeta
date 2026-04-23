// ─────────────────────────────────────────────────────────────────────────────
// iQube Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type IQubeType =
  | 'DataQube'
  | 'ContentQube'
  | 'ToolQube'
  | 'ModelQube'
  | 'AgentQube';

export type Visibility = 'private' | 'semi-private' | 'public';

export type BusinessModel =
  | 'Free'
  | 'Buy'
  | 'Subscribe'
  | 'Rent'
  | 'Stake'
  | 'License'
  | 'Donate';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Subcategories per iQube type — drives dynamic BlakQube fields
export type DataQubeCategory = 'Credentials' | 'Profile' | 'Financial' | 'Health' | 'Other';
export type ContentQubeCategory = 'Article' | 'Research' | 'Video' | 'Image' | 'Other';
export type ToolQubeCategory = 'REST API' | 'Function' | 'Script' | 'Plugin' | 'Other';
export type ModelQubeCategory = 'LLM' | 'Classifier' | 'Neural Network' | 'Predictor' | 'Other';
export type AgentQubeCategory = 'Trading Bot' | 'Chatbot' | 'Task Automation' | 'Orchestrator' | 'Other';

export type IQubeCategory =
  | DataQubeCategory
  | ContentQubeCategory
  | ToolQubeCategory
  | ModelQubeCategory
  | AgentQubeCategory;

// ─────────────────────────────────────────────────────────────────────────────
// MetaQube — public, discoverable metadata
// ─────────────────────────────────────────────────────────────────────────────
export interface MetaQube {
  id: string;
  title: string;
  description: string;
  iQubeType: IQubeType;
  category: IQubeCategory;
  visibility: Visibility;

  // Provenance
  version: string;
  parentIQubeId?: string;
  provenanceDepth: number;

  // Auto-calculated risk
  riskScore: number;       // 0–10 composite, auto-derived
  riskLevel: RiskLevel;    // 'low' | 'medium' | 'high' | 'critical'

  // Underlying risk dimensions (stored but not shown individually in UI)
  sensitivityScore: number;    // 0–10
  verifiabilityScore: number;  // 0–10
  accuracyScore: number;       // 0–10

  // Verification status (combines verifiability + accuracy)
  isVerified: boolean;

  // Privacy
  isEncrypted: boolean;  // true if has BlakQube

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BlakQube — encrypted private payload
// Dynamic fields depend on iQube type + category
// ─────────────────────────────────────────────────────────────────────────────
export interface BlakQubeField {
  key: string;
  label: string;
  value: string;
  isSecret: boolean;  // passwords, keys — masked in UI
}

export interface BlakQube {
  id: string;
  iQubeId: string;
  fields: BlakQubeField[];  // dynamic, user-defined
  encryptionVersion: string;
  accessCount: number;
  lastAccessedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TokenQube — access control and business model enforcement
// Kept simple for now
// ─────────────────────────────────────────────────────────────────────────────
export type AccessPolicy = 'only-me' | 'specific' | 'requirements';

export interface TokenQube {
  iQubeId: string;
  businessModel: BusinessModel;
  price?: number;

  accessPolicy: AccessPolicy;
  allowedAddresses?: string[];  // wallet addresses or DIDs (when 'specific')

  // Requirements (when 'requirements')
  requireHumanProof?: boolean;
  requireAgentDeclaration?: boolean;
  minReputationScore?: number;

  // Permissions
  canView: boolean;
  canUse: boolean;
  canEdit: boolean;
  canDecrypt: boolean;
  canFork: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full iQube — all three layers together
// ─────────────────────────────────────────────────────────────────────────────
export interface IQube {
  meta: MetaQube;
  blak?: BlakQube;    // optional — not all iQubes have private data
  token: TokenQube;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry / UI helpers
// ─────────────────────────────────────────────────────────────────────────────
export interface RegistryFilter {
  search: string;
  type: IQubeType | '';
  visibility: Visibility | '';
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk calculation
// ─────────────────────────────────────────────────────────────────────────────
export function calculateRiskScore(
  sensitivity: number,
  verifiability: number,
  accuracy: number
): number {
  const trustFactor = (verifiability + accuracy) / 2;
  const raw = sensitivity * 0.5 + (10 - trustFactor) * 0.5;
  return Math.min(10, Math.max(0, Math.round(raw)));
}

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 3) return 'low';
  if (score <= 6) return 'medium';
  if (score <= 8) return 'high';
  return 'critical';
}

// Default sensitivity by type+category
export function getDefaultSensitivity(type: IQubeType, category: IQubeCategory): number {
  if (type === 'DataQube') {
    if (category === 'Credentials') return 8;
    if (category === 'Health') return 9;
    if (category === 'Financial') return 7;
    if (category === 'Profile') return 4;
  }
  if (type === 'AgentQube') return 6;
  if (type === 'ModelQube') return 4;
  if (type === 'ContentQube') return 2;
  if (type === 'ToolQube') return 3;
  return 5;
}

// Default BlakQube fields by type+category
export function getDefaultFields(type: IQubeType, category: IQubeCategory): BlakQubeField[] {
  if (type === 'DataQube' && category === 'Credentials') {
    return [
      { key: 'username', label: 'Username', value: '', isSecret: false },
      { key: 'password', label: 'Password', value: '', isSecret: true },
      { key: 'recovery_email', label: 'Recovery Email', value: '', isSecret: false },
      { key: 'totp_secret', label: '2FA Secret', value: '', isSecret: true },
    ];
  }
  if (type === 'DataQube' && category === 'Profile') {
    return [
      { key: 'full_name', label: 'Full Name', value: '', isSecret: false },
      { key: 'email', label: 'Email', value: '', isSecret: false },
      { key: 'phone', label: 'Phone', value: '', isSecret: true },
      { key: 'location', label: 'Location', value: '', isSecret: false },
    ];
  }
  if (type === 'DataQube' && category === 'Financial') {
    return [
      { key: 'account_name', label: 'Account Name', value: '', isSecret: false },
      { key: 'account_number', label: 'Account Number', value: '', isSecret: true },
      { key: 'routing_number', label: 'Routing Number', value: '', isSecret: true },
      { key: 'balance', label: 'Balance', value: '', isSecret: true },
    ];
  }
  if (type === 'ContentQube') {
    return [
      { key: 'file_url', label: 'File URL / IPFS Hash', value: '', isSecret: false },
      { key: 'content_body', label: 'Content', value: '', isSecret: false },
    ];
  }
  if (type === 'ToolQube') {
    return [
      { key: 'endpoint', label: 'API Endpoint', value: '', isSecret: false },
      { key: 'api_key', label: 'API Key', value: '', isSecret: true },
      { key: 'docs_url', label: 'Documentation URL', value: '', isSecret: false },
    ];
  }
  if (type === 'ModelQube') {
    return [
      { key: 'model_url', label: 'Model Weights URL', value: '', isSecret: false },
      { key: 'framework', label: 'Framework', value: '', isSecret: false },
      { key: 'access_token', label: 'Access Token', value: '', isSecret: true },
    ];
  }
  if (type === 'AgentQube') {
    return [
      { key: 'agent_endpoint', label: 'Agent Endpoint', value: '', isSecret: false },
      { key: 'agent_key', label: 'Agent API Key', value: '', isSecret: true },
      { key: 'capabilities', label: 'Capabilities', value: '', isSecret: false },
    ];
  }
  return [];
}
