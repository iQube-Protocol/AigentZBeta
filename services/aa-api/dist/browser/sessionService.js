import crypto from 'crypto';
import { emitBrowserEvent } from './events.js';
import { browserMountService } from './mountService.js';
import { browserPolicyService } from './policyService.js';
import { browserReceiptsService } from './receiptsService.js';
import { browserEstateService } from './estateService.js';
import { browserGatewayService } from './gatewayService.js';
const DEFAULT_BOUNDS = {
    x: 0,
    y: 88,
    width: 390,
    height: 640,
};
function nowIso() {
    return new Date().toISOString();
}
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
function buildTitle(url) {
    if (!url)
        return 'metaMe Browser';
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    }
    catch {
        return 'metaMe Browser';
    }
}
export class BrowserSessionService {
    sessions = new Map();
    async recordHistory(aggregate, event) {
        const historyEvent = {
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
        return historyEvent;
    }
    emitState(aggregate) {
        emitBrowserEvent(aggregate.session.sessionId, 'browser.surface.state', aggregate.surfaceState);
        emitBrowserEvent(aggregate.session.sessionId, 'browser.takeover.state', {
            sessionId: aggregate.session.sessionId,
            active: aggregate.surfaceState.takeoverActive,
        });
        emitBrowserEvent(aggregate.session.sessionId, 'browser.badges.update', aggregate.badges);
    }
    emitStep(sessionId, label, status, message) {
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
    async refreshDerivedFields(aggregate) {
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
        }
        catch (error) {
            console.warn('[browser-session] refreshDerivedFields sync failed', error);
        }
        aggregate.session.currentDomain = buildDomain(aggregate.session.currentUrl) || aggregate.session.currentDomain;
        aggregate.session.updatedAt = nowIso();
        aggregate.mountPayload = await browserGatewayService.updateMountPayload(aggregate.session, aggregate.surfaceState, aggregate.mountPayload);
        aggregate.badges = browserMountService.buildBadges(aggregate.session);
    }
    async persistAggregate(aggregate) {
        await browserEstateService.persistSession(aggregate.session);
        await browserEstateService.persistSurfaceState(aggregate.surfaceState);
    }
    async createSession(input) {
        const policy = browserPolicyService.choosePolicy({
            intent: input.intent || null,
            activeAgentLabel: 'metaMe Aigent',
        });
        const createdAt = nowIso();
        const sessionId = crypto.randomUUID();
        const session = {
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
        const surfaceState = {
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
        const aggregate = {
            session,
            surfaceState,
            mountPayload: await browserMountService.buildMountPayload(session, surfaceState),
            badges: browserMountService.buildBadges(session),
            history: [],
            artifacts: [],
            receipts: [],
            saves: [],
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
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    getRequiredSession(sessionId) {
        const aggregate = this.sessions.get(sessionId);
        if (!aggregate) {
            throw new Error(`Unknown browser session: ${sessionId}`);
        }
        return aggregate;
    }
    async mountSession(sessionId) {
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
    async unmountSession(sessionId) {
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
    async closeSession(sessionId) {
        const aggregate = this.getRequiredSession(sessionId);
        try {
            await browserGatewayService.closeProviderSession(aggregate.session);
        }
        catch (error) {
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
    async suspendSession(sessionId) {
        const aggregate = this.getRequiredSession(sessionId);
        aggregate.session.status = 'suspended';
        aggregate.surfaceState.focused = false;
        await this.refreshDerivedFields(aggregate);
        await this.persistAggregate(aggregate);
        this.emitStep(sessionId, 'Browser session suspended', 'completed');
        this.emitState(aggregate);
        return aggregate;
    }
    async resumeSession(sessionId) {
        const aggregate = this.getRequiredSession(sessionId);
        aggregate.session.status = 'active';
        aggregate.surfaceState.visible = true;
        aggregate.surfaceState.takeoverActive = false;
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
    async pauseAgentExecution(sessionId) {
        const aggregate = this.getRequiredSession(sessionId);
        this.emitStep(sessionId, 'Agent paused', 'waiting', 'Waiting for runtime resume');
        await this.persistAggregate(aggregate);
        this.emitState(aggregate);
        return aggregate;
    }
    async resumeAgentExecution(sessionId) {
        const aggregate = this.getRequiredSession(sessionId);
        this.emitStep(sessionId, 'Agent resumed', 'running', aggregate.session.currentUrl || undefined);
        await this.persistAggregate(aggregate);
        this.emitState(aggregate);
        return aggregate;
    }
    async startTakeover(sessionId) {
        const aggregate = this.getRequiredSession(sessionId);
        aggregate.surfaceState.takeoverActive = true;
        aggregate.surfaceState.visible = true;
        aggregate.surfaceState.focused = true;
        aggregate.surfaceState.shellSurfaceState = 'expanded';
        await this.refreshDerivedFields(aggregate);
        await this.recordHistory(aggregate, {
            sessionId,
            actionType: 'takeover_start',
            actorType: 'user',
            actorId: aggregate.session.userId || null,
            url: aggregate.session.currentUrl,
            title: aggregate.session.currentTitle,
            domain: aggregate.session.currentDomain,
            details: {},
        });
        await this.persistAggregate(aggregate);
        this.emitStep(sessionId, 'Human takeover active', 'waiting', 'User is driving the browser');
        this.emitState(aggregate);
        return aggregate;
    }
    async endTakeover(sessionId) {
        const aggregate = this.getRequiredSession(sessionId);
        aggregate.surfaceState.takeoverActive = false;
        aggregate.surfaceState.focused = false;
        await this.refreshDerivedFields(aggregate);
        await this.recordHistory(aggregate, {
            sessionId,
            actionType: 'takeover_end',
            actorType: 'system',
            actorId: null,
            url: aggregate.session.currentUrl,
            title: aggregate.session.currentTitle,
            domain: aggregate.session.currentDomain,
            details: {},
        });
        await this.persistAggregate(aggregate);
        this.emitStep(sessionId, 'Agent can resume', 'completed', aggregate.session.currentUrl || undefined);
        this.emitState(aggregate);
        return aggregate;
    }
    async setShellSurfaceState(sessionId, input) {
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
    async navigate(sessionId, url, action) {
        const aggregate = this.getRequiredSession(sessionId);
        this.emitStep(sessionId, action === 'navigate' ? 'Navigating browser' : `Running ${action}`, 'running', url);
        const navigation = await browserGatewayService.navigate(aggregate.session, url, action);
        if (action === 'navigate') {
            aggregate.session.currentUrl = navigation.currentUrl || url;
        }
        else if (!aggregate.session.currentUrl) {
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
    async saveSessionOutput(sessionId, input) {
        const aggregate = this.getRequiredSession(sessionId);
        const destinationType = input.destinationType === 'codex' || input.destinationType === 'cartridge' ? input.destinationType : 'estate';
        const historyEvent = await this.recordHistory(aggregate, {
            sessionId,
            actionType: 'save',
            actorType: 'user',
            actorId: input.savedBy || aggregate.session.userId || null,
            url: aggregate.session.currentUrl,
            title: aggregate.session.currentTitle,
            domain: aggregate.session.currentDomain,
            details: {
                destinationType,
                destinationId: input.destinationId || null,
                artifactId: input.artifactId || null,
                metadata: input.metadata || {},
            },
        });
        const save = {
            id: crypto.randomUUID(),
            sessionId,
            artifactId: input.artifactId || null,
            historyEventId: historyEvent.id,
            destinationType,
            destinationId: input.destinationId || null,
            savedBy: input.savedBy || aggregate.session.userId || null,
            metadata: input.metadata || {},
            receiptRef: historyEvent.receiptRef || null,
            createdAt: nowIso(),
        };
        aggregate.saves.unshift(save);
        await browserEstateService.appendSave(save);
        await this.persistAggregate(aggregate);
        this.emitStep(sessionId, 'Browser output saved', 'completed', destinationType);
        this.emitState(aggregate);
        return {
            saved: true,
            sessionId,
            save,
        };
    }
    async runAgentTask(sessionId, input) {
        const aggregate = this.getRequiredSession(sessionId);
        const instruction = input.instruction || 'Review the current page';
        this.emitStep(sessionId, 'Agent task running', 'running', instruction);
        await this.recordHistory(aggregate, {
            sessionId,
            actionType: 'act',
            actorType: 'agent',
            actorId: aggregate.session.activeAgentLabel,
            url: aggregate.session.currentUrl,
            title: aggregate.session.currentTitle,
            domain: aggregate.session.currentDomain,
            details: {
                instruction,
                payload: input.payload || {},
            },
        });
        const summary = `Reviewed ${aggregate.session.currentDomain || 'the current page'} for "${instruction}".`;
        this.emitStep(sessionId, 'Agent task complete', 'completed', summary);
        await this.persistAggregate(aggregate);
        this.emitState(aggregate);
        return {
            sessionId,
            ran: true,
            result: {
                instruction,
                summary,
            },
        };
    }
    async extractFromSession(sessionId, input) {
        const aggregate = this.getRequiredSession(sessionId);
        const prompt = input.prompt || 'Extract structured page details';
        this.emitStep(sessionId, 'Extracting page data', 'running', prompt);
        const historyEvent = await this.recordHistory(aggregate, {
            sessionId,
            actionType: 'extract',
            actorType: 'agent',
            actorId: aggregate.session.activeAgentLabel,
            url: aggregate.session.currentUrl,
            title: aggregate.session.currentTitle,
            domain: aggregate.session.currentDomain,
            details: {
                prompt,
                schema: input.schema || null,
            },
        });
        const artifact = {
            id: crypto.randomUUID(),
            sessionId,
            userId: aggregate.session.userId || aggregate.session.personaId || aggregate.session.tenantId || sessionId,
            artifactType: 'extract',
            sourceUrl: aggregate.session.currentUrl,
            sourceTitle: aggregate.session.currentTitle,
            mimeType: 'application/json',
            metadata: {
                prompt,
                schema: input.schema || null,
                result: {
                    url: aggregate.session.currentUrl,
                    title: aggregate.session.currentTitle,
                    domain: aggregate.session.currentDomain,
                    extractedAt: nowIso(),
                },
            },
            receiptRef: historyEvent.receiptRef || null,
            createdAt: nowIso(),
        };
        aggregate.artifacts.unshift(artifact);
        await browserEstateService.appendArtifact(artifact);
        await this.persistAggregate(aggregate);
        this.emitStep(sessionId, 'Extraction complete', 'completed', aggregate.session.currentUrl || undefined);
        this.emitState(aggregate);
        return {
            sessionId,
            artifact,
        };
    }
}
export const browserSessionService = new BrowserSessionService();
