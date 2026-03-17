import { env } from '../../env.js';
function buildDomain(url) {
    if (!url)
        return null;
    try {
        return new URL(url).hostname;
    }
    catch {
        return null;
    }
}
function resolveLiveViewUrl(debug) {
    if (!debug)
        return undefined;
    return (debug.debuggerFullscreenUrl ||
        debug.pages?.find((page) => typeof page.debuggerFullscreenUrl === 'string')?.debuggerFullscreenUrl ||
        debug.debuggerUrl ||
        debug.pages?.find((page) => typeof page.debuggerUrl === 'string')?.debuggerUrl ||
        undefined);
}
function pickCurrentPage(debug) {
    if (!debug?.pages?.length)
        return null;
    const pageWithUrl = debug.pages.find((page) => typeof page.url === 'string' && page.url.length > 0);
    if (pageWithUrl)
        return pageWithUrl;
    return debug.pages[0] || null;
}
function compactJsonValue(value) {
    if (value === null || typeof value === 'undefined')
        return undefined;
    if (Array.isArray(value)) {
        const next = value
            .map((entry) => compactJsonValue(entry))
            .filter((entry) => typeof entry !== 'undefined');
        return next;
    }
    if (typeof value === 'object') {
        const next = Object.fromEntries(Object.entries(value)
            .map(([key, entry]) => [key, compactJsonValue(entry)])
            .filter(([, entry]) => typeof entry !== 'undefined'));
        return next;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    return value;
}
export class BrowserbaseProviderAdapter {
    getStatus() {
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
    isConfigured() {
        return this.getStatus().configured;
    }
    assertConfigured() {
        if (!this.isConfigured()) {
            throw new Error(this.getStatus().reason || 'Browserbase is not configured');
        }
    }
    buildUrl(pathname) {
        const base = env.BROWSERBASE_API_BASE_URL.replace(/\/+$/, '');
        return `${base}${pathname}`;
    }
    async request(pathname, init) {
        this.assertConfigured();
        const response = await fetch(this.buildUrl(pathname), {
            ...init,
            headers: {
                'content-type': 'application/json',
                'x-bb-api-key': env.BROWSERBASE_API_KEY,
                ...(init?.headers || {}),
            },
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Browserbase request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ''}`);
        }
        if (response.status === 204) {
            return {};
        }
        return (await response.json());
    }
    normalizeSession(session, debug) {
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
    async createSession(input = {}) {
        const body = compactJsonValue({
            projectId: env.BROWSERBASE_PROJECT_ID,
            contextId: input.contextId || env.BROWSERBASE_CONTEXT_ID || undefined,
            keepAlive: input.keepAlive ?? env.BROWSERBASE_KEEP_ALIVE,
            proxies: input.proxies ?? env.BROWSERBASE_PROXIES,
            region: input.region || env.BROWSERBASE_REGION || undefined,
            timeout: input.timeoutSeconds ?? env.BROWSERBASE_SESSION_TIMEOUT_SECONDS,
            userMetadata: input.userMetadata || undefined,
        });
        const session = await this.request('/v1/sessions', {
            method: 'POST',
            body: JSON.stringify(body || {}),
        });
        let debug = null;
        try {
            debug = await this.getDebugSession(session.id);
        }
        catch (error) {
            console.warn('[browserbase] getDebugSession after create failed', error);
        }
        return this.normalizeSession(session, debug);
    }
    async getSession(providerSessionId) {
        return this.request(`/v1/sessions/${providerSessionId}`, {
            method: 'GET',
        });
    }
    async getDebugSession(providerSessionId) {
        return this.request(`/v1/sessions/${providerSessionId}/debug`, {
            method: 'GET',
        });
    }
    async refreshSession(providerSessionId) {
        const [session, debug] = await Promise.all([
            this.getSession(providerSessionId),
            this.getDebugSession(providerSessionId).catch(() => null),
        ]);
        return this.normalizeSession(session, debug);
    }
    async releaseSession(providerSessionId) {
        await this.request(`/v1/sessions/${providerSessionId}`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'REQUEST_RELEASE',
            }),
        });
    }
}
export const browserbaseProviderAdapter = new BrowserbaseProviderAdapter();
