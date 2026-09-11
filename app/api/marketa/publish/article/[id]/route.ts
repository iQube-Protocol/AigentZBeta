/**
 * GET  /api/marketa/publish/article/[id]  — fetch single article
 * PATCH /api/marketa/publish/article/[id] — update draft content
 *
 * Only draft articles can be patched. Published articles are immutable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const svc = getSmartContentService();
    const article = await svc.getById(params.id);
    if (!article) {
      return NextResponse.json({ ok: false, error: 'Article not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, article });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await req.json();
    const { title, body_markdown, excerpt, cover_image_url, target_section, campaign_tag } = body;

    const svc = getSmartContentService();
    const existing = await svc.getById(params.id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Article not found' }, { status: 404 });
    }
    if (existing.status === 'published') {
      return NextResponse.json(
        { ok: false, error: 'Published articles cannot be edited — create a new version instead' },
        { status: 400 },
      );
    }

    const updates: Record<string, any> = {};
    if (title?.trim()) updates.title = title.trim();
    if (body_markdown?.trim()) {
      const existingStructure = (existing as any).structure ?? {};
      updates.structure = {
        ...existingStructure,
        body: body_markdown.trim(),
        ...(target_section ? { target_section } : {}),
        ...(typeof campaign_tag === 'string' ? { campaign_tag: campaign_tag.trim() || undefined } : {}),
      };
    } else if (target_section || typeof campaign_tag === 'string') {
      const existingStructure = (existing as any).structure ?? {};
      updates.structure = {
        ...existingStructure,
        ...(target_section ? { target_section } : {}),
        ...(typeof campaign_tag === 'string' ? { campaign_tag: campaign_tag.trim() || undefined } : {}),
      };
    }
    if (typeof excerpt === 'string') updates.description = excerpt.trim() || undefined;
    if (typeof cover_image_url === 'string') updates.coverImageUri = cover_image_url.trim() || undefined;

    const updated = await svc.update(params.id, updates as any);
    return NextResponse.json({ ok: true, article: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
