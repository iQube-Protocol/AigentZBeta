/**
 * Nakamoto Franchise Types
 * 
 * Type definitions for Aigent Nakamoto and its tenant Aigent JMO.
 * Includes knowledge base, visual aids, and tenant management.
 */

export type TenantId = 'nakamoto' | 'aigent-jmo';
export type DocumentScope = 'root' | 'tenant';

// ============================================================================
// Core Nakamoto Types
// ============================================================================

export interface NakamotoDocument {
  id: string;
  title: string;
  content_text?: string;
  content_uri?: string;
  tags: string[];
  scope: DocumentScope;
  tenant_id?: TenantId;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NakamotoPrompt {
  id: string;
  name: string;
  content: string;
  scope: DocumentScope;
  tenant_id?: TenantId;
  version: number;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TenantInfo {
  id: string;
  tenant_id: TenantId;
  display_name: string;
  parent_project: string;
  status: 'active' | 'inactive';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Visual Aid Types
// ============================================================================

export type VisualizationType = 
  | 'mermaid'
  | 'chart'
  | 'code'
  | 'blockchain'
  | 'flowchart'
  | 'sequence'
  | 'architecture';

export interface MermaidDiagram {
  id: string;
  title: string;
  type: 'flowchart' | 'sequence' | 'class' | 'state' | 'er' | 'gantt' | 'pie' | 'journey';
  definition: string;
  theme?: 'default' | 'dark' | 'forest' | 'neutral' | 'base';
  metadata?: {
    description?: string;
    tags?: string[];
    complexity?: 'simple' | 'medium' | 'complex';
    interactive?: boolean;
  };
}

export interface CodeExample {
  id: string;
  title: string;
  language: string;
  code: string;
  description?: string;
  filename?: string;
  metadata?: {
    tags?: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    interactive?: boolean;
    runnable?: boolean;
  };
}

export interface ChartData {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'radar';
  data: any[];
  config?: {
    xAxis?: string;
    yAxis?: string;
    colors?: string[];
    responsive?: boolean;
    interactive?: boolean;
  };
  metadata?: {
    description?: string;
    tags?: string[];
    source?: string;
  };
}

export interface BlockchainVisualization {
  id: string;
  title: string;
  type: 'block' | 'transaction' | 'network' | 'smart-contract';
  data: {
    blocks?: BlockInfo[];
    transactions?: TransactionInfo[];
    nodes?: NodeInfo[];
    contracts?: ContractInfo[];
  };
  config?: {
    showDetails?: boolean;
    animate?: boolean;
    interactive?: boolean;
  };
  metadata?: {
    description?: string;
    network?: string;
    tags?: string[];
  };
}

export interface BlockInfo {
  hash: string;
  number: number;
  timestamp: number;
  transactions: number;
  size: number;
  gasUsed?: number;
  miner?: string;
}

export interface TransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: number;
  gasPrice: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: number;
}

export interface NodeInfo {
  id: string;
  address: string;
  type: 'full' | 'light' | 'miner' | 'validator';
  status: 'online' | 'offline';
  latency?: number;
  peers?: number;
}

export interface ContractInfo {
  address: string;
  name: string;
  abi?: any[];
  functions?: FunctionInfo[];
  events?: EventInfo[];
}

export interface FunctionInfo {
  name: string;
  inputs: any[];
  outputs: any[];
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
}

export interface EventInfo {
  name: string;
  inputs: any[];
}

// ============================================================================
// Content Types
// ============================================================================

export type ContentType = 
  | 'document'
  | 'mermaid-diagram'
  | 'code-example'
  | 'chart'
  | 'blockchain-viz'
  | 'tutorial'
  | 'reference';

export interface NakamotoContent {
  id: string;
  type: ContentType;
  title: string;
  description?: string;
  tags: string[];
  scope: DocumentScope;
  tenant_id?: TenantId;
  content: {
    document?: NakamotoDocument;
    diagram?: MermaidDiagram;
    code?: CodeExample;
    chart?: ChartData;
    blockchain?: BlockchainVisualization;
  };
  metadata?: {
    author?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime?: number;
    prerequisites?: string[];
    related?: string[];
    interactive?: boolean;
  };
  created_at: string;
  updated_at: string;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface NakamotoTabState {
  // Tenant context
  currentTenant: TenantId;
  availableTenants: TenantInfo[];
  
  // Content state
  documents: NakamotoDocument[];
  prompts: NakamotoPrompt[];
  content: NakamotoContent[];
  
  // UI state
  selectedContent?: NakamotoContent;
  activeVisualization?: VisualizationType;
  searchQuery: string;
  selectedTags: string[];
  
  // Loading states
  isLoading: boolean;
  connectionStatus: 'checking' | 'connected' | 'error';
  
  // Visual aid state
  mermaidDiagrams: MermaidDiagram[];
  codeExamples: CodeExample[];
  charts: ChartData[];
  blockchainVisualizations: BlockchainVisualization[];
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface NakamotoTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
}

export interface TenantSwitcherProps {
  currentTenant: TenantId;
  tenants: TenantInfo[];
  onTenantChange: (tenantId: TenantId) => void;
  disabled?: boolean;
}

export interface VisualizationRendererProps {
  content: NakamotoContent;
  theme?: 'light' | 'dark';
  interactive?: boolean;
  onInteraction?: (type: string, data: any) => void;
}

export interface ContentBrowserProps {
  content: NakamotoContent[];
  selectedContent?: NakamotoContent;
  onContentSelect: (content: NakamotoContent) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  loading?: boolean;
}

// ============================================================================
// Search and Filter Types
// ============================================================================

export interface SearchFilters {
  query?: string;
  tags?: string[];
  type?: ContentType;
  scope?: DocumentScope;
  tenant?: TenantId;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  interactive?: boolean;
}

export interface SearchResult {
  content: NakamotoContent;
  relevanceScore: number;
  matchHighlights: {
    title?: string;
    description?: string;
    content?: string;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface NakamotoApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
}

// ============================================================================
// Edge Function Types
// ============================================================================

export interface EdgeFunctionRequest {
  tenant_id?: TenantId;
  action: string;
  data?: any;
}

export interface EdgeFunctionResponse {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
}
