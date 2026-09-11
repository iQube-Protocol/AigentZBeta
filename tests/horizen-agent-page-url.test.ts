/**
 * services/horizen/agentPageUrl.ts — Horizen's confirmed-live human-readable
 * agent registry page URL pattern (2026-07-31):
 *   https://agent-registry.horizenlabs.io/agent/{agentIdentifier}?network={network}
 */

import { describe, it, expect } from 'vitest';
import { buildHorizenAgentPageUrl, isHorizenAgentPageUrl } from '@/services/horizen/agentPageUrl';

describe('buildHorizenAgentPageUrl', () => {
  it('matches Horizen\'s own confirmed example exactly', () => {
    expect(buildHorizenAgentPageUrl('0xZkSignalAgent', 'sepolia')).toBe(
      'https://agent-registry.horizenlabs.io/agent/0xZkSignalAgent?network=sepolia',
    );
  });

  it('MoneyPenny and Nakamoto produce different URLs from their own distinct bindings', () => {
    const moneypennyUrl = buildHorizenAgentPageUrl('0xMoneyPennyAgent', 'base-sepolia');
    const nakamotoUrl = buildHorizenAgentPageUrl('0xNakamotoAgent', 'base-sepolia');
    expect(moneypennyUrl).not.toBe(nakamotoUrl);
    expect(moneypennyUrl).toContain('0xMoneyPennyAgent');
    expect(nakamotoUrl).toContain('0xNakamotoAgent');
  });

  it('URL-encodes the identifier and network, never allowing origin/path escape', () => {
    const url = buildHorizenAgentPageUrl('../evil?x=1', 'sepolia#frag');
    expect(isHorizenAgentPageUrl(url)).toBe(true);
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://agent-registry.horizenlabs.io');
    expect(parsed.pathname.startsWith('/agent/')).toBe(true);
  });
});

describe('isHorizenAgentPageUrl — the allowlist gate', () => {
  it('accepts a well-formed Horizen agent page URL', () => {
    expect(isHorizenAgentPageUrl('https://agent-registry.horizenlabs.io/agent/0xZkSignalAgent?network=sepolia')).toBe(true);
  });

  it('rejects arbitrary client-supplied URLs — wrong origin', () => {
    expect(isHorizenAgentPageUrl('https://evil.example.com/agent/0xZkSignalAgent?network=sepolia')).toBe(false);
  });

  it('rejects a look-alike subdomain host', () => {
    expect(isHorizenAgentPageUrl('https://agent-registry.horizenlabs.io.evil.com/agent/x?network=sepolia')).toBe(false);
  });

  it('rejects http (non-https)', () => {
    expect(isHorizenAgentPageUrl('http://agent-registry.horizenlabs.io/agent/0xZkSignalAgent?network=sepolia')).toBe(false);
  });

  it('rejects a path outside /agent/', () => {
    expect(isHorizenAgentPageUrl('https://agent-registry.horizenlabs.io/admin/0xZkSignalAgent?network=sepolia')).toBe(false);
  });

  it('rejects a missing network parameter', () => {
    expect(isHorizenAgentPageUrl('https://agent-registry.horizenlabs.io/agent/0xZkSignalAgent')).toBe(false);
  });

  it('rejects a missing identifier segment', () => {
    expect(isHorizenAgentPageUrl('https://agent-registry.horizenlabs.io/agent/?network=sepolia')).toBe(false);
  });

  it('rejects garbage input without throwing', () => {
    expect(isHorizenAgentPageUrl('not a url at all')).toBe(false);
  });
});
