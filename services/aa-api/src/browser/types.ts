export type BrowserAuthScope = {
  did?: string;
  tenantId?: string;
  personaId?: string;
  userId?: string;
};

export type BrowserProvider = 'browserbase' | 'mock';
export type BrowserMountMode = 'overlay' | 'docked' | 'panel';
export type BrowserExecutionMode = 'playwright' | 'stagehand' | 'browser_use';
export type BrowserTrustMode = 'managed' | 'private-managed' | 'self-hosted';
export type BrowserPrivacyMode = 'standard' | 'sensitive' | 'sealed';
export type BrowserSessionStatus = 'active' | 'suspended' | 'closed' | 'error';
export type BrowserShellSurfaceState = 'expanded' | 'minimized' | 'hidden' | 'docked';

export type SurfaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserSessionRecord = {
  sessionId: string;
  provider: BrowserProvider;
  providerSessionId: string;
  executionMode: BrowserExecutionMode;
  trustMode: BrowserTrustMode;
  privacyMode: BrowserPrivacyMode;
  status: BrowserSessionStatus;
  currentUrl: string | null;
  currentTitle: string | null;
  currentDomain: string | null;
  createdAt: string;
  updatedAt: string;
  endedAt?: string | null;
  tenantId?: string;
  personaId?: string;
  userId?: string;
  activeAgentLabel: string;
};

export type BrowserSurfaceStateRecord = {
  sessionId: string;
  mounted: boolean;
  mountMode: BrowserMountMode;
  shellSurfaceState: BrowserShellSurfaceState;
  focused: boolean;
  takeoverActive: boolean;
  visible: boolean;
  bounds: SurfaceBounds;
  lastMountedAt?: string | null;
};

export type BrowserMountPayloadRecord = {
  sessionId: string;
  provider: BrowserProvider;
  mountMode: BrowserMountMode;
  liveView: {
    type: 'iframe';
    url: string;
  };
  chrome: {
    title: string;
    domain?: string;
    trustMode: BrowserTrustMode;
    privacyMode: BrowserPrivacyMode;
    executionMode: BrowserExecutionMode;
    activeAgentLabel: string;
  };
  capabilities: {
    canTakeover: boolean;
    canResize: boolean;
    canMinimize: boolean;
    canDock: boolean;
  };
};

export type BrowserBadgeStateRecord = {
  sessionId: string;
  trustMode: BrowserTrustMode;
  privacyMode: BrowserPrivacyMode;
  executionMode: BrowserExecutionMode;
  activeAgentLabel: string;
  domain?: string;
  provider?: BrowserProvider;
};

export type BrowserStepStateRecord = {
  sessionId: string;
  stepId: string;
  label: string;
  status: 'idle' | 'running' | 'waiting' | 'completed' | 'error';
  actor: 'user' | 'agent' | 'system';
  timestamp: string;
  message?: string;
};

export type BrowserHistoryEventRecord = {
  id: string;
  sessionId: string;
  actionType:
    | 'session_created'
    | 'session_mounted'
    | 'navigate'
    | 'back'
    | 'forward'
    | 'refresh'
    | 'extract'
    | 'act'
    | 'submit'
    | 'download'
    | 'takeover_start'
    | 'takeover_end'
    | 'resume'
    | 'save'
    | 'close'
    | 'error';
  actorType: 'user' | 'agent' | 'system';
  actorId?: string | null;
  url?: string | null;
  title?: string | null;
  domain?: string | null;
  intent?: string | null;
  stepLabel?: string | null;
  details: Record<string, unknown>;
  receiptRef?: string | null;
  occurredAt: string;
};

export type BrowserArtifactRecord = {
  id: string;
  sessionId: string;
  artifactType: 'extract' | 'screenshot' | 'download' | 'trace' | 'har' | 'pdf' | 'summary' | 'dom_snapshot';
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  metadata: Record<string, unknown>;
  receiptRef?: string | null;
  createdAt: string;
};

export type BrowserReceiptRecord = {
  id: string;
  sessionId: string;
  receiptType: string;
  receiptHash: string;
  receiptUri?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type BrowserSessionAggregate = {
  session: BrowserSessionRecord;
  surfaceState: BrowserSurfaceStateRecord;
  mountPayload: BrowserMountPayloadRecord;
  badges: BrowserBadgeStateRecord;
  history: BrowserHistoryEventRecord[];
  artifacts: BrowserArtifactRecord[];
  receipts: BrowserReceiptRecord[];
};
