import { browserGatewayService } from './gatewayService.js';
export class BrowserMountService {
    async buildMountPayload(session, surfaceState) {
        return browserGatewayService.updateMountPayload(session, surfaceState);
    }
    buildBadges(session) {
        return {
            sessionId: session.sessionId,
            trustMode: session.trustMode,
            privacyMode: session.privacyMode,
            executionMode: session.executionMode,
            activeAgentLabel: session.activeAgentLabel,
            domain: session.currentDomain || undefined,
            provider: session.provider,
        };
    }
}
export const browserMountService = new BrowserMountService();
