/**
 * POST /api/marketa/publish/article
 *
 * Thin wrapper around /api/content/smart for Marketa admin article creation.
 * Handles app/tenantId/creatorRootDid resolution so the UI doesn't need to
 * know about DID or tenant details.
 *
 * All articles are created as drafts (status='draft') by default.
 * Use POST /api/marketa/publish/article/[id]/publish to go live.
 *
 * Body:
 *   title          string   required
 *   body_markdown  string   required  (article body)
 *   excerpt        string   optional
 *   cover_image_url string  optional
 *   target_codex   'qriptopian' | 'knyt'   required
 *   target_section string   required  (e.g. 'features', 'lore', 'scrolls')
 *   campaign_tag   string   optional
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';

export const dynamic = 'force-dynamic';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

const CODEX_MAP: Record<string, { app: string; tenantId: string }> = {
  qriptopian: { app: 'Qriptopian',  tenantId: 'qriptopian' },
  knyt:       { app: 'metaKnyts',   tenantId: 'metaknyts'  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, body_markdown, excerpt, cover_image_url, target_codex, target_section, campaign_tag } = body;

    if (!title?.trim() || !body_markdown?.trim() || !target_codex || !target_section) {
      return NextResponse.json(
        { ok: false, error: 'title, body_markdown, target_codex, and target_section are required' },
        { status: 400 },
      );
    }

    const mapping = CODEX_MAP[target_codex];
    if (!mapping) {
      return NextResponse.json(
        { ok: false, error: `Unknown target_codex "${target_codex}". Use 'qriptopian' or 'knyt'.` },
        { status: 400 },
      );
    }

    const creatorRootDid = process.env.MARKETA_CREATOR_DID ?? 'did:iq:marketa-admin';
    const slug = `marketa-${slugify(title)}-${Date.now()}`;

    const service = getSmartContentService();
    const content = await service.create({
      app:            mapping.app,
      title:          title.trim(),
      slug,
      creatorRootDid,
      tenantId:       mapping.tenantId,
      description:    excerpt?.trim() ?? '',
      coverImageUri:  cover_image_url?.trim() ?? undefined,
      structure: {
        body:           body_markdown.trim(),
        target_section: target_section,
        campaign_tag:   campaign_tag ?? null,
        created_via:    'marketa-publish-tab',
      },
      layoutHints: {
        section:    target_section,
        target_tab: target_section,
      },
      modalities: ['read'],
    });

    return NextResponse.json({ ok: true, article: content }, { status: 201 });
  } catch (err: any) {
    console.error('[marketa/publish/article] POST error:', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Failed to create article' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const target_codex = searchParams.get('target_codex');
    const status = (searchParams.get('status') ?? 'draft') as 'draft' | 'published';

    const mapping = target_codex ? CODEX_MAP[target_codex] : null;

    const service = getSmartContentService();
    const result = await service.list({
      app:    mapping?.app,
      status,
      limit:  50,
      offset: 0,
    });

    return NextResponse.json({ ok: true, articles: result.data, total: result.total });
  } catch (err: any) {
    console.error('[marketa/publish/article] GET error:', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Failed to list articles' }, { status: 500 });
  }
}
