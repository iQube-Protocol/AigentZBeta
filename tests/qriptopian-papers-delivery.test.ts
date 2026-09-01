import { describe, expect, it, vi, beforeEach } from 'vitest';

const fixture = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const query: any = {
      select: () => query,
      eq: () => query,
      order: async () => ({ data: fixture.rows, error: null }),
    };
    return { from: () => query };
  },
}));

import { GET } from '@/app/api/codex/qripto/papers/route';

const cid = 'bafkr6iargywjrjia4kf3wsglmpzkij5ghsdk7voj2dc5j74qmdxodtntla';
const asset = (id: string, fields: Record<string, unknown> = {}) => ({
  id, title: 'Paper I — Invitation', supabase_title: null,
  asset_kind: 'background_lore_doc', mime_type: 'application/pdf',
  auto_drive_cid: cid, cover_thumb_url: null,
  created_at: '2026-08-30T23:00:00Z', series_scope: 'papers/embodiment',
  is_shareable: true, ...fields,
});
const read = async (query = '') => (await GET(new Request(`https://example.test/api/codex/qripto/papers${query}`) as any)).json();

describe('Papers taxonomy and storage identity', () => {
  beforeEach(() => { fixture.rows = []; });

  it('keeps four original Polity papers separate from five Embodiment papers', async () => {
    fixture.rows = [
      ...Array.from({ length: 4 }, (_, i) => asset(`polity-${i}`, {
        title: `${i + 1} Original Polity`, series_scope: null,
        auto_drive_cid: `https://storage.example/papers-polity_${i}.pdf`,
      })),
      ...Array.from({ length: 5 }, (_, i) => asset(`embodiment-${i}`, { title: `${i + 1} Embodiment` })),
    ];
    const { papers } = await read();
    expect(papers.filter((p: any) => p.scope === 'papers/polity')).toHaveLength(4);
    expect(papers.filter((p: any) => p.scopeLabel === 'Embodiment')).toHaveLength(5);
  });

  it('preserves manual-upload PDF and cover URLs exactly', async () => {
    const pdf = 'https://storage.example/papers-polity_123.pdf';
    const cover = 'https://storage.example/papers-polity_124.png';
    fixture.rows = [asset('paper', { series_scope: null, auto_drive_cid: pdf }),
      asset('cover', { series_scope: null, auto_drive_cid: cover, asset_kind: 'cover_image', mime_type: 'image/png' })];
    const { papers } = await read();
    expect(papers[0].pdfUrl).toBe(pdf);
    expect(papers[0].coverUrl).toBe(cover);
  });

  it('projects CIDs to delivery routes without mutating canonical source identity', async () => {
    fixture.rows = [asset('paper'), asset('cover', { asset_kind: 'cover_image', mime_type: 'image/png' })];
    const original = JSON.stringify(fixture.rows);
    const { papers } = await read();
    expect(papers[0].pdfUrl).toBe('/api/content/media/paper');
    expect(papers[0].coverUrl).toBe('/api/qriptopian/essay-cover/cover');
    expect(JSON.stringify(fixture.rows)).toBe(original);
  });

  it('explicit taxonomy outranks a legacy Polity filename', async () => {
    fixture.rows = [asset('paper', { auto_drive_cid: 'https://storage.example/papers-polity_123.pdf' })];
    expect((await read('?scope=papers%2Fembodiment')).papers).toHaveLength(1);
    expect((await read('?scope=papers%2Fpolity')).papers).toHaveLength(0);
  });

  it('keeps each Embodiment paper paired with its own cover', async () => {
    const titles = ['Paper I — Invitation', 'Paper II — Rights', 'Paper III — Passport', 'Paper IV — Presence', 'Paper V — Accession'];
    fixture.rows = titles.flatMap((title, i) => [asset(`paper-${i}`, { title }),
      asset(`cover-${i}`, { title, asset_kind: 'cover_image', mime_type: 'image/png' })]);
    const { papers } = await read();
    expect(papers).toHaveLength(5);
    for (const paper of papers) {
      expect(paper.coverUrl).toBe(`/api/qriptopian/essay-cover/cover-${paper.id.slice(-1)}`);
    }
  });

  it('does not promote private/unclassified CIDs or canonical plates into Papers', async () => {
    fixture.rows = [asset('private', { series_scope: 'admin/embodiment-wip', auto_drive_cid: 'https://storage.example/papers-polity_123.pdf' }),
      asset('unclassified', { series_scope: null }),
      asset('not-shareable', { is_shareable: false }),
      asset('canonical', { series_scope: 'canonical/constitutional-internet' })];
    expect((await read()).papers).toHaveLength(0);
  });

  it('retains canonical/Protocols exclusions and the magazines group boundary', async () => {
    fixture.rows = [asset('protocol', { series_scope: 'papers/protocols' }),
      asset('magazine', { series_scope: 'magazines/1' }), asset('paper')];
    expect((await read()).papers.map((p: any) => p.id)).toEqual(['paper']);
    expect((await read('?group=magazines')).papers.map((p: any) => p.id)).toEqual(['magazine']);
  });
});
