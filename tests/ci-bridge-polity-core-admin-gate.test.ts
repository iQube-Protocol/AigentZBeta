/**
 * The Constitutional Internet working-manuscript tab in Polity Core
 * (`polity-core-commentary-constitutional-internet`) must be admin-only —
 * both in the tab registry (so it never renders in the UI for a non-admin)
 * and at the underlying file-reader route (so a direct request to
 * /api/codex/packs/polity-core/file?path=... can't bypass the UI gate and
 * pull the same working manuscript for someone who merely knows the route).
 *
 * CI Bridge correction pass, 2026-08-12: this tab was `enabled: true` with no
 * `adminOnly` flag, and the reader route it depends on
 * (app/api/codex/packs/[packId]/file/route.ts) had no access control of its
 * own at all — a client-side registry flag alone would have been security
 * theater. Both layers are verified here; sibling public commentary tabs
 * (Experience Sovereignty, COYN Thesis, The Polity) must stay unaffected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockCorpusReadPackFile = vi.fn(async () => '# manuscript content');
vi.mock('@/services/knowledge/packCorpusStore', () => ({
  corpusReadPackFile: (...args: any[]) => mockCorpusReadPackFile(...args),
}));

import { GET } from '@/app/api/codex/packs/[packId]/file/route';
import { QRIPTO_CODEX, POLITY_CORE_CARTRIDGE } from '@/data/codex-configs';

function makeRequest(path: string): NextRequest {
  const url = new URL(`https://dev-beta.aigentz.me/api/codex/packs/polity-core/file?path=${encodeURIComponent(path)}`);
  return {
    nextUrl: { searchParams: url.searchParams },
  } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockCorpusReadPackFile.mockClear();
});

describe('Tab registry — polity-core Constitutional Internet tab', () => {
  it('the CI working-manuscript tab is adminOnly', () => {
    const tab = POLITY_CORE_CARTRIDGE.tabs.find((t) => t.id === 'polity-core-commentary-constitutional-internet');
    expect(tab).toBeTruthy();
    expect(tab?.adminOnly).toBe(true);
  });

  it('sibling public commentary tabs stay enabled and non-admin', () => {
    for (const id of [
      'polity-core-commentary-experience-sovereignty',
      'polity-core-commentary-coyn-thesis',
      'polity-core-commentary-polity',
    ]) {
      const tab = POLITY_CORE_CARTRIDGE.tabs.find((t) => t.id === id);
      expect(tab, `${id} not found`).toBeTruthy();
      expect(tab?.enabled).toBe(true);
      expect(tab?.adminOnly).not.toBe(true);
    }
  });

  it('Qriptopian Papers series taxonomy exposes the Polity Papers series (public destination for CI Bridge "Continue reading")', () => {
    const papersTab = QRIPTO_CODEX.tabs.find((t) => t.id === 'papers');
    expect(papersTab).toBeTruthy();
    expect(papersTab?.slug).toBe('papers');
    expect(QRIPTO_CODEX.slug).toBe('qripto');
  });
});

describe('Route gate — GET /api/codex/packs/polity-core/file', () => {
  it('refuses a non-admin direct request for the CI manuscript path', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await GET(
      makeRequest('items/commentary/constitutional-internet/00-project-structure.md'),
      { params: Promise.resolve({ packId: 'polity-core' }) },
    );
    expect(res.status).toBe(403);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated direct request for the CI manuscript path', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(
      makeRequest('items/commentary/constitutional-internet/00-project-structure.md'),
      { params: Promise.resolve({ packId: 'polity-core' }) },
    );
    expect(res.status).toBe(403);
    expect(mockCorpusReadPackFile).not.toHaveBeenCalled();
  });

  it('serves the CI manuscript path to an admin persona', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: true } });
    const res = await GET(
      makeRequest('items/commentary/constitutional-internet/00-project-structure.md'),
      { params: Promise.resolve({ packId: 'polity-core' }) },
    );
    expect(res.status).toBe(200);
    expect(mockCorpusReadPackFile).toHaveBeenCalled();
  });

  it('does not gate a sibling public commentary path (The Polity) for a non-admin', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'p1', cartridgeFlags: { isAdmin: false } });
    const res = await GET(
      makeRequest('items/commentary/README.md'),
      { params: Promise.resolve({ packId: 'polity-core' }) },
    );
    expect(res.status).toBe(200);
    expect(mockCorpusReadPackFile).toHaveBeenCalled();
  });
});
