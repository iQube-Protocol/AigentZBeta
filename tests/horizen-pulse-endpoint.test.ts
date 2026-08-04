/**
 * services/horizen/pulseEndpoint.ts — resolving Pulse's monitored endpoint
 * from an Agent Card's own declared services[], never inventing one
 * (al / Horizen brief, 2026-08-04: "Do not substitute the Agent Card URL for
 * a monitored service endpoint unless the card explicitly declares it as the
 * service endpoint. Refuse locally if no eligible public HTTPS endpoint
 * exists.").
 */
import { describe, it, expect } from 'vitest';
import { resolvePulseEndpoint } from '@/services/horizen/pulseEndpoint';

describe('resolvePulseEndpoint', () => {
  it('returns null when the card declares no services at all — the current state of every real Agent Card in this repo', () => {
    expect(resolvePulseEndpoint({ name: 'Aigent Nakamoto', url: 'https://example.test/agent-card.json' })).toBeNull();
  });

  it('never substitutes the Agent Card\'s own url field for a monitored service', () => {
    const card = { name: 'Aigent Nakamoto', url: 'https://example.test/api/agents/nakamoto/agent-card.json' };
    expect(resolvePulseEndpoint(card)).toBeNull();
  });

  it('resolves from top-level services[]', () => {
    const card = { services: [{ type: 'primary', url: 'https://example.test/api' }] };
    expect(resolvePulseEndpoint(card)).toBe('https://example.test/api');
  });

  it('resolves from metadata.services[] (this codebase\'s platform-extension convention)', () => {
    const card = { metadata: { services: [{ type: 'primary', url: 'https://example.test/api' }] } };
    expect(resolvePulseEndpoint(card)).toBe('https://example.test/api');
  });

  it('prefers an explicitly pulse/health-tagged service over the first declared one', () => {
    const card = {
      services: [
        { type: 'primary', url: 'https://example.test/api' },
        { type: 'pulse-health', url: 'https://example.test/health' },
      ],
    };
    expect(resolvePulseEndpoint(card)).toBe('https://example.test/health');
  });

  it('rejects a non-HTTPS service url', () => {
    const card = { services: [{ type: 'primary', url: 'http://example.test/api' }] };
    expect(resolvePulseEndpoint(card)).toBeNull();
  });

  it('rejects a malformed url rather than throwing', () => {
    const card = { services: [{ type: 'primary', url: 'not-a-url' }] };
    expect(resolvePulseEndpoint(card)).toBeNull();
  });

  it('handles a null/non-object card without throwing', () => {
    expect(resolvePulseEndpoint(null)).toBeNull();
    expect(resolvePulseEndpoint(undefined)).toBeNull();
    expect(resolvePulseEndpoint('not an object')).toBeNull();
  });
});
