import {
  browserArtifactsResponseSchema,
  browserCreateSessionResponseSchema,
  browserHistoryResponseSchema,
  browserNavigateRequestSchema,
  browserReceiptsResponseSchema,
  browserRuntimeEventSchema,
  browserSessionResponseSchema,
  browserSurfaceStateResponseSchema,
  type BrowserArtifactsResponse,
  type BrowserCreateSessionRequest,
  type BrowserCreateSessionResponse,
  type BrowserHistoryResponse,
  type BrowserNavigateRequest,
  type BrowserReceiptsResponse,
  type BrowserRuntimeEvent,
  type BrowserSessionResponse,
  type BrowserSurfaceStateResponse,
} from "@metame/browser-contracts";

export type TrustState = "ok" | "warn" | "fail";

export type SelectorOption = {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  color?: string;
  provider_id?: string;
};

export type SelectorGroup = {
  current: SelectorOption;
  options: SelectorOption[];
};

export type RuntimeTrustSignal = {
  key: string;
  label: string;
  state: TrustState;
};

export type RuntimeSession = {
  trust_level: "verified" | "unverified" | "warning";
  trust_signals: RuntimeTrustSignal[];
  scores?: {
    trust?: number;
    reliability?: number;
  };
};

export type RuntimeMenuItem = {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  color?: string;
  enabled: boolean;
  edge?: boolean;
  trigger?: {
    prompt?: string;
    intent?: string;
    surface_plan_instruction?: string;
    copilot_instruction?: string;
  };
  children?: RuntimeMenuItem[];
};

export type RuntimeMenuPolicy = {
  collapse_to_metame_button?: boolean;
  edge_items_when_needed?: boolean;
  close_group_desktop_tablet?: boolean;
  center_group_ids?: string[];
  triad_cluster_gap?: string;
  color_map?: Record<string, string>;
  quick_links?: Array<{
    id: string;
    label: string;
    icon?: string;
    prompt?: string;
  }>;
  floating_quick_links?: Array<{
    id: string;
    label: string;
    icon?: string;
    prompt?: string;
    skip_inference?: boolean;
  }>;
  prompt_box?: {
    placeholder?: string;
    send_icon?: string;
  };
  state_behavior?: {
    welcome?: Record<string, unknown>;
    post_welcome?: Record<string, unknown>;
  };
};

export type RuntimeMenu = {
  mode: "triad" | "collapsed" | "full";
  items: RuntimeMenuItem[];
  policy: RuntimeMenuPolicy;
};

export type RuntimeIframeBootstrap = {
  handoff_token: string;
  context: Record<string, unknown>;
};

export type RuntimeIframeConfig = {
  url: string;
  postMessageOrigin: string;
  bootstrap: RuntimeIframeBootstrap;
};

export type RuntimeShellConfig = {
  tenant_id: string;
  persona_id: string;
  session: RuntimeSession;
  selectors: {
    aigent: SelectorGroup;
    llm: SelectorGroup;
  };
  menu: RuntimeMenu;
  iframe: RuntimeIframeConfig;
};

export type RuntimeShellConfigUpdate = Partial<Omit<RuntimeShellConfig, "tenant_id" | "persona_id">> & {
  tenant_id?: string;
  persona_id?: string;
  shell_config?: RuntimeShellConfig;
};

export type SelectorMutationPayload = {
  aigent_id?: string;
  llm_id?: string;
};

export type MenuActionMutationPayload = {
  action_id: string;
  payload?: Record<string, unknown>;
};

export type PromptActionMutationPayload = {
  prompt?: string;
  text?: string;
  payload?: Record<string, unknown>;
};

export type AARequestLog = {
  timestamp: string;
  method: string;
  path: string;
  status: number | "error";
  ok: boolean;
  duration_ms: number;
  error?: string;
};

export type AAClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getAuthToken?: () => string | null | undefined | Promise<string | null | undefined>;
  onRequestLog?: (entry: AARequestLog) => void;
};

