/**
 * Horizen Pilot — Know1 Recording Readiness Pass (2026-08-10). Source-scan
 * style, matching this repo's existing convention — see
 * tests/register-ceremony-replay.test.ts, tests/agent-n-genericity.test.ts
 * for the same pattern.
 *
 * Pins: Know1 is added to REGISTRABLE_AGENTS purely as configuration (no
 * route-specific branches anywhere else); every code-level identifier keeps
 * the zero (kn0w1/aigent-kn0w1/aigentqube-kn0w1/kn0w1@aigent) while
 * `displayName` alone drops it for TTS, per the operator's explicit
 * instruction; the new Agent Card never copies MoneyPenny/Nakamoto's
 * financial/trading language and states Know1's FS authority boundary
 * explicitly; Verifiable P&L is explicitly not_applicable, never a stuck
 * pending state; and the additive migration touches ONLY the new keys on
 * Know1's EXISTING AigentQube row (never a second INSERT).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { REGISTRABLE_AGENTS, resolveRegistrableAgent, listRegistrableAgents } from '@/services/horizen/registrableAgents';

function read(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('Know1 — registrableAgents.ts config entry', () => {
  it('every code-level identifier keeps the zero — never invented, never simplified', () => {
    const know1 = REGISTRABLE_AGENTS.kn0w1;
    expect(know1).toBeDefined();
    expect(know1.slug).toBe('kn0w1');
    expect(know1.runtimeAgentId).toBe('aigent-kn0w1');
    expect(know1.aigentQubeId).toBe('aigentqube-kn0w1');
    expect(know1.fioHandle).toBe('kn0w1@aigent');
    expect(know1.agentCardPath).toBe('/api/agents/kn0w1/agent-card.json');
    expect(know1.runtimeHealthPath).toBe('/api/agents/kn0w1/health');
  });

  it('displayName alone drops the zero, for TTS pronunciation — a deliberate divergence from the code identifiers', () => {
    expect(REGISTRABLE_AGENTS.kn0w1.displayName).toBe('Aigent Know1');
    expect(REGISTRABLE_AGENTS.kn0w1.displayName).not.toMatch(/kn0w1/i);
  });

  it('resolveRegistrableAgent resolves kn0w1 purely through the config table — same function MoneyPenny/Nakamoto resolve through', () => {
    expect(resolveRegistrableAgent('kn0w1')).toEqual(REGISTRABLE_AGENTS.kn0w1);
  });

  it('adding Know1 never displaced MoneyPenny as the default agent', () => {
    expect(listRegistrableAgents().map((a) => a.slug)).toEqual(
      expect.arrayContaining(['moneypenny', 'nakamoto', 'kn0w1']),
    );
  });
});

describe('Know1 — Agent Card never copies MoneyPenny/Nakamoto language, states the FS authority boundary', () => {
  const card = read('app/api/agents/kn0w1/agent-card.json/route.ts');

  it('never claims financial-execution, trading, or custodial authority — only denies it', () => {
    expect(card).not.toMatch(/know1 (executes|will execute|can execute) trades/i);
    expect(card).toMatch(/does not execute trades, custody funds, settle transactions/i);
  });

  it('states the authority boundary explicitly: Know1 = knowledge/context, MoneyPenny = execution', () => {
    expect(card).toMatch(/financial_authority_boundary/);
    expect(card).toMatch(/delegated to Aigent MoneyPenny/);
  });

  it('reports Verifiable P&L as explicitly not_applicable — never a stuck pending/failed state', () => {
    expect(card).toMatch(/verifiable_pnl:\s*'not_applicable'/);
  });

  it('projects metadata.runtime and metadata.horizen from the SAME canonical readers as MoneyPenny/Nakamoto — never a second resolution', () => {
    expect(card).toMatch(/getAssetRuntimeDescriptor/);
    expect(card).toMatch(/resolveHorizenRegistrationBinding/);
    expect(card).toMatch(/resolveRegistrableAgent\('kn0w1'\)/);
  });

  it('never claims a Base Sepolia tokenId that does not exist', () => {
    expect(card).toMatch(/tokenId: binding\?\.token_id \?\? null/);
  });
});

describe('Know1 — health route mirrors the existing pattern, no live provider/DB calls', () => {
  const health = read('app/api/agents/kn0w1/health/route.ts');

  it('reports the correct agent id and stays side-effect-free', () => {
    expect(health).toMatch(/agent: 'aigent-kn0w1'/);
    expect(health).not.toMatch(/supabase/i);
    expect(health).not.toMatch(/fetch\(/);
  });
});

describe('Know1 — additive AigentQube migration touches only the new keys, never a duplicate INSERT', () => {
  const migration = read('supabase/migrations/20260810010000_kn0w1_horizen_admission_fields.sql');

  it('is an UPDATE on the EXISTING row, never an INSERT', () => {
    expect(migration).toMatch(/^UPDATE registry_assets/m);
    expect(migration).not.toMatch(/INSERT INTO registry_assets/);
    expect(migration).toMatch(/WHERE asset_id = 'aigentqube-kn0w1';/);
  });

  it('merges metadata shallowly (||) rather than overwriting the whole column', () => {
    expect(migration).toMatch(/metadata = metadata \|\| jsonb_build_object\(/);
  });

  it('external_registry_bindings starts pending — no fabricated tokenId', () => {
    const at = migration.indexOf("'external_registry_bindings', jsonb_build_array(");
    expect(at, 'external_registry_bindings jsonb_build_array call not found').toBeGreaterThan(-1);
    const section = migration.slice(at, at + 400);
    expect(section).toMatch(/'token_id', NULL/);
    expect(section).toMatch(/'status', 'pending-registration'/);
  });

  it('knyt_financial_context marks Know1 knowledge-grade, never execution-grade, and names MoneyPenny as the operational FS holder', () => {
    const at = migration.indexOf("'knyt_financial_context', jsonb_build_object(");
    expect(at, 'knyt_financial_context jsonb_build_object call not found').toBeGreaterThan(-1);
    const section = migration.slice(at, at + 1200);
    expect(section).toMatch(/'scope', 'knowledge_interpretation_guidance'/);
    expect(section).toMatch(/'operational_fs_role_holder', 'aigent-moneypenny'/);
    expect(section).toMatch(/'verifiable_pnl', 'not_applicable'/);
  });

  it('appends capabilities/tags via array concatenation, never replacing the existing arrays', () => {
    expect(migration).toMatch(/capabilities = capabilities \|\| jsonb_build_array\(/);
    expect(migration).toMatch(/tags = tags \|\| jsonb_build_array\(/);
  });
});
