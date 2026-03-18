import { env } from '../../env.js';

export type BrowserbaseProviderStatus = {
  configured: boolean;
  apiBaseUrl: string;
  projectId?: string;
  keepAlive: boolean;
  region?: string;
  timeoutSeconds?: number;
  reason?: string;
};

export type BrowserbaseCreateSessionInput = {
  contextId?: string | null;
  keepAlive?: boolean;
  proxies?: boolean;
  region?: string | null;
  timeoutSeconds?: number;
  userMetadata?: Record<string, unknown>;
};

export type BrowserbaseProviderSession = {
  providerSessionId: string;
  liveViewUrl?: string;
  connectUrl?: string;
  currentUrl?: string | null;
  currentTitle?: string | null;
  currentDomain?: string | null;
  status?: string;
  raw: Record<string, unknown>;
};

type BrowserbaseSessionResponse = {
  id: string;
  connectUrl?: string;
  createdAt?: string;
  endedAt?: string;
  keepAlive?: boolean;
  projectId?: string;
  region?: string;
  seleniumRemoteUrl?: string;
  signingKey?: string;
  startedAt?: string;
  status?: string;
  updatedAt?: string;
};

type BrowserbaseDebugResponse = {
  debuggerFullscreenUrl?: string;
  debuggerUrl?: string;
  wsUrl?: string;
  pages?: Array<{
    url?: string;
    title?: string;
    debuggerFullscreenUrl?: string;
    debuggerUrl?: string;
  }>;
};

function buildDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function resolveLiveViewUrl(debug: BrowserbaseDebugResponse | null): string | undefined {
  if (!debug) return undefined;
  return (
    debug.debuggerFullscreenUrl ||
    debug.pages?.find((page) => typeof page.debuggerFullscreenUrl === 'string')?.debuggerFullscreenUrl ||
    debug.debuggerUrl ||
    debug.pages?.find((page) => typeof page.debuggerUrl === 'string')?.debuggerUrl ||
    undefined
  );
}

function pickCurrentPage(debug: BrowserbaseDebugResponse | null): { url?: string; title?: string } | null {
  if (!debug?.pages?.length) return null;
  const pageWithUrl = debug.pages.find((page) => typeof page.url === 'string' && page.url.length > 0);
  if (pageWithUrl) return pageWithUrl;
  return debug.pages[0] || null;
}

function compactJsonValue(value: unknown): unknown {
  if (value === null || typeof value === 'undefined') return undefined;
  if (Array.isArray(value)) {
    const next = value
      .map((entry) => compactJsonValue(entry))
      .filter((entry) => typeof entry !== 'undefined');
    return next;
  }
  if (typeof value === 'object') {
    const next = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, compactJsonValue(entry)] as const)
        .filter(([, entry]) => typeof entry !== 'undefined')
    );
    return next;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return value;
}

export class BrowserbaseProviderAdapter {
  getStatus(): BrowserbaseProviderStatus {
    if (!env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID) {
      return {
        configured: false,
        apiBaseUrl: env.BROWSERBASE_API_BASE_URL,
        keepAlive: env.BROWSERBASE_KEEP_ALIVE,
        projectId: env.BROWSERBASE_PROJECT_ID,
        region: env.BROWSERBASE_REGION,
        timeoutSeconds: env.BROWSERBASE_SESSION_TIMEOUT_SECONDS,
        reason: 'BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID are not configured',
      };
    }

    return {
      configured: true,
      apiBaseUrl: env.BROWSERBASE_API_BASE_URL,
      keepAlive: env.BROWSERBASE_KEEP_ALIVE,
      projectId: env.BROWSERBASE_PROJECT_ID,
      region: env.BROWSERBASE_REGION,
      timeoutSeconds: env.BROWSERBASE_SESSION_TIMEOUT_SECONDS,
    };
  }

  isConfigured(): boolean {
    return this.getStatus().configured;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(this.getStatus().reason || 'Browserbase is not configured');
    }
  }

  private buildUrl(pathname: string): string {
    const base = env.BROWSERBASE_API_BASE_URL.replace(/\/+$/, '');
    return `${base}${pathname}`;
  }

  private async request<T>(pathname: string, init?: RequestInit): Promise<T> {
    this.assertConfigured();

    const response = await fetch(this.buildUrl(pathname), {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-bb-api-key': env.BROWSERBASE_API_KEY as string,
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Browserbase request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ''}`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  private normalizeSession(
    session: BrowserbaseSessionResponse,
    debug: BrowserbaseDebugResponse | null
  ): BrowserbaseProviderSession {
    const currentPage = pickCurrentPage(debug);
    const currentUrl = currentPage?.url || null;
    const currentTitle = currentPage?.title || null;

    return {
      providerSessionId: session.id,
      connectUrl: session.connectUrl,
      liveViewUrl: resolveLiveViewUrl(debug),
      currentUrl,
      currentTitle,
      currentDomain: buildDomain(currentUrl),
      status: session.status,
      raw: {
        session,
        debug,
      },
    };
  }

  async createSession(input: BrowserbaseCreateSessionInput = {}): Promise<BrowserbaseProviderSession> {
    const body = compactJsonValue({
      projectId: env.BROWSERBASE_PROJECT_ID,
      contextId: input.contextId || env.BROWSERBASE_CONTEXT_ID || undefined,
      keepAlive: input.keepAlive ?? env.BROWSERBASE_KEEP_ALIVE,
      proxies: input.proxies ?? env.BROWSERBASE_PROXIES,
      region: input.region || env.BROWSERBASE_REGION || undefined,
      browserSettings:
        input.timeoutSeconds ?? env.BROWSERBASE_SESSION_TIMEOUT_SECONDS
          ? {
              timeout: input.timeoutSeconds ?? env.BROWSERBASE_SESSION_TIMEOUT_SECONDS,
            }
          : undefined,
      userMetadata: input.userMetadata || undefined,
    });

    const session = await this.request<BrowserbaseSessionResponse>('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });

    let debug: BrowserbaseDebugResponse | null = null;
    try {
      debug = await this.getDebugSession(session.id);
    } catch (error) {
      console.warn('[browserbase] getDebugSession after create failed', error);
    }

    return this.normalizeSession(session, debug);
  }

  async getSession(providerSessionId: string): Promise<BrowserbaseSessionResponse> {
    return this.request<BrowserbaseSessionResponse>(`/v1/sessions/${providerSessionId}`, {
      method: 'GET',
    });
  }

  async getDebugSession(providerSessionId: string): Promise<BrowserbaseDebugResponse> {
    return this.request<BrowserbaseDebugResponse>(`/v1/sessions/${providerSessionId}/debug`, {
      method: 'GET',
    });
  }

  async refreshSession(providerSessionId: string): Promise<BrowserbaseProviderSession> {
    const [session, debug] = await Promise.all([
      this.getSession(providerSessionId),
      this.getDebugSession(providerSessionId).catch(() => null),
    ]);
    return this.normalizeSession(session, debug);
  }

  async releaseSession(providerSessionId: string): Promise<void> {
    await this.request(`/v1/sessions/${providerSessionId}`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'REQUEST_RELEASE',
      }),
    });
  }
}

export const browserbaseProviderAdapter = new BrowserbaseProviderAdapter();
