/**
 * A LOCAL CANISTER ID MUST NEVER BE PRESENTED AS MAINNET TRUTH
 * (operator directive, 2026-08-08).
 *
 * `uxrrr-q7777-77774-qaaaq-cai` is the local dfx id for btc_signer_psbt. Commit
 * a88bc3a (iQubeBeta-Program) wrote it into mainnet environment configuration
 * under the heading "Bitcoin Signer - LIVE MAINNET", and it propagated from
 * there into this repo's canister_ids.json, deployment docs, monitoring lists
 * and cartridge knowledge packs.
 *
 * The cost was not cosmetic. `proof_of_state::anchor()` calls that principal;
 * it resolves `canister_not_found` on the IC; the call fails; and the error
 * branch synthesises `mock_btc_txid_*`. Every one of 76 "anchored" batches
 * recorded a Bitcoin anchor that never happened — because a local id wore a
 * mainnet label.
 *
 * This canary makes the reintroduction of that claim a build failure.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** Local dfx principals render with this group; mainnet ids never do. */
const LOCAL_DFX_SHAPE = /[a-z0-9]{5}-[a-z0-9]{5,6}-77774-[a-z0-9]{5}-cai/;

function read(p: string): string {
  const full = join(process.cwd(), p);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

describe('no local canister id may be presented as mainnet', () => {
  it('canister_ids.json lists no local-shaped principal under "ic"', () => {
    const ids = JSON.parse(read('canister_ids.json') || '{}') as Record<string, Record<string, string>>;
    const offenders = Object.entries(ids)
      .filter(([, nets]) => typeof nets?.ic === 'string' && LOCAL_DFX_SHAPE.test(nets.ic))
      .map(([name, nets]) => `${name}=${nets.ic}`);
    expect(
      offenders,
      `These entries claim a LOCAL dfx principal is deployed on "ic": ${offenders.join(', ')}. ` +
        'A dependent canister calling one of these fails at runtime, and a caller with a synthesising ' +
        'error branch will report that failure as success.',
    ).toEqual([]);
  });

  it('no active deployment config labels a local principal as LIVE MAINNET', () => {
    for (const p of ['DEPLOYMENT_CONFIG.md', 'docs/DEPLOYMENT_CONFIG.md']) {
      const text = read(p);
      if (!text) continue;
      for (const line of text.split('\n')) {
        // An uncommented assignment of a local-shaped id is the defect. The
        // corrected files retain the id inside comments explaining the history,
        // which is documentation rather than configuration.
        if (line.trimStart().startsWith('#')) continue;
        expect(
          LOCAL_DFX_SHAPE.test(line),
          `${p} assigns a local-shaped canister id as live configuration: ${line.trim()}`,
        ).toBe(false);
      }
    }
  });

  it('the BTC signer is not described as a live canister anywhere active', () => {
    const claims: Array<[string, RegExp]> = [
      ['docs/MINTING_ACTIVATION_PLAN.md', /canister is live \(confirmed\)/i],
      ['codexes/packs/aigency/items/repos/network-and-minting-state.md', /# Live canister/],
    ];
    for (const [p, pattern] of claims) {
      const text = read(p);
      if (!text) continue;
      expect(pattern.test(text), `${p} still describes the BTC signer as live; the census says otherwise`).toBe(false);
    }
  });

  it('AGENTS.md carries the hard-coded-principal invariant', () => {
    const agents = read('AGENTS.md');
    expect(agents).toContain('Production canister principals are never hard-coded');
    expect(agents).toContain('mock_btc_txid_');
  });
});
