import crypto from 'crypto';
import { emitBrowserEvent } from './events.js';
import { browserMountService } from './mountService.js';
import { browserPolicyService } from './policyService.js';
import { browserReceiptsService } from './receiptsService.js';
import { browserEstateService } from './estateService.js';
import { browserGatewayService } from './gatewayService.js';
import type {
  BrowserAuthScope,
  BrowserHistoryEventRecord,
  BrowserMountMode,
  BrowserSessionAggregate,
  BrowserSessionRecord,
  BrowserStepStateRecord,
  BrowserSurfaceStateRecord,
  SurfaceBounds,
} from './types.js';

const DEFAULT_BOUNDS: SurfaceBounds = {
  x: 0,
  y: 88,
  width: 390,
  height: 640,
};

function nowIso(): string {
  return new Date().toISOString();
}

function buildDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function buildTitle(url: string | null): string {
  if (!url) return 'metaMe Browser';
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return 'metaMe Browser';
  }
}

export class BrowserSessionService {
  private readonly sessions = new Map<string, BrowserSessionAggregate>();

  private async recordHistory(
    aggregate: BrowserSessionAggregate,
    event: Omit<BrowserHistoryEventRecord, 'id' | 'occurredAt'>
  ): Promise<void> {
    const historyEvent: BrowserHistoryEventRecord = {
      id: crypto.randomUUID(),
      occurredAt: nowIso(),
      ...event,
    };
    const receipt = browserReceiptsService.createReceipt(aggregate.session, `browser.${event.actionType}`, {
      actionType: event.actionType,
      url: event.url || null,
      domain: event.domain || null,
      details: event.details,
    });
    historyEvent.receiptRef = receipt.id;
    aggregate.history.unshift(historyEvent);
    aggregate.receipts.unshift(receipt);
    await browserEstateService.appendHistory(historyEvent);
    await browserEstateService.appendReceipt(receipt);
  }

  private emitState(aggregate: BrowserSessionAggregate): void {
    emitBrowserEvent(aggregate.session.sessionId, 'browser.surface.state', aggregate.surfaceState);
    emitBrowserEvent(aggregate.session.sessionId, 'browser.badges.update', aggregate.badges);
  }

  private emitStep(
    sessionId: string,
    label: string,
    status: BrowserStepStateRecord['status'],
    message?: string
  ): void {
    emitBrowserEvent(sessionId, 'browser.step.update', {
      sessionId,
      stepId: crypto.randomUUID(),
      label,
      status,
      actor: 'system',
      message,
      timestamp: nowIso(),
    });
  }

  private async refreshDerivedFields(aggregate: BrowserSessionAggregate): Promise<void> {
    try {
      const remoteState = await browserGatewayService.syncSession(aggregate.session);
      if (typeof remoteState.currentUrl !== 'undefined') {
        aggregate.session.currentUrl = remoteState.currentUrl;
      }
      if (typeof remoteState.currentTitle !== 'undefined') {
        aggregate.session.currentTitle = remoteState.currentTitle;
      }
      if (typeof remoteState.currentDomain !== 'undefined') {
        aggregate.session.currentDomain = remoteState.currentDomain;
      }
      if (typeof remoteState.status !== 'undefined') {
        aggregate.session.status = remoteState.status;
      }
    } catch (error) {
      console.warn('[browser-session] refreshDerivedFields sync failed', error);
    }

    aggregate.session.currentDomain = buildDomain(aggregate.session.currentUrl) || aggregate.session.currentDomain;
    aggregate.session.updatedAt = nowIso();
    aggregate.mountPayload = await browserGatewayService.updateMountPayload(
      aggregate.session,
      aggregate.surfaceState,
      aggregate.mountPayload
    );
    aggregate.badges = browserMountService.buildBadges(aggregate.session);
  }

  private async persistAggregate(aggregate: BrowserSessionAggregate): Promise<void> {
    await browserEstateService.persistSession(aggregate.session);
    await browserEstateService.persistSurfaceState(aggregate.surfaceState);
  }

