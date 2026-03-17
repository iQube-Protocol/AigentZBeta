import { browserbaseProviderAdapter } from './providers/browserbase.js';
export class BrowserPolicyService {
    choosePolicy(input) {
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
