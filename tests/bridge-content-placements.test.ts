/**
 * bridgeContentPlacements.ts — QRP-BRIDGE-ADMIN A2 (2026-09-01).
 *
 * Proves: assign never touches the live editorial-config row; publish
 * refuses (never silently no-ops) when there is no draft; a successful
 * publish copies draft->published, bumps revision, and writes the
 * resolved URL into knyts_bridge_editorial_config via the EXISTING
 * upsertKnytsBridgeEditorialSection function (video->videoUrl,
 * poster->posterUrl) — never a second write path. A missing table
 * degrades to null/empty, never a false uncertainty.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';

vi.mock('@/services/journey/knytsBridgeEditorialConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/journey/knytsBridgeEditorialConfig')>();
  return { ...actual, upsertKnytsBridgeEditorialSection: vi.fn().mockResolvedValue({ section: 'ci-home' }) };
});

import { upsertKnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';
import {
  getPlacement,
  getPlacementsForSection,
  assignDraftAsset,
  publishPlacement,
} from '@/services/journey/bridgeContentPlacements';

/** Minimal fake Supabase query builder — just enough surface for this module's
 *  exact call shapes (.from().select().eq().eq().maybeSingle(), .upsert().select().single(),
 *  .update().eq().eq().select().single()). Records what was written for assertions. */
function makeFakeSupabase(row: Record<string, unknown> | null) {
  let currentRow = row;
  const writes: Array<{ op: string; payload: unknown }> = [];
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: currentRow, error: null }),
    upsert: (payload: unknown) => { writes.push({ op: 'upsert', payload }); currentRow = { ...(currentRow ?? {}), ...(payload as object) }; return builder; },
    update: (payload: unknown) => { writes.push({ op: 'update', payload }); currentRow = { ...(currentRow ?? {}), ...(payload as object) }; return builder; },
    single: async () => ({ data: currentRow, error: null }),
    then: undefined,
  };
  // .select() alone (no .eq chain) used by getPlacementsForSection — awaited directly
  const rootBuilder = {
    ...builder,
    select: () => ({ eq: () => Promise.resolve({ data: currentRow ? [currentRow] : [], error: null }), ...builder }),
  };
  return { from: () => rootBuilder, _writes: writes, _row: () => currentRow };
}

describe('assignDraftAsset — never touches the live editorial-config row', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts draft fields only, and does not call upsertKnytsBridgeEditorialSection', async () => {
    const fake = makeFakeSupabase(null);
    const result = await assignDraftAsset(fake as any, 'ci-home', 'video', { assetId: 'a1', assetUrl: 'https://x/y.mp4' }, 'persona-1');
    expect(result.draftAssetUrl).toBe('https://x/y.mp4');
    expect(upsertKnytsBridgeEditorialSection).not.toHaveBeenCalled();
  });
});

describe('publishPlacement — refuses when there is no draft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws no-draft-to-publish rather than silently blanking the live field', async () => {
    const fake = makeFakeSupabase({ section: 'ci-home', slot: 'video', draft_asset_url: null, revision: 0, status: 'draft' });
    await expect(publishPlacement(fake as any, 'ci-home', 'video', 'persona-1')).rejects.toThrow('no-draft-to-publish');
    expect(upsertKnytsBridgeEditorialSection).not.toHaveBeenCalled();
  });
});

describe('publishPlacement — a real publish copies draft to published and writes the SAME live config row', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bumps revision, sets status published, and calls upsertKnytsBridgeEditorialSection with videoUrl for slot=video', async () => {
    const fake = makeFakeSupabase({
      section: 'ci-home', slot: 'video',
      draft_asset_id: 'a1', draft_asset_url: 'https://x/y.mp4',
      revision: 2, status: 'draft',
    });
    const result = await publishPlacement(fake as any, 'ci-home', 'video', 'persona-1');
    expect(result.placement.status).toBe('published');
    expect(result.placement.revision).toBe(3);
    expect(upsertKnytsBridgeEditorialSection).toHaveBeenCalledWith(
      expect.anything(), 'ci-home', { videoUrl: 'https://x/y.mp4' }, 'persona-1',
    );
  });

  it('calls upsertKnytsBridgeEditorialSection with posterUrl for slot=poster — never the wrong field', async () => {
    const fake = makeFakeSupabase({
      section: 'ci-home', slot: 'poster',
      draft_asset_id: 'a2', draft_asset_url: 'https://x/p.png',
      revision: 0, status: 'draft',
    });
    await publishPlacement(fake as any, 'ci-home', 'poster', 'persona-1');
    expect(upsertKnytsBridgeEditorialSection).toHaveBeenCalledWith(
      expect.anything(), 'ci-home', { posterUrl: 'https://x/p.png' }, 'persona-1',
    );
  });
});

describe('missing-table degradation — never a false uncertainty', () => {
  it('getPlacement returns null on a 42P01 (relation does not exist) error', async () => {
    const fake = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: '42P01', message: 'relation "bridge_content_placements" does not exist' } }) }) }) }) }) };
    await expect(getPlacement(fake as any, 'ci-home', 'video')).resolves.toBeNull();
  });

  it('getPlacementsForSection returns both slots null on a missing table', async () => {
    const fake = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) }) }) };
    await expect(getPlacementsForSection(fake as any, 'ci-home')).resolves.toEqual({ video: null, poster: null });
  });
});

describe('the API route reuses the single allow-list and the module\'s own functions — no second write path', () => {
  const src = stripComments(readSource('app/api/journey/knyts-bridge/placements/route.ts'));

  it('imports KNYTS_BRIDGE_ALLOWED_SECTIONS rather than a hand-copied section list', () => {
    expect(src).toMatch(/import \{ KNYTS_BRIDGE_ALLOWED_SECTIONS \} from '@\/services\/journey\/knytsBridgeEditorialConfig'/);
  });

  it('both GET and POST call requireAdminPersona — drafts are never publicly readable', () => {
    const requireAdminCalls = src.match(/const isAdmin = await requireAdminPersona\(req\);/g) ?? [];
    expect(requireAdminCalls.length).toBe(2); // once in GET, once in POST
  });

  it('delegates assign/publish entirely to bridgeContentPlacements.ts — never writes to bridge_content_placements or knyts_bridge_editorial_config directly', () => {
    expect(src).not.toMatch(/\.from\(['"`](bridge_content_placements|knyts_bridge_editorial_config)['"`]\)/);
    expect(src).toMatch(/assignDraftAsset|publishPlacement/);
  });
});

describe('the editorial-config route now shares the same allow-list — no drift risk between the two routes', () => {
  const editorialSrc = stripComments(readSource('app/api/journey/knyts-bridge/editorial-config/route.ts'));

  it('imports KNYTS_BRIDGE_ALLOWED_SECTIONS instead of declaring its own copy', () => {
    expect(editorialSrc).toMatch(/import \{[\s\S]*KNYTS_BRIDGE_ALLOWED_SECTIONS[\s\S]*\} from '@\/services\/journey\/knytsBridgeEditorialConfig'/);
    expect(editorialSrc).not.toMatch(/const ALLOWED_SECTIONS = new Set/);
  });
});