export type BrowserEventsSubscription = {
  close: () => void;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function assertObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isRuntimeShellConfig(value: unknown): value is RuntimeShellConfig {
  if (!assertObject(value)) return false;
  const candidate = value as RuntimeShellConfig;
  return (
    typeof candidate.tenant_id === "string" &&
    typeof candidate.persona_id === "string" &&
    assertObject(candidate.session) &&
    assertObject(candidate.selectors) &&
    assertObject(candidate.menu) &&
    assertObject(candidate.iframe)
  );
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class AAClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getAuthToken?: AAClientOptions["getAuthToken"];
  private readonly onRequestLog?: AAClientOptions["onRequestLog"];
  private readonly runtimePrefix: string;

  constructor(options: AAClientOptions = {}) {
    const baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_AA_API_BASE_URL;
    if (!baseUrl) {
      throw new Error("AA client requires NEXT_PUBLIC_AA_API_BASE_URL (or AAClientOptions.baseUrl)");
    }

    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.getAuthToken = options.getAuthToken;
    this.onRequestLog = options.onRequestLog;
    this.runtimePrefix = this.resolveRuntimePrefix(this.baseUrl);
  }

  async getShellConfig(): Promise<RuntimeShellConfig> {
    const payload = await this.request<RuntimeShellConfig>(this.runtimePath("runtime/shell-config"), {
      method: "GET",
    });

    if (!isRuntimeShellConfig(payload)) {
      throw new Error("AA API returned invalid shell-config payload");
    }

    return payload;
  }

  postSelectors(payload: SelectorMutationPayload): Promise<RuntimeShellConfigUpdate> {
    return this.request<RuntimeShellConfigUpdate>(this.runtimePath("runtime/selectors"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  postMenuAction(payload: MenuActionMutationPayload): Promise<RuntimeShellConfigUpdate> {
    return this.request<RuntimeShellConfigUpdate>(this.runtimePath("runtime/menu-action"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  postPromptAction(payload: PromptActionMutationPayload): Promise<RuntimeShellConfigUpdate> {
    return this.request<RuntimeShellConfigUpdate>(this.runtimePath("runtime/prompt-action"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createBrowserSession(payload: BrowserCreateSessionRequest = {}): Promise<BrowserCreateSessionResponse> {
    const response = await this.request<BrowserCreateSessionResponse>(this.runtimePath("browser/sessions"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return browserCreateSessionResponseSchema.parse(response);
  }

  async getBrowserSession(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}`), {
      method: "GET",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async closeBrowserSession(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/close`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async suspendBrowserSession(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/suspend`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async resumeBrowserSession(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/resume`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async mountBrowserSession(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/mount`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async unmountBrowserSession(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/unmount`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async getBrowserSurfaceState(sessionId: string): Promise<BrowserSurfaceStateResponse> {
    const response = await this.request<BrowserSurfaceStateResponse>(
      this.runtimePath(`browser/sessions/${sessionId}/surface-state`),
      {
        method: "GET",
      }
    );
    return browserSurfaceStateResponseSchema.parse(response);
  }

  async navigateBrowserSession(sessionId: string, payload: BrowserNavigateRequest): Promise<BrowserSessionResponse> {
    const nextPayload = browserNavigateRequestSchema.parse(payload);
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/navigate`), {
      method: "POST",
      body: JSON.stringify(nextPayload),
    });
    return browserSessionResponseSchema.parse(response);
  }

  async browserBack(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/back`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async browserForward(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/forward`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async browserRefresh(sessionId: string): Promise<BrowserSessionResponse> {
    const response = await this.request<BrowserSessionResponse>(this.runtimePath(`browser/sessions/${sessionId}/refresh`), {
      method: "POST",
    });
    return browserSessionResponseSchema.parse(response);
  }

  async getBrowserHistory(sessionId: string): Promise<BrowserHistoryResponse> {
    const response = await this.request<BrowserHistoryResponse>(this.runtimePath(`browser/sessions/${sessionId}/history`), {
      method: "GET",
    });
    return browserHistoryResponseSchema.parse(response);
  }

  async getBrowserArtifacts(sessionId: string): Promise<BrowserArtifactsResponse> {
    const response = await this.request<BrowserArtifactsResponse>(
      this.runtimePath(`browser/sessions/${sessionId}/artifacts`),
      {
        method: "GET",
      }
    );
    return browserArtifactsResponseSchema.parse(response);
  }

  async getBrowserReceipts(sessionId: string): Promise<BrowserReceiptsResponse> {
    const response = await this.request<BrowserReceiptsResponse>(this.runtimePath(`browser/sessions/${sessionId}/receipts`), {
      method: "GET",
    });
    return browserReceiptsResponseSchema.parse(response);
  }

  async browserSave(sessionId: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(this.runtimePath(`browser/sessions/${sessionId}/save`), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  subscribeToBrowserSessionEvents(
    sessionId: string,
    handlers: {
      onEvent: (event: BrowserRuntimeEvent) => void;
      onOpen?: () => void;
      onError?: (error: Error) => void;
    }
  ): BrowserEventsSubscription {
    const url = new URL(this.runtimePath(`browser/sessions/${sessionId}/events`), this.baseUrl);
    const eventNames = [
      "browser.mount",
      "browser.unmount",
      "browser.surface.state",
      "browser.step.update",
      "browser.takeover.state",
      "browser.badges.update",
      "browser.error",
    ] as const;

    const source = new EventSource(this.withAccessToken(url));
    source.onopen = () => handlers.onOpen?.();
    source.onerror = () => handlers.onError?.(new Error(`Browser SSE stream error for session ${sessionId}`));

    for (const eventName of eventNames) {
      source.addEventListener(eventName, (rawEvent) => {
        const parsed = this.parseBrowserRuntimeEvent(rawEvent, eventName);
        if (parsed) handlers.onEvent(parsed);
      });
    }

    return {
      close: () => source.close(),
    };
  }

  private resolveRuntimePrefix(baseUrl: string): string {
    try {
      const pathname = new URL(baseUrl).pathname.replace(/\/+$/, "");
      if (/\/aa\/v1$/i.test(pathname)) {
        return "";
      }
    } catch {
      // Ignore parse failures and fall back to explicit prefix mode.
    }
    return "aa/v1/";
  }

  private runtimePath(path: string): string {
    return `${this.runtimePrefix}${path.replace(/^\//, "")}`;
  }

  private withAccessToken(url: URL): string {
    const token = process.env.NEXT_PUBLIC_AA_API_TOKEN;
    if (token) {
      url.searchParams.set("access_token", token);
    }
    return url.toString();
  }

  private parseBrowserRuntimeEvent(event: Event, type: BrowserRuntimeEvent["type"]): BrowserRuntimeEvent | null {
    if (!("data" in event) || typeof event.data !== "string") {
      return null;
    }

    try {
      const parsed = JSON.parse(event.data);
      return browserRuntimeEventSchema.parse({ type, payload: parsed });
    } catch {
      return null;
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const started = Date.now();
    const url = new URL(path.replace(/^\//, ""), this.baseUrl).toString();
    const method = init.method ?? "GET";

    try {
      const headers = new Headers(init.headers ?? {});
      headers.set("Accept", "application/json");
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const token = await this.getAuthToken?.();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await this.fetchImpl(url, {
        ...init,
        headers,
      });

      const data = await parseJsonSafely<T>(response);
      const elapsed = Date.now() - started;

      this.onRequestLog?.({
        timestamp: new Date().toISOString(),
        method,
        path,
        status: response.status,
        ok: response.ok,
        duration_ms: elapsed,
        error: response.ok ? undefined : response.statusText,
      });

      if (!response.ok) {
        const errorText = assertObject(data) && typeof data.error === "string" ? data.error : response.statusText;
        throw new Error(`AA request failed (${response.status}): ${errorText}`);
      }

      if (data === null) {
        throw new Error(`AA request returned empty response for ${method} ${path}`);
      }

      return data;
    } catch (error) {
      const elapsed = Date.now() - started;
      this.onRequestLog?.({
        timestamp: new Date().toISOString(),
        method,
        path,
        status: "error",
        ok: false,
        duration_ms: elapsed,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

export function createAAClientFromEnv(options: Omit<AAClientOptions, "baseUrl"> = {}): AAClient {
  return new AAClient({
    ...options,
    baseUrl: process.env.NEXT_PUBLIC_AA_API_BASE_URL,
  });
}
