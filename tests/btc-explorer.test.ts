/**
 * Bitcoin explorer canaries — the "once and for all" enforcement for the
 * recurring mempool-explorer bug (2026-07-06 audit).
 *
 * The bug class: explorer providers hardcoded per-surface drifted apart
 * (ops page migrated to blockstream for reliability; QCT surfaces stayed on
 * mempool.space and kept 404ing), and Merkle roots (64-hex, txid-shaped)
 * leaked into explorer /tx/ links. These canaries pin both properties:
 *
 *   1. NO source file outside the canonical helper hardcodes an explorer
 *      host for Bitcoin — every link/API base flows through btcExplorer.ts.
 *   2. isBitcoinTxid guards shape; provenance discipline (anchor.txid only,
 *      never lastAnchorId) is asserted in code comments + the status route's
 *      probe-confirmation pattern.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  btcApiBase,
  btcBlockHeightUrl,
  btcExplorerBase,
  btcTxUrl,
  isBitcoinTxid,
} from '@/services/ops/btcExplorer';

describe('btcExplorer helper', () => {
  it('defaults to blockstream testnet (the provider the platform standardized on)', () => {
    expect(btcExplorerBase()).toBe('https://blockstream.info/testnet');
    expect(btcTxUrl('a'.repeat(64))).toBe(`https://blockstream.info/testnet/tx/${'a'.repeat(64)}`);
    expect(btcBlockHeightUrl(4736703)).toBe('https://blockstream.info/testnet/block-height/4736703');
    expect(btcApiBase()).toContain('/api');
  });

  it('isBitcoinTxid: shape guard (necessary, not sufficient — Merkle roots also pass)', () => {
    expect(isBitcoinTxid('caaabee2695d173d718f012b065514f1b313fcad767dc3d836056cdb74de1903')).toBe(true);
    expect(isBitcoinTxid('CAAABEE2695D173D718F012B065514F1B313FCAD767DC3D836056CDB74DE1903')).toBe(true);
    expect(isBitcoinTxid('anchored: batch 42')).toBe(false); // canister status text
    expect(isBitcoinTxid('deadbeef')).toBe(false);
    expect(isBitcoinTxid(undefined)).toBe(false);
    expect(isBitcoinTxid(null)).toBe(false);
  });
});

describe('no hardcoded Bitcoin explorer hosts outside the helper', () => {
  // Main app only — sub-apps (apps/*) own their config locally and were
  // migrated to blockstream separately; they cannot import main-app modules.
  const ROOTS = ['services', 'components', 'config', 'app'];
  const ALLOWED = new Set(['services/ops/btcExplorer.ts']);
  const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

  function scan(dir: string, hits: string[]): void {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        scan(full, hits);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        const rel = full.replace(/\\/g, '/');
        if (ALLOWED.has(rel)) continue;
        const content = readFileSync(full, 'utf8');
        // mempool.space is fully forbidden (abandoned provider). Hardcoded
        // blockstream is forbidden outside the helper too — links must flow
        // through btcTxUrl/btcExplorerBase — EXCEPT in comments, which the
        // line-level filter below permits (provenance notes are fine).
        for (const [i, line] of content.split('\n').entries()) {
          const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
          if (code.includes('mempool.space') || code.includes('blockstream.info')) {
            hits.push(`${rel}:${i + 1}`);
          }
        }
      }
    }
  }

  it('every Bitcoin explorer reference flows through services/ops/btcExplorer.ts', () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      try {
        scan(root, hits);
      } catch {
        /* root may not exist in some checkouts */
      }
    }
    expect(hits, `hardcoded explorer hosts found:\n${hits.join('\n')}`).toEqual([]);
  });
});
