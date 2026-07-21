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
