/**
 * POST /api/marketa/publish/article/[id]/publish
 *
 * Publishes a draft article created via /api/marketa/publish/article.
 * Delegates to /api/content/smart/[id]/publish.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Article ID required' }, { status: 400 });
    }

    const service = getSmartContentService();

    const existing = await service.getById(id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Article not found' }, { status: 404 });
    }
    if (existing.status === 'published') {
      return NextResponse.json({ ok: false, error: 'Article is already published' }, { status: 400 });
    }

    const content = await service.publish(id);
    return NextResponse.json({ ok: true, article: content, message: 'Published successfully' });
  } catch (err: any) {
    console.error('[marketa/publish/article/[id]/publish] error:', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Publish failed' }, { status: 500 });
  }
}
