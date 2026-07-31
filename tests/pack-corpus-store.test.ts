/**
 * Pack corpus store canary.
 *
 * Guards the read seam that moves the pack markdown corpus out of the SSR bundle
 * (services/knowledge/packCorpusStore.ts). Tests run with the corpus present on
 * disk (the repo checkout), so the store is in LOCAL-FS mode — the same mode
 * that ships in Phase A while the corpus is still bundled. This locks the parity
 * contract: the seam must read exactly what the old fs.readFileSync/readdirSync
 * helpers read, so flipping to remote mode (Phase B) is a pure substitution.
 */

import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  PACKS_ROOT,
  __corpusMode,
  corpusReadFile,
  corpusListMarkdown,
  corpusReadPackFile,
  ensureCorpusHydrated,
} from '../services/knowledge/packCorpusStore';
import { searchCodex } from '../services/knowledge/agentiqPackSearch';

describe('packCorpusStore (local-fs mode, as shipped in Phase A)', () => {
  it('detects local-fs mode when the corpus is on disk', () => {
    expect(__corpusMode()).toBe('local-fs');
  });

  it('ensureCorpusHydrated is a no-op in local-fs mode', async () => {
    await expect(ensureCorpusHydrated()).resolves.toBeUndefined();
  });

  it('reads a known pack file by absolute path', () => {
    // The AgentiQ pack collections manifest always exists.
    const abs = path.join(PACKS_ROOT, 'agentiq', 'collections.json');
    const raw = corpusReadFile(abs);
    expect(raw).toBeTruthy();
    expect(() => JSON.parse(raw as string)).not.toThrow();
  });

  it('returns null for a missing file (no throw)', () => {
    const abs = path.join(PACKS_ROOT, 'agentiq', 'does-not-exist-xyz.md');
    expect(corpusReadFile(abs)).toBeNull();
  });

  it('lists markdown under a pack subdir, relative to the pack root', () => {
    const agentiqRoot = path.join(PACKS_ROOT, 'agentiq');
    const updates = corpusListMarkdown(path.join(agentiqRoot, 'updates'), agentiqRoot);
    expect(updates.length).toBeGreaterThan(0);
    // paths are relative to the pack root and only .md
    expect(updates.every((p) => p.startsWith('updates/') && p.endsWith('.md'))).toBe(true);
  });

  it('corpusReadPackFile resolves a pack-qualified path', async () => {
    const raw = await corpusReadPackFile('agentiq', 'collections.json');
    expect(raw).toBeTruthy();
  });

  it('does not read outside a pack via the list prefix filter', () => {
    // Listing a leaf dir must not bleed sibling packs in.
    const irlRoot = path.join(PACKS_ROOT, 'irl');
    const foundation = corpusListMarkdown(path.join(irlRoot, 'foundation'), irlRoot);
    expect(foundation.every((p) => p.startsWith('foundation/'))).toBe(true);
  });
});

describe('PACK_CORPUS_URL pins remote mode (2026-07-22 incident contract)', () => {
  // Incident: the deployed Lambda shipped a PARTIAL pack tree — enough .md under
  // agentiq/updates to satisfy the local-fs sniff — so the store never hydrated
  // the remote blob and 404'd every file outside the partial tree. The contract
  // now: when the exporter has pinned PACK_CORPUS_URL (written only after a
  // verified public upload), the store MUST report remote mode regardless of
  // what is on disk, and single-file reads MUST still succeed via the per-file
  // disk fallback even when hydration is unavailable.
  it('overrides the local-fs sniff and keeps disk reads working as fallback', async () => {
    const { vi } = await import('vitest');
    vi.stubEnv('PACK_CORPUS_URL', 'https://example.invalid/pack-corpus/test/corpus-test.json');
    vi.resetModules();
    try {
      const mod = await import('../services/knowledge/packCorpusStore');
      // Full corpus is on disk in the test checkout — the pin must still win.
      expect(mod.__corpusMode()).toBe('remote');
      // Unhydrated remote mode: the map misses, the disk fallback serves the file.
      const abs = path.join(mod.PACKS_ROOT, 'agentiq', 'collections.json');
      expect(mod.corpusReadFile(abs)).toBeTruthy();
      // Listing unions the (empty) map with the disk tree — never empty on a checkout.
      const agentiqRoot = path.join(mod.PACKS_ROOT, 'agentiq');
      const updates = mod.corpusListMarkdown(path.join(agentiqRoot, 'updates'), agentiqRoot);
      expect(updates.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe('agentiqPackSearch still works through the seam', () => {
  it('returns results for a distinctive corpus term', async () => {
    await ensureCorpusHydrated();
    const results = searchCodex('invariant discovery', 5);
    expect(Array.isArray(results)).toBe(true);
    // The corpus documents invariant discovery heavily; expect at least one hit.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('packRelPath');
    expect(results[0]).toHaveProperty('excerpt');
  });
});
