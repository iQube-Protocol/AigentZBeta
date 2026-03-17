import type { BrowserExecutionMode, BrowserPrivacyMode, BrowserProvider, BrowserTrustMode } from './types.js';
import { browserbaseProviderAdapter } from './providers/browserbase.js';

export type BrowserPolicyDecision = {
  provider: BrowserProvider;
  executionMode: BrowserExecutionMode;
  trustMode: BrowserTrustMode;
  privacyMode: BrowserPrivacyMode;
  activeAgentLabel: string;
};

export class BrowserPolicyService {
  choosePolicy(input: { intent?: string | null; activeAgentLabel?: string | null }): BrowserPolicyDecision {
    return {
      provider: browserbaseProviderAdapter.isConfigured() ? 'browserbase' : 'mock',
      executionMode: 'playwright',
      trustMode: 'managed',
      privacyMode: input.intent?.toLowerCase().includes('bank') ? 'sensitive' : 'standard',
      activeAgentLabel: input.activeAgentLabel || 'metaMe Aigent',
    };
  }
}

export const browserPolicyService = new BrowserPolicyService();
