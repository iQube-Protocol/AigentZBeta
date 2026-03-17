import type {
  BrowserBadgeStateRecord,
  BrowserMountPayloadRecord,
  BrowserSessionRecord,
  BrowserSurfaceStateRecord,
} from './types.js';
import { browserGatewayService } from './gatewayService.js';

export class BrowserMountService {
  async buildMountPayload(
    session: BrowserSessionRecord,
    surfaceState: BrowserSurfaceStateRecord
  ): Promise<BrowserMountPayloadRecord> {
    return browserGatewayService.updateMountPayload(session, surfaceState);
  }

  buildBadges(session: BrowserSessionRecord): BrowserBadgeStateRecord {
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
