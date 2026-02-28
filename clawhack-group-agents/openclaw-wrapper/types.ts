import type {
  ConversationQube,
  DataClassification,
  DVNReceipt,
  InboundEvent,
  OutboundEvent,
} from "../schemas/bridgeEvents";

export interface RegistryProvider {
  provider_id: string;
  name: string;
  connection?: {
    type?: string;
    endpoint?: string;
    auth?: {
      mode?: string;
      env_var?: string;
      scopes?: string[];
    };
  };
  policy?: {
    risk_tier?: number;
    data_classification?: DataClassification;
    requires_approval?: boolean;
    allowed_environments?: string[];
    rate_limits?: {
      rpm?: number;
      burst?: number;
    };
  };
  tools?: Array<{
    tool_id: string;
    enabled?: boolean;
  }>;
}

export interface RegistryTool {
  tool_id: string;
  provider_id: string;
  name: string;
  description?: string;
  version?: string;
  invoke_endpoint?: string;
  policy?: {
    risk_tier?: number;
    requires_approval?: boolean;
    allowed_scopes?: Array<"thread_only" | "global">;
    data_classification_max?: DataClassification;
    constraints?: {
      max_calls_per_job?: number;
      max_calls_per_thread?: number;
      max_image_bytes?: number;
    };
  };
}

export interface RegistrySnapshot {
  providersById: Map<string, RegistryProvider>;
  toolsById: Map<string, RegistryTool>;
  allowedToolIds: Set<string>;
  shelfId: string;
  source: "remote" | "fallback";
}

export interface ToolInvocationContext {
  requestId: string;
  threadKey: string;
  scope: "thread_only";
  dataClassification: DataClassification;
}

export interface MCPInvocationArgs {
  tool: RegistryTool;
  provider?: RegistryProvider;
  args: Record<string, unknown>;
  requestId: string;
}

export interface MCPInvocationResult {
  data: unknown;
  stubbed: boolean;
  endpoint?: string;
}

export interface MintArtifactInput {
  tenantId: string;
  threadKey: string;
  requestId: string;
  type: "ContentQube" | "MediaQube";
  label: string;
  payload: unknown;
  toolchain: string[];
}

export interface MintedArtifactRef {
  iqube_id: string;
  type: "ContentQube" | "MediaQube";
  label: string;
  version: number;
  content_hash: string;
  created_ts: string;
  request_id: string;
  toolchain: string[];
  storage_path: string;
}

export interface ConversationUpsertResult {
  qube: ConversationQube;
  isNew: boolean;
  contentHash: string;
}

export interface ConversationOutcomeUpdate {
  conversationQubeId: string;
  summary: string;
  keyFacts: string[];
  artifacts: MintedArtifactRef[];
  requestId: string;
  toolchain: string[];
}

export interface OpenClawWorkerConfig {
  tenantId: string;
  workspace: string;
  registryEndpoint: string;
  shelfId: string;
  moltComicsEnabled?: boolean;
  allowlistEnabled?: boolean;
  mcpTimeoutMs?: number;
  allowStubToolResults?: boolean;
  allowRegistryFallback?: boolean;
  discordChannelId?: string;
  xmtpGroupId?: string;
  dataDir?: string;
  receiptEmitter?: (receipt: DVNReceipt) => Promise<void>;
}

export interface OpenClawRunResult {
  requestId: string;
  inboundEvent: InboundEvent;
  outboundEvents: OutboundEvent[];
  artifacts: MintedArtifactRef[];
  conversationQube: ConversationQube;
  receipts: DVNReceipt[];
  registrySource: "remote" | "fallback";
}
