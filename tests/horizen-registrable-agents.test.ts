/**
 * services/horizen/registrableAgents.ts — the config table that replaced the
 * 7 hardcoded 'aigentqube-moneypenny'/'aigent-moneypenny' constants scattered
 * across the Register/Verify/Claim/state routes (agent-selectable Register
 * stage, 2026-07-31). Pure data + pure lookup functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  REGISTRABLE_AGENTS,
  DEFAULT_REGISTRABLE_AGENT_SLUG,
  resolveRegistrableAgent,
  listRegistrableAgents,
} from '@/services/horizen/registrableAgents';

describe('registrableAgents', () => {
  it('resolves moneypenny and nakamoto by slug', () => {
    expect(resolveRegistrableAgent('moneypenny')).toMatchObject({
      slug: 'moneypenny',
      displayName: 'Aigent MoneyPenny',
      runtimeAgentId: 'aigent-moneypenny',
      aigentQubeId: 'aigentqube-moneypenny',
      agentCardPath: '/api/agents/moneypenny/agent-card.json',
      fioHandle: 'moneypenny@aigent',
      ownerPrivateKeyEnvVar: 'MONEYPENNY_OWNER_WALLET_PRIVATE_KEY',
    });
    expect(resolveRegistrableAgent('nakamoto')).toMatchObject({
      slug: 'nakamoto',
      displayName: 'Aigent Nakamoto',
      runtimeAgentId: 'aigent-nakamoto',
      aigentQubeId: 'aigentqube-nakamoto',
      agentCardPath: '/api/agents/nakamoto/agent-card.json',
      fioHandle: 'nakamoto@aigent',
      ownerPrivateKeyEnvVar: 'NAKAMOTO_OWNER_WALLET_PRIVATE_KEY',
    });
  });

  it('returns null for an unknown slug rather than a guessed default', () => {
    expect(resolveRegistrableAgent('unknown-agent')).toBeNull();
    expect(resolveRegistrableAgent(null)).toBeNull();
    expect(resolveRegistrableAgent(undefined)).toBeNull();
  });

  it('defaults to moneypenny — the demo agent — never nakamoto, the dry-run agent', () => {
    expect(DEFAULT_REGISTRABLE_AGENT_SLUG).toBe('moneypenny');
  });

  it('every config entry has a distinct aigentQubeId, runtimeAgentId, and agentCardPath — no two agents can collide on the same registry row', () => {
    const agents = listRegistrableAgents();
    expect(agents.length).toBeGreaterThanOrEqual(2);
    expect(new Set(agents.map((a) => a.aigentQubeId)).size).toBe(agents.length);
    expect(new Set(agents.map((a) => a.runtimeAgentId)).size).toBe(agents.length);
    expect(new Set(agents.map((a) => a.agentCardPath)).size).toBe(agents.length);
    expect(new Set(agents.map((a) => a.fioHandle)).size).toBe(agents.length);
    expect(new Set(agents.map((a) => a.ownerPrivateKeyEnvVar)).size).toBe(agents.length);
  });

  it('every entry in REGISTRABLE_AGENTS is keyed by its own slug', () => {
    for (const [key, config] of Object.entries(REGISTRABLE_AGENTS)) {
      expect(config.slug).toBe(key);
    }
  });
});
