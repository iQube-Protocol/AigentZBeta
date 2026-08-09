/**
 * services/horizen/pulseEndpoint.ts — resolving Pulse's monitored endpoint
 * from the agent's canonical Agent Runtime Endpoint descriptor
 * (registry_assets.metadata.runtime), never a services[] lookup and never
 * invented (operator ruling, 2026-08-04: "Replace the recently added
 * services[] lookup entirely... Do not retain services[] as a fallback.
 * That would recreate two sources of truth").
 */
import { describe, it, expect } from 'vitest';
import { resolvePulseEndpoint } from '@/services/horizen/pulseEndpoint';

describe('resolvePulseEndpoint', () => {
  it('returns null when the card projects no runtime descriptor at all — the current state of every real Agent Card in this repo', () => {
    expect(resolvePulseEndpoint({ name: 'Aigent Nakamoto', url: 'https://example.test/agent-card.json' })).toBeNull();
  });

  it('never substitutes the Agent Card\'s own url field for the runtime endpoint', () => {
    const card = { name: 'Aigent Nakamoto', url: 'https://example.test/api/agents/nakamoto/agent-card.json' };
    expect(resolvePulseEndpoint(card)).toBeNull();
  });

  it('resolves from metadata.runtime.endpoint when no health is declared', () => {
    const card = { metadata: { runtime: { endpoint: 'https://nakamoto.metame.ai' } } };
    expect(resolvePulseEndpoint(card)).toBe('https://nakamoto.metame.ai');
  });

  it('resolves a relative health path against endpoint', () => {
    const card = { metadata: { runtime: { endpoint: 'https://nakamoto.metame.ai', health: '/health' } } };
    expect(resolvePulseEndpoint(card)).toBe('https://nakamoto.metame.ai/health');
  });

  it('uses an absolute health URL as-is', () => {
    const card = { metadata: { runtime: { endpoint: 'https://nakamoto.metame.ai', health: 'https://status.metame.ai/nakamoto' } } };
    expect(resolvePulseEndpoint(card)).toBe('https://status.metame.ai/nakamoto');
  });

  it('has NO services[] fallback — a services array alone (no runtime) resolves to null', () => {
    const card = { services: [{ type: 'primary', url: 'https://example.test/api' }] };
    expect(resolvePulseEndpoint(card)).toBeNull();
  });

  it('no endpoint declared → null, even if health is present, since there is nothing to resolve a relative path against and endpoint is the required base fact', () => {
    const card = { metadata: { runtime: { health: '/health' } } };
    expect(resolvePulseEndpoint(card)).toBeNull();
  });

  it('handles a null/non-object card without throwing', () => {
    expect(resolvePulseEndpoint(null)).toBeNull();
    expect(resolvePulseEndpoint(undefined)).toBeNull();
    expect(resolvePulseEndpoint('not an object')).toBeNull();
  });
});
