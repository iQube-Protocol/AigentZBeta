import type {
  QubeTalkAttestationAuthority,
  QubeTalkAuthority,
  QubeTalkClient,
  QubeTalkClientConfig,
  QubeTalkControl,
  QubeTalkHistoryResponse,
  QubeTalkMessage,
  QubeTalkMessageDraft,
  QubeTalkStatus,
  QubeTalkThread,
} from "./types";
import { AUTHORITY_POST_PERMISSIONS, QUBETALK_THREADS } from "./policy";

const THREADS: QubeTalkThread[] = QUBETALK_THREADS;

const MAX_THREAD_HISTORY = 200;
const HISTORY_TIMEOUT_MS = 1500;

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) return randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asThread(value: unknown): QubeTalkThread | null {
  if (typeof value !== "string") return null;
  return THREADS.includes(value as QubeTalkThread) ? (value as QubeTalkThread) : null;
}

function defaultControl(status: QubeTalkStatus = "open"): QubeTalkControl {
  return {
    id: createId(),
    supersedes_id: null,
    depends_on: [],
    assignee: null,
    status,
  };
}

function selectDraftStatus(type: QubeTalkMessage["type"]): QubeTalkStatus {
  if (type === "status" || type === "patch" || type === "log") {
    return "done";
  }
  return "open";
}