  async createSession(input: {
    auth: BrowserAuthScope;
    intent?: string | null;
    mountMode?: BrowserMountMode;
    targetUrl?: string | null;
  }): Promise<BrowserSessionAggregate> {
    const policy = browserPolicyService.choosePolicy({
      intent: input.intent || null,
      activeAgentLabel: 'metaMe Aigent',
    });
    const createdAt = nowIso();
    const sessionId = crypto.randomUUID();
    const session: BrowserSessionRecord = {
      sessionId,
      provider: policy.provider,
      providerSessionId: '',
      executionMode: policy.executionMode,
      trustMode: policy.trustMode,
      privacyMode: policy.privacyMode,
      status: 'active',
      currentUrl: input.targetUrl || 'https://metame.browser.local/session',
      currentTitle: buildTitle(input.targetUrl || 'https://metame.browser.local/session'),
      currentDomain: buildDomain(input.targetUrl || 'https://metame.browser.local/session'),
      createdAt,
      updatedAt: createdAt,
      tenantId: input.auth.tenantId,
      personaId: input.auth.personaId,
      userId: input.auth.userId || input.auth.did,
      activeAgentLabel: policy.activeAgentLabel,
    };
    session.providerSessionId = await browserGatewayService.createProviderSession({
      session,
      auth: input.auth,
      intent: input.intent || null,
    });
    const surfaceState: BrowserSurfaceStateRecord = {
      sessionId: session.sessionId,
      mounted: false,
      mountMode: input.mountMode || 'overlay',
      shellSurfaceState: 'expanded',
      focused: false,
      takeoverActive: false,
      visible: false,
      bounds: DEFAULT_BOUNDS,
      lastMountedAt: null,
    };
    const aggregate: BrowserSessionAggregate = {
      session,
      surfaceState,
      mountPayload: await browserMountService.buildMountPayload(session, surfaceState),
      badges: browserMountService.buildBadges(session),
      history: [],
      artifacts: [],
      receipts: [],
    };
    if (input.targetUrl) {
      const navigation = await browserGatewayService.navigate(session, input.targetUrl, 'navigate');
      if (navigation.currentUrl) {
        session.currentUrl = navigation.currentUrl;
      }
      if (typeof navigation.currentTitle !== 'undefined') {
        session.currentTitle = navigation.currentTitle;
      }
      if (typeof navigation.currentDomain !== 'undefined') {
        session.currentDomain = navigation.currentDomain;
      }
    }
    await this.refreshDerivedFields(aggregate);
    this.sessions.set(session.sessionId, aggregate);
    await this.recordHistory(aggregate, {
      sessionId: session.sessionId,
      actionType: 'session_created',
      actorType: 'system',
      actorId: null,
      url: session.currentUrl,
      title: session.currentTitle,
      domain: session.currentDomain,
      details: { intent: input.intent || null },
    });
    await this.persistAggregate(aggregate);
    this.emitStep(session.sessionId, 'Browser session ready', 'completed');
    return aggregate;
  }

  getSession(sessionId: string): BrowserSessionAggregate | null {
    return this.sessions.get(sessionId) || null;
  }

  private getRequiredSession(sessionId: string): BrowserSessionAggregate {
    const aggregate = this.sessions.get(sessionId);
    if (!aggregate) {
      throw new Error(`Unknown browser session: ${sessionId}`);
    }
    return aggregate;
  }

  async mountSession(sessionId: string): Promise<BrowserSessionAggregate> {
    const aggregate = this.getRequiredSession(sessionId);
    aggregate.surfaceState.mounted = true;
    aggregate.surfaceState.visible = true;
    aggregate.surfaceState.focused = true;
    aggregate.surfaceState.lastMountedAt = nowIso();
    aggregate.surfaceState.shellSurfaceState = 'expanded';
    await this.refreshDerivedFields(aggregate);
    await this.recordHistory(aggregate, {
      sessionId,
      actionType: 'session_mounted',
      actorType: 'system',
      actorId: null,
      url: aggregate.session.currentUrl,
      title: aggregate.session.currentTitle,
      domain: aggregate.session.currentDomain,
      details: { mountMode: aggregate.surfaceState.mountMode },
    });
    await this.persistAggregate(aggregate);
    emitBrowserEvent(sessionId, 'browser.mount', aggregate.mountPayload);
    this.emitState(aggregate);
    return aggregate;
  }

  async unmountSession(sessionId: string): Promise<BrowserSessionAggregate> {
    const aggregate = this.getRequiredSession(sessionId);
    aggregate.surfaceState.mounted = false;
    aggregate.surfaceState.visible = false;
    aggregate.surfaceState.focused = false;
    await this.refreshDerivedFields(aggregate);
    await this.persistAggregate(aggregate);
    emitBrowserEvent(sessionId, 'browser.unmount', { sessionId });
    this.emitState(aggregate);
    return aggregate;
  }

