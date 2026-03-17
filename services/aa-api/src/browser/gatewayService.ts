import crypto from 'crypto';
import { browserbaseProviderAdapter } from './providers/browserbase.js';
import { browserPlaywrightExec } from './exec/playwright.js';
import type {
  BrowserAuthScope,
  BrowserMountPayloadRecord,
  BrowserSessionRecord,
  BrowserSurfaceStateRecord,
} from './types.js';

function encodeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function buildMockDataUrlHtml(session: BrowserSessionRecord): string {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${encodeHtml(session.currentTitle || 'metaMe Browser Session')}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: "Space Grotesk", "Avenir Next", sans-serif;
        background: radial-gradient(circle at top right, #dbeafe 0%, #eff6ff 30%, #f8fafc 100%);
        color: #0f172a;
      }
      main { min-height: 100vh; padding: 24px; display: grid; gap: 16px; align-content: start; }
      .card { background: rgba(255,255,255,0.84); border: 1px solid rgba(148,163,184,0.45); border-radius: 18px; padding: 16px; box-shadow: 0 20px 40px rgba(15,23,42,0.08); }
      .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
      h1 { margin: 0; font-size: 20px; }
      p { margin: 0; line-height: 1.5; }
      .pill { display: inline-flex; gap: 8px; width: fit-content; padding: 8px 12px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; }
      code { font-size: 12px; background: #e2e8f0; padding: 3px 6px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <main>
      <div class="pill">Mock Browser Surface</div>
      <section class="card">
        <div class="eyebrow">Current URL</div>
        <h1>${encodeHtml(session.currentUrl || 'about:blank')}</h1>
        <p>This placeholder live view is owned by the runtime, mounted by the shell, and ready to be replaced with Browserbase Live View.</p>
      </section>
      <section class="card">
        <div class="eyebrow">Provider Session</div>
        <p><code>${encodeHtml(session.providerSessionId)}</code></p>
      </section>
    </main>
  </body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

type BrowserGatewayCreateInput = {
  session: BrowserSessionRecord;
  auth: BrowserAuthScope;
  intent?: string | null;
};

type BrowserGatewaySessionRefresh = {
  currentUrl?: string | null;
  currentTitle?: string | null;
  currentDomain?: string | null;
  status?: BrowserSessionRecord['status'];
};

type BrowserGatewayNavigationResult = BrowserGatewaySessionRefresh & {
  executed: boolean;
  reason?: string;
};

export class BrowserGatewayService {
  private readonly liveViewUrls = new Map<string, string>();

  private readonly connectUrls = new Map<string, string>();

  private rememberProviderState(
    session: BrowserSessionRecord,
    input: { liveViewUrl?: string; connectUrl?: string }
  ): void {
    if (input.liveViewUrl) {
      this.liveViewUrls.set(session.sessionId, input.liveViewUrl);
    }
    if (input.connectUrl) {
      this.connectUrls.set(session.sessionId, input.connectUrl);
    }
  }

  private resolveStatus(status?: string): BrowserSessionRecord['status'] | undefined {
    if (!status) return undefined;
    const normalized = status.toUpperCase();
    if (['COMPLETED', 'RELEASED', 'REQUEST_RELEASE', 'TIMED_OUT'].includes(normalized)) {
      return 'closed';
    }
    if (['ERROR', 'FAILED'].includes(normalized)) {
      return 'error';
    }
    if (['PAUSED', 'SUSPENDED'].includes(normalized)) {
      return 'suspended';
    }
    return 'active';
  }

  async createProviderSession(input: BrowserGatewayCreateInput): Promise<string> {
    if (input.session.provider === 'browserbase') {
      const browserbaseSession = await browserbaseProviderAdapter.createSession({
        userMetadata: {
          metameSessionId: input.session.sessionId,
          metameTenantId: input.auth.tenantId || null,
          metamePersonaId: input.auth.personaId || null,
          metameUserId: input.auth.userId || input.auth.did || null,
          intent: input.intent || null,
        },
      });
      this.rememberProviderState(input.session, {
        liveViewUrl: browserbaseSession.liveViewUrl,
        connectUrl: browserbaseSession.connectUrl,
      });
      return browserbaseSession.providerSessionId;
    }

    return `prov_${crypto.randomUUID()}`;
  }

  async syncSession(session: BrowserSessionRecord): Promise<BrowserGatewaySessionRefresh> {
    if (session.provider !== 'browserbase' || !browserbaseProviderAdapter.isConfigured()) {
      return {};
    }

    const providerSession = await browserbaseProviderAdapter.refreshSession(session.providerSessionId);
    this.rememberProviderState(session, {
      liveViewUrl: providerSession.liveViewUrl,
      connectUrl: providerSession.connectUrl,
    });

    return {
      currentUrl: providerSession.currentUrl ?? session.currentUrl,
      currentTitle: providerSession.currentTitle ?? session.currentTitle,
      currentDomain: providerSession.currentDomain ?? buildDomain(providerSession.currentUrl) ?? session.currentDomain,
      status: this.resolveStatus(providerSession.status) ?? session.status,
    };
  }

  async navigate(
    session: BrowserSessionRecord,
    url: string,
    action: 'navigate' | 'back' | 'forward' | 'refresh'
  ): Promise<BrowserGatewayNavigationResult> {
    if (session.provider !== 'browserbase') {
      return {
        executed: false,
        currentUrl: action === 'navigate' ? url : session.currentUrl,
        currentTitle: session.currentTitle,
        currentDomain: action === 'navigate' ? buildDomain(url) : session.currentDomain,
        reason: 'mock-provider',
      };
    }

    const connectUrl =
      this.connectUrls.get(session.sessionId) ||
      (await browserbaseProviderAdapter.refreshSession(session.providerSessionId)).connectUrl;

    if (!connectUrl) {
      return {
        executed: false,
        currentUrl: session.currentUrl,
        currentTitle: session.currentTitle,
        currentDomain: session.currentDomain,
        reason: 'missing-connect-url',
      };
    }

    this.connectUrls.set(session.sessionId, connectUrl);

    const result = await browserPlaywrightExec.navigate({
      action,
      connectUrl,
      url,
    });

    if (!result.executed) {
      return {
        executed: false,
        currentUrl: action === 'navigate' ? url : session.currentUrl,
        currentTitle: session.currentTitle,
        currentDomain: action === 'navigate' ? buildDomain(url) : session.currentDomain,
        reason: result.reason,
      };
    }

    return {
      executed: true,
      currentUrl: result.currentUrl ?? session.currentUrl,
      currentTitle: result.currentTitle ?? session.currentTitle,
      currentDomain: buildDomain(result.currentUrl ?? session.currentUrl) ?? session.currentDomain,
    };
  }

  async closeProviderSession(session: BrowserSessionRecord): Promise<void> {
    if (session.provider !== 'browserbase' || !browserbaseProviderAdapter.isConfigured()) {
      this.liveViewUrls.delete(session.sessionId);
      this.connectUrls.delete(session.sessionId);
      return;
    }

    await browserbaseProviderAdapter.releaseSession(session.providerSessionId);
    this.liveViewUrls.delete(session.sessionId);
    this.connectUrls.delete(session.sessionId);
  }

  async updateMountPayload(
    session: BrowserSessionRecord,
    surfaceState: BrowserSurfaceStateRecord,
    previous?: BrowserMountPayloadRecord
  ): Promise<BrowserMountPayloadRecord> {
    let liveViewUrl =
      this.liveViewUrls.get(session.sessionId) ||
      previous?.liveView.url ||
      buildMockDataUrlHtml(session);

    if (session.provider === 'browserbase' && browserbaseProviderAdapter.isConfigured()) {
      try {
        const providerSession = await browserbaseProviderAdapter.refreshSession(session.providerSessionId);
        this.rememberProviderState(session, {
          liveViewUrl: providerSession.liveViewUrl,
          connectUrl: providerSession.connectUrl,
        });
        liveViewUrl = providerSession.liveViewUrl || liveViewUrl;
      } catch (error) {
        console.warn('[browser-gateway] updateMountPayload refresh failed', error);
      }
    } else {
      liveViewUrl = buildMockDataUrlHtml(session);
    }

    return {
      sessionId: session.sessionId,
      provider: session.provider,
      mountMode: surfaceState.mountMode,
      liveView: {
        type: 'iframe',
        url: liveViewUrl,
      },
      chrome: {
        title: session.currentTitle || previous?.chrome.title || 'metaMe Browser',
        domain: session.currentDomain || undefined,
        trustMode: session.trustMode,
        privacyMode: session.privacyMode,
        executionMode: session.executionMode,
        activeAgentLabel: session.activeAgentLabel,
      },
      capabilities: {
        canTakeover: false,
        canResize: true,
        canMinimize: true,
        canDock: true,
      },
    };
  }
}

export const browserGatewayService = new BrowserGatewayService();
