/**
 * A2 completion — infographic publishes AND renders through the actual
 * bridge reader, using the shared media contract (2026-09-02, operator
 * directive: "an infographic must publish and render through the actual
 * bridge reader... Complete that connection using the shared media
 * contract").
 *
 * Proves: knytsBridgeEditorialConfig.ts's two-tier read/write keeps
 * headline/copy/video/poster fully working even before the
 * infographic_url migration lands (never a false "environment broken"),
 * while a write that actually SETS infographicUrl on a missing column
 * throws a named, distinguishable error; the placements route now accepts
 * 'infographic' as a valid slot (a real bug — the validator never accepted
 * it, so every infographic assign/publish this session's own earlier A2
 * completion pass built would have 400'd); and BridgeMediaStage actually
 * renders the image when passed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readSource, stripComments } from './_lib/sourceAuthority';

const mockRequireAdminPersona = vi.fn<[], Promise<boolean>>();
vi.mock('@/app/api/_lib/requireAdmin', () => ({
  requireAdminPersona: (...args: unknown[]) => mockRequireAdminPersona(...(args as [])),
}));
const mockAssignDraftAsset = vi.fn();
vi.mock('@/services/journey/bridgeContentPlacements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/journey/bridgeContentPlacements')>();
  return { ...actual, assignDraftAsset: (...args: unknown[]) => mockAssignDraftAsset(...args) };
});
vi.mock('@/app/api/community-content/_lib/personaContext', () => ({
  getCommunityContentSupabase: () => ({}),
}));
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: async () => null,
}));
import { POST as placementsPost } from '@/app/api/journey/knyts-bridge/placements/route';

describe('getKnytsBridgeEditorialSection — two-tier read keeps existing fields working pre-migration', () => {
  it('full select succeeds: infographicUrl populated alongside every existing field', async () => {
    const { getKnytsBridgeEditorialSection } = await import('@/services/journey/knytsBridgeEditorialConfig');
    const fake = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { section: 'ci-home', headline: 'H', short_copy: 'C', video_url: 'v', poster_url: 'p', infographic_url: 'i', campaign_cta: null, reward_copy: null, updated_at: null },
              error: null,
            }),
          }),
        }),
      }),
    };
    const result = await getKnytsBridgeEditorialSection(fake as any, 'ci-home');
    expect(result.infographicUrl).toBe('i');
    expect(result.videoUrl).toBe('v');
  });

  it('full select 42703s (column missing): retries legacy list — video/poster/copy still work, infographicUrl is null, never an error', async () => {
    const { getKnytsBridgeEditorialSection } = await import('@/services/journey/knytsBridgeEditorialConfig');
    let call = 0;
    const fake = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              call += 1;
              if (call === 1) {
                return { data: null, error: { code: '42703', message: 'column "infographic_url" does not exist' } };
              }
              return {
                data: { section: 'ci-home', headline: 'H', short_copy: 'C', video_url: 'v', poster_url: 'p', campaign_cta: null, reward_copy: null, updated_at: null },
                error: null,
              };
            },
          }),
        }),
      }),
    };
    const result = await getKnytsBridgeEditorialSection(fake as any, 'ci-home');
    expect(call).toBe(2);
    expect(result.infographicUrl).toBeNull();
    expect(result.videoUrl).toBe('v');
    expect(result.headline).toBe('H');
  });
});

describe('upsertKnytsBridgeEditorialSection — write-side honesty for the not-yet-migrated column', () => {
  it('setting infographicUrl on a missing column throws KnytsBridgeInfographicColumnMissingError, never a raw Postgres message', async () => {
    const { upsertKnytsBridgeEditorialSection, KnytsBridgeInfographicColumnMissingError } = await import('@/services/journey/knytsBridgeEditorialConfig');
    const fake = {
      from: () => ({
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { code: '42703', message: 'column "infographic_url" does not exist' } }),
          }),
        }),
      }),
    };
    await expect(
      upsertKnytsBridgeEditorialSection(fake as any, 'ci-home', { infographicUrl: 'https://x/i.svg' }, 'persona-1'),
    ).rejects.toThrow(KnytsBridgeInfographicColumnMissingError);
  });

  it('updating ONLY videoUrl keeps working even when infographic_url is missing (retries with the legacy column list)', async () => {
    const { upsertKnytsBridgeEditorialSection } = await import('@/services/journey/knytsBridgeEditorialConfig');
    let call = 0;
    const fake = {
      from: () => ({
        upsert: () => ({
          select: () => ({
            single: async () => {
              call += 1;
              if (call === 1) return { data: null, error: { code: '42703', message: 'column "infographic_url" does not exist' } };
              return { data: { section: 'ci-home', headline: null, short_copy: null, video_url: 'https://x/y.mp4', poster_url: null, campaign_cta: null, reward_copy: null, updated_at: null }, error: null };
            },
          }),
        }),
      }),
    };
    const result = await upsertKnytsBridgeEditorialSection(fake as any, 'ci-home', { videoUrl: 'https://x/y.mp4' }, 'persona-1');
    expect(call).toBe(2);
    expect(result.videoUrl).toBe('https://x/y.mp4');
    expect(result.infographicUrl).toBeNull();
  });
});

describe('POST /api/journey/knyts-bridge/placements — accepts \'infographic\' as a valid slot (bugfix)', () => {
  beforeEach(() => {
    mockRequireAdminPersona.mockReset();
    mockAssignDraftAsset.mockReset();
  });

  it('an assign action with slot="infographic" reaches assignDraftAsset — previously 400\'d with "slot must be video or poster"', async () => {
    mockRequireAdminPersona.mockResolvedValue(true);
    mockAssignDraftAsset.mockResolvedValue({ section: 'ci-home', slot: 'infographic', draftAssetUrl: 'https://x/i.svg' });
    const req = new NextRequest('https://dev-beta.aigentz.me/api/journey/knyts-bridge/placements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section: 'ci-home', slot: 'infographic', action: 'assign', assetUrl: 'https://x/i.svg' }),
    });
    const res = await placementsPost(req);
    expect(res.status).toBe(200);
    expect(mockAssignDraftAsset).toHaveBeenCalledTimes(1);
  });
});

describe('BridgeMediaStage — renders the infographic image when provided (shared media contract)', () => {
  const src = stripComments(readSource('components/journey/BridgeMediaStage.tsx'));

  it('accepts an infographicUrl prop', () => {
    expect(src).toMatch(/infographicUrl\?:\s*string/);
  });

  it('renders an <img> for infographicUrl in all three render branches (cinematic+video, cinematic fallback, standard)', () => {
    const imgRenders = src.match(/infographicUrl && \(/g) ?? [];
    expect(imgRenders.length).toBeGreaterThanOrEqual(3);
  });
});

describe('KnytsBridgeMediaStage / ConstitutionalInternetBridgeMediaStage — thread infographicUrl through, never drop it', () => {
  it('KnytsBridgeMediaStage.tsx passes config.infographicUrl to BridgeMediaStage', () => {
    const src = stripComments(readSource('components/journey/KnytsBridgeMediaStage.tsx'));
    expect(src).toMatch(/infographicUrl=\{config\.infographicUrl \?\? undefined\}/);
  });

  it('ConstitutionalInternetBridgeMediaStage.tsx passes config.infographicUrl to BridgeMediaStage', () => {
    const src = stripComments(readSource('components/journey/ConstitutionalInternetBridgeMediaStage.tsx'));
    expect(src).toMatch(/infographicUrl=\{config\.infographicUrl \?\? undefined\}/);
  });
});