  async closeSession(sessionId: string): Promise<BrowserSessionAggregate> {
    const aggregate = this.getRequiredSession(sessionId);
    try {
      await browserGatewayService.closeProviderSession(aggregate.session);
    } catch (error) {
      console.warn('[browser-session] closeProviderSession failed', error);
    }
    aggregate.session.status = 'closed';
    aggregate.session.endedAt = nowIso();
    aggregate.surfaceState.mounted = false;
    aggregate.surfaceState.visible = false;
    aggregate.surfaceState.focused = false;
    await this.refreshDerivedFields(aggregate);
    await this.recordHistory(aggregate, {
      sessionId,
      actionType: 'close',
      actorType: 'system',
      actorId: null,
      url: aggregate.session.currentUrl,
      title: aggregate.session.currentTitle,
      domain: aggregate.session.currentDomain,
      details: {},
    });
    await this.persistAggregate(aggregate);
    emitBrowserEvent(sessionId, 'browser.unmount', { sessionId });
    this.emitState(aggregate);
    return aggregate;
  }

  async suspendSession(sessionId: string): Promise<BrowserSessionAggregate> {
    const aggregate = this.getRequiredSession(sessionId);
    aggregate.session.status = 'suspended';
    aggregate.surfaceState.focused = false;
    await this.refreshDerivedFields(aggregate);
    await this.persistAggregate(aggregate);
    this.emitStep(sessionId, 'Browser session suspended', 'completed');
    this.emitState(aggregate);
    return aggregate;
  }

  async resumeSession(sessionId: string): Promise<BrowserSessionAggregate> {
    const aggregate = this.getRequiredSession(sessionId);
    aggregate.session.status = 'active';
    aggregate.surfaceState.visible = true;
    await this.refreshDerivedFields(aggregate);
    await this.recordHistory(aggregate, {
      sessionId,
      actionType: 'resume',
      actorType: 'system',
      actorId: null,
      url: aggregate.session.currentUrl,
      title: aggregate.session.currentTitle,
      domain: aggregate.session.currentDomain,
      details: {},
    });
    await this.persistAggregate(aggregate);
    this.emitState(aggregate);
    return aggregate;
  }

  async setShellSurfaceState(
    sessionId: string,
    input: Partial<Pick<BrowserSurfaceStateRecord, 'shellSurfaceState' | 'focused' | 'bounds' | 'visible'>>
  ): Promise<BrowserSessionAggregate> {
    const aggregate = this.getRequiredSession(sessionId);
    if (input.shellSurfaceState) {
      aggregate.surfaceState.shellSurfaceState = input.shellSurfaceState;
    }
    if (typeof input.focused === 'boolean') {
      aggregate.surfaceState.focused = input.focused;
    }
    if (input.bounds) {
      aggregate.surfaceState.bounds = input.bounds;
    }
    if (typeof input.visible === 'boolean') {
      aggregate.surfaceState.visible = input.visible;
    }
    await this.refreshDerivedFields(aggregate);
    await this.persistAggregate(aggregate);
    this.emitState(aggregate);
    return aggregate;
  }

  async navigate(sessionId: string, url: string, action: 'navigate' | 'back' | 'forward' | 'refresh'): Promise<BrowserSessionAggregate> {
    const aggregate = this.getRequiredSession(sessionId);
    this.emitStep(sessionId, action === 'navigate' ? 'Navigating browser' : `Running ${action}`, 'running', url);
    const navigation = await browserGatewayService.navigate(aggregate.session, url, action);
    if (action === 'navigate') {
      aggregate.session.currentUrl = navigation.currentUrl || url;
    } else if (!aggregate.session.currentUrl) {
      aggregate.session.currentUrl = navigation.currentUrl || 'https://metame.browser.local/session';
    }
    aggregate.session.currentTitle =
      navigation.currentTitle ||
      (action === 'refresh' ? 'metaMe Browser (refreshed)' : `metaMe Browser · ${action}`);
    aggregate.session.currentDomain =
      navigation.currentDomain || buildDomain(aggregate.session.currentUrl) || aggregate.session.currentDomain;
    await this.refreshDerivedFields(aggregate);
    await this.recordHistory(aggregate, {
      sessionId,
      actionType: action,
      actorType: 'system',
      actorId: null,
      url: aggregate.session.currentUrl,
      title: aggregate.session.currentTitle,
      domain: aggregate.session.currentDomain,
      details: {
        action,
        remoteExecuted: navigation.executed,
        remoteReason: navigation.reason || null,
      },
    });
    await this.persistAggregate(aggregate);
    this.emitStep(sessionId, 'Navigation complete', 'completed', aggregate.session.currentUrl || undefined);
    this.emitState(aggregate);
    return aggregate;
  }
}

export const browserSessionService = new BrowserSessionService();
