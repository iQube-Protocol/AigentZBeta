/**
 * A2 completion — integrated asset selection/upload in PlacementAssetsPanel
 * (2026-09-02, native Qriptopian Admin -> Bridges). Prior state (paste-a-URL
 * only) is documented in the original commit's own header comment.
 *
 * Source-level structural proof, same style as
 * qriptopian-admin-bridges-tab.test.ts: never a raw, unauthenticated fetch
 * for the two admin routes the picker depends on (both hardened in the same
 * change), and the sign->PUT->register pipeline is reused rather than
 * forked — the ONLY raw `fetch` call in this whole panel is the actual PUT
 * to Supabase's own signed URL, which cannot go through personaFetch (it's
 * not an app API route).
 */
import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { shouldSkipEncryption } from '@/services/content/codexStorageRegisterHandler';

const TAB_SRC = 'app/triad/components/codex/tabs/QriptopianAdminTab.tsx';

describe('shouldSkipEncryption — public exposure requires an explicit signal (2026-09-02 correction)', () => {
  it('series="bridge" ALONE (makePublic omitted) does NOT skip encryption — the exact invariant this fix exists to enforce', () => {
    expect(shouldSkipEncryption('bridge', undefined)).toBe(false);
  });

  it('series="bridge" with makePublic explicitly false does NOT skip encryption', () => {
    expect(shouldSkipEncryption('bridge', false)).toBe(false);
  });

  it('series="bridge" WITH makePublic: true DOES skip encryption — the deliberate bridge-picker path', () => {
    expect(shouldSkipEncryption('bridge', true)).toBe(true);
  });

  it('any other series with makePublic: true also skips encryption — the flag, not the namespace, decides', () => {
    expect(shouldSkipEncryption('metaKnyts', true)).toBe(true);
  });

  it('series="qriptopian" keeps its pre-existing bare-series exemption, untouched by this fix', () => {
    expect(shouldSkipEncryption('qriptopian', undefined)).toBe(true);
  });
});

describe('PlacementAssetsPanel — integrated asset browse/upload (A2 completion)', () => {
  const src = stripComments(readSource(TAB_SRC));

  it('browses existing bridge assets via the gated assets-by-category route, using personaFetch (never a raw fetch)', () => {
    expect(src).toMatch(/personaFetch\(\s*\n?\s*`\/api\/admin\/codex\/assets-by-category\?series=\$\{BRIDGE_ASSET_SERIES\}/);
  });

  it('uploads via the EXISTING sign -> PUT -> register pipeline, both admin calls through personaFetch', () => {
    expect(src).toMatch(/personaFetch\('\/api\/admin\/codex\/storage\/sign'/);
    expect(src).toMatch(/personaFetch\('\/api\/admin\/codex\/storage\/register'/);
  });

  it('tags every bridge-uploaded asset with series=\'bridge\' — a distinct namespace, never mixed into KNYT/Qripto episode assets', () => {
    expect(src).toMatch(/const BRIDGE_ASSET_SERIES = 'bridge'/);
  });

  it('maps all three slots to existing codex asset kinds — never invents a new asset kind', () => {
    expect(src).toMatch(/video: 'social_campaign_video'/);
    expect(src).toMatch(/poster: 'social_campaign_image'/);
    expect(src).toMatch(/infographic: 'social_campaign_image'/);
  });

  it('the paste-a-URL fallback still exists — browse/upload are additive, not a replacement of the original slice', () => {
    expect(src).toMatch(/…or paste an already-uploaded asset URL/);
  });
});

describe('codexStorageRegisterHandler — public exposure requires an EXPLICIT signal, never a bare series match (corrected 2026-09-02)', () => {
  const src = stripComments(readSource('services/content/codexStorageRegisterHandler.ts'));

  it('skipEncryption is never decided by series === \'bridge\' alone — a bare namespace string must not authorize public exposure', () => {
    expect(src).not.toMatch(/series === 'bridge'/);
  });

  it('the decision is delegated to the exported, independently-tested shouldSkipEncryption helper — not re-inlined', () => {
    expect(src).toMatch(/const skipEncryption = shouldSkipEncryption\(series, makePublic\)/);
  });
});

describe('PlacementAssetsPanel — sets makePublic explicitly, never relies on series alone', () => {
  const src = stripComments(readSource('app/triad/components/codex/tabs/QriptopianAdminTab.tsx'));

  it('the storage/register call includes makePublic: true', () => {
    const at = src.indexOf("personaFetch('/api/admin/codex/storage/register'");
    expect(at).toBeGreaterThan(-1);
    const section = src.slice(at, at + 800);
    expect(section).toMatch(/makePublic:\s*true/);
  });
});