function sliceRecent<T>(items: T[], limit: number): T[] {
  return items.slice(Math.max(0, items.length - limit));
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function mapAuthorityToAttestation(authority: QubeTalkAuthority): QubeTalkAttestationAuthority {
  if (authority === "windsurf" || authority === "codex") {
    return "chatgpt";
  }
  return authority;
}

function normalizeMessageShape(value: unknown): QubeTalkMessage | null {
  if (!isObject(value)) return null;

  const thread = asThread(value.thread);
  const type = typeof value.type === "string" ? value.type : null;
  const severity = typeof value.severity === "string" ? value.severity : null;
  const title = typeof value.title === "string" ? value.title : null;
  const body = typeof value.body === "string" ? value.body : null;

  if (!thread || !type || !severity || !title || !body) {
    return null;
  }

  const acceptance = normalizeArray(value.acceptance);
  const refsRaw = isObject(value.refs) ? value.refs : {};
  const controlRaw = isObject(value.control) ? value.control : {};
  const attestRaw = isObject(value.attestations) ? value.attestations : {};

  return {
    type: type as QubeTalkMessage["type"],
    thread,
    severity: severity as QubeTalkMessage["severity"],
    title,
    body,
    acceptance,
    refs: {
      repo: typeof refsRaw.repo === "string" ? refsRaw.repo : "AigentZBeta",
      paths: normalizeArray(refsRaw.paths),
      endpoints: normalizeArray(refsRaw.endpoints),
      env: normalizeArray(refsRaw.env),
    },
    control: {
      id: typeof controlRaw.id === "string" ? controlRaw.id : createId(),
      supersedes_id: typeof controlRaw.supersedes_id === "string" || controlRaw.supersedes_id === null ? controlRaw.supersedes_id : null,
      depends_on: normalizeArray(controlRaw.depends_on),
      assignee: typeof controlRaw.assignee === "string" || controlRaw.assignee === null ? controlRaw.assignee : null,
      status:
        controlRaw.status === "open" ||
        controlRaw.status === "in_progress" ||
        controlRaw.status === "blocked" ||
        controlRaw.status === "done"
          ? controlRaw.status
          : "open",
    },
    attestations: {
      authority:
        attestRaw.authority === "aigent_z" || attestRaw.authority === "chatgpt" || attestRaw.authority === "lovable"
          ? attestRaw.authority
          : "chatgpt",
      signature: typeof attestRaw.signature === "string" ? attestRaw.signature : "",
    },
  };
}

function parseInboundMessages(payload: unknown): QubeTalkMessage[] {
  if (!isObject(payload)) {
    const direct = normalizeMessageShape(payload);
    return direct ? [direct] : [];
  }

  const op = typeof payload.op === "string" ? payload.op : null;

  if (op === "message") {
    const nested = normalizeMessageShape(payload.message);
    return nested ? [nested] : [];
  }

  if (op === "history") {
    return [];
  }

  const direct = normalizeMessageShape(payload);
  return direct ? [direct] : [];
}

function parseHistoryResponse(payload: unknown): QubeTalkHistoryResponse | null {
  if (!isObject(payload) || payload.op !== "history") return null;

  const thread = asThread(payload.thread);
  if (!thread || !Array.isArray(payload.messages)) return null;

  const messages = payload.messages
    .map((entry) => normalizeMessageShape(entry))
    .filter((entry): entry is QubeTalkMessage => entry !== null);

  return {
    thread,
    requestId: typeof payload.request_id === "string" ? payload.request_id : undefined,
    messages,
  };
}

async function sha256Hex(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return btoa(unescape(encodeURIComponent(input))).slice(0, 48);
}

export class QubeTalkClientImpl implements QubeTalkClient {
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private outboundQueue: string[] = [];
  private readonly listeners = new Map<QubeTalkThread, Set<(message: QubeTalkMessage) => void>>();
  private readonly threadHistory = new Map<QubeTalkThread, QubeTalkMessage[]>();
  private readonly pendingHistoryRequests = new Map<
    string,
    {
      resolve: (messages: QubeTalkMessage[]) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      limit: number;
    }
  >();

  private readonly config: Required<
    Pick<QubeTalkClientConfig, "wsUrl" | "authority" | "channel" | "reconnectIntervalMs" | "maxReconnectAttempts">
  > &
    Pick<QubeTalkClientConfig, "authToken" | "onConnectionChange" | "onError">;

  constructor(config: QubeTalkClientConfig) {
    this.config = {
      wsUrl: config.wsUrl,
      authority: config.authority,
      authToken: config.authToken,
      channel: config.channel ?? "metame-runtime-thinclient",
      reconnectIntervalMs: config.reconnectIntervalMs ?? 2000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 8,
      onConnectionChange: config.onConnectionChange,
      onError: config.onError,
    };

    for (const thread of THREADS) {
      this.listeners.set(thread, new Set());
      this.threadHistory.set(thread, []);
    }
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (!this.config.wsUrl) {
      throw new Error("QubeTalk requires wsUrl");
    }

    if (typeof WebSocket === "undefined") {
      throw new Error("QubeTalk requires browser WebSocket support");
    }

    this.shouldReconnect = true;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);
      } catch (error) {
        this.connectPromise = null;
        reject(error instanceof Error ? error : new Error("Unable to initialize QubeTalk WebSocket"));
        return;
      }

      const ws = this.ws;

      ws.addEventListener("open", () => {
        this.reconnectAttempts = 0;
        this.emitConnection(true);
        this.sendRaw({
          op: "auth",
          channel: this.config.channel,
          token: this.config.authToken ?? "",
          authority: this.config.authority,
        });

        for (const thread of THREADS) {
          this.sendRaw({
            op: "subscribe",
            channel: this.config.channel,
            thread,
          });
        }

        this.flushQueue();
        this.connectPromise = null;
        resolve();
      });

      ws.addEventListener("message", (event) => {
        this.handleSocketMessage(event.data);
      });

      ws.addEventListener("error", () => {
        this.config.onError?.(new Error("QubeTalk WebSocket error"));
      });

      ws.addEventListener("close", () => {
        this.emitConnection(false);
        if (this.connectPromise) {
          this.connectPromise = null;
          reject(new Error("QubeTalk WebSocket closed before connection finalized"));
        }

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });
    });

    return this.connectPromise;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    for (const pending of this.pendingHistoryRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("QubeTalk disconnected"));
    }
    this.pendingHistoryRequests.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectPromise = null;
    this.emitConnection(false);
  }

  subscribe(thread: QubeTalkThread, callback: (message: QubeTalkMessage) => void): () => void {
    const listeners = this.listeners.get(thread);
    if (!listeners) {
      throw new Error(`Unknown QubeTalk thread: ${thread}`);
    }

    listeners.add(callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw({
        op: "subscribe",
        channel: this.config.channel,
        thread,
      });
    }

    return () => {
      listeners.delete(callback);
    };
  }

  async publish(message: QubeTalkMessage): Promise<void> {
    this.assertPublishAllowed(message.thread);
    const attested = await this.ensureAttestedMessage(message);

    this.appendToHistory(attested);
    this.dispatch(attested);

    this.sendRaw({
      op: "publish",
      channel: this.config.channel,
      message: attested,
    });
  }

  async publishDraft(message: QubeTalkMessageDraft): Promise<QubeTalkMessage> {
    const normalized = await this.normalizeDraft(message);
    await this.publish(normalized);
    return normalized;
  }

  async getHistory(thread: QubeTalkThread, limit = 20): Promise<QubeTalkMessage[]> {
    const cached = sliceRecent(this.threadHistory.get(thread) ?? [], limit);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return cached;
    }

    const requestId = createId();

    const historyPromise = new Promise<QubeTalkMessage[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingHistoryRequests.delete(requestId);
        resolve(cached);
      }, HISTORY_TIMEOUT_MS);

      this.pendingHistoryRequests.set(requestId, {
        resolve,
        reject,
        timer,
        limit,
      });
    });

    this.sendRaw({
      op: "history",
      channel: this.config.channel,
      thread,
      limit,
      request_id: requestId,
    });

    return historyPromise;
  }

  private emitConnection(connected: boolean): void {
    this.config.onConnectionChange?.(connected);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.config.onError?.(new Error("QubeTalk reconnect attempts exhausted"));
      return;
    }

    this.reconnectAttempts += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.config.onError?.(error instanceof Error ? error : new Error("QubeTalk reconnect failed"));
      });
    }, this.config.reconnectIntervalMs * this.reconnectAttempts);
  }

  private sendRaw(payload: Record<string, unknown>): void {
    const raw = JSON.stringify(payload);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.outboundQueue.push(raw);
      return;
    }

    this.ws.send(raw);
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    while (this.outboundQueue.length > 0) {
      const raw = this.outboundQueue.shift();
      if (!raw) continue;
      this.ws.send(raw);
    }
  }

  private handleSocketMessage(raw: unknown): void {
    if (typeof raw !== "string") return;

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    const history = parseHistoryResponse(payload);
    if (history) {
      this.threadHistory.set(history.thread, sliceRecent(history.messages, MAX_THREAD_HISTORY));
      if (history.requestId) {
        const pending = this.pendingHistoryRequests.get(history.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingHistoryRequests.delete(history.requestId);
          pending.resolve(sliceRecent(history.messages, pending.limit));
        }
      }
    }

    const inboundMessages = parseInboundMessages(payload);
    for (const message of inboundMessages) {
      this.appendToHistory(message);
      this.dispatch(message);
    }
  }

  private appendToHistory(message: QubeTalkMessage): void {
    const current = this.threadHistory.get(message.thread) ?? [];
    const next = sliceRecent([...current, message], MAX_THREAD_HISTORY);
    this.threadHistory.set(message.thread, next);
  }

  private dispatch(message: QubeTalkMessage): void {
    const listeners = this.listeners.get(message.thread);
    if (!listeners) return;

    for (const callback of listeners) {
      callback(message);
    }
  }

  private assertPublishAllowed(thread: QubeTalkThread): void {
    const allowed = AUTHORITY_POST_PERMISSIONS[this.config.authority] ?? [];
    if (!allowed.includes(thread)) {
      throw new Error(`Authority ${this.config.authority} cannot publish to thread ${thread}`);
    }
  }

  private async ensureAttestedMessage(message: QubeTalkMessage): Promise<QubeTalkMessage> {
    const attestedAuthority = mapAuthorityToAttestation(this.config.authority);
    const signature =
      message.attestations.signature && message.attestations.signature.length > 0
        ? message.attestations.signature
        : await this.signMessage(message, attestedAuthority);

    return {
      ...message,
      attestations: {
        authority: message.attestations.authority ?? attestedAuthority,
        signature,
      },
    };
  }

  private async normalizeDraft(message: QubeTalkMessageDraft): Promise<QubeTalkMessage> {
    const normalized: QubeTalkMessage = {
      type: message.type,
      thread: message.thread,
      severity: message.severity,
      title: message.title,
      body: message.body,
      acceptance: message.acceptance ?? [],
      refs: {
        repo: message.refs?.repo ?? "AigentZBeta",
        paths: message.refs?.paths ?? [],
        endpoints: message.refs?.endpoints ?? [],
        env: message.refs?.env ?? [],
      },
      control: {
        id: message.control?.id ?? createId(),
        supersedes_id: message.control?.supersedes_id ?? null,
        depends_on: message.control?.depends_on ?? [],
        assignee: message.control?.assignee ?? null,
        status: message.control?.status ?? selectDraftStatus(message.type),
      },
      attestations: {
        authority: message.attestations?.authority ?? mapAuthorityToAttestation(this.config.authority),
        signature: message.attestations?.signature ?? "",
      },
    };

    if (!normalized.control.id) {
      normalized.control = defaultControl(selectDraftStatus(message.type));
    }

    return this.ensureAttestedMessage(normalized);
  }

  private async signMessage(message: QubeTalkMessage, authority: QubeTalkAttestationAuthority): Promise<string> {
    const toSign = {
      ...message,
      attestations: {
        authority,
        signature: "",
      },
    };

    const payload = JSON.stringify(toSign);
    const salt = this.config.authToken ?? this.config.authority;
    const digest = await sha256Hex(`${salt}:${payload}`);
    return `sha256:${digest.slice(0, 40)}`;
  }
}
