export type QubeTalkMessageType = "task" | "decision" | "question" | "status" | "patch" | "log";

export type QubeTalkThread = "spec" | "api-wiring" | "ui-shell" | "dev-exec" | "ops";

export type QubeTalkSeverity = "info" | "warn" | "blocker";

export type QubeTalkStatus = "open" | "in_progress" | "blocked" | "done";

export type QubeTalkAuthority = "aigent_z" | "chatgpt" | "lovable" | "windsurf" | "codex";

export type QubeTalkAttestationAuthority = "aigent_z" | "chatgpt" | "lovable";

export type QubeTalkRefs = {
  repo: string;
  paths: string[];
  endpoints: string[];
  env: string[];
};

export type QubeTalkControl = {
  id: string;
  supersedes_id: string | null;
  depends_on: string[];
  assignee: string | null;
  status: QubeTalkStatus;
};

export type QubeTalkAttestations = {
  authority: QubeTalkAttestationAuthority;
  signature: string;
};

export type QubeTalkMessage = {
  type: QubeTalkMessageType;
  thread: QubeTalkThread;
  severity: QubeTalkSeverity;
  title: string;
  body: string;
  acceptance: string[];
  refs: QubeTalkRefs;
  control: QubeTalkControl;
  attestations: QubeTalkAttestations;
};

export type QubeTalkMessageDraft = {
  type: QubeTalkMessageType;
  thread: QubeTalkThread;
  severity: QubeTalkSeverity;
  title: string;
  body: string;
  acceptance?: string[];
  refs?: Partial<QubeTalkRefs>;
  control?: Partial<QubeTalkControl>;
  attestations?: Partial<QubeTalkAttestations>;
};

export type QubeTalkHistoryResponse = {
  thread: QubeTalkThread;
  requestId?: string;
  messages: QubeTalkMessage[];
};

export type QubeTalkClientConfig = {
  wsUrl: string;
  authToken?: string;
  authority: QubeTalkAuthority;
  channel?: string;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
};

export interface QubeTalkClient {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(thread: QubeTalkThread, callback: (message: QubeTalkMessage) => void): () => void;
  publish(message: QubeTalkMessage): Promise<void>;
  publishDraft(message: QubeTalkMessageDraft): Promise<QubeTalkMessage>;
  getHistory(thread: QubeTalkThread, limit?: number): Promise<QubeTalkMessage[]>;
}
