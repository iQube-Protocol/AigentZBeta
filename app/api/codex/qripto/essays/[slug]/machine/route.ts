import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getReadingEditions, resolveReadingEdition } from '@/services/smartcontent/readingEditions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * Machine-readable projection for canonical Qriptopian Threshold essays.
 *
 * Human-readable prose remains canonical in `modalities.read.text`. This route
 * exposes the structured semantic envelope carried in `ai_metadata`, plus the
 * canonical markdown and stable content id, so agents can consume the essay
 * without scraping the presentation UI.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from('content')
    .select('id,title,slug,excerpt,tags,status,published_at,updated_at,modalities,ai_metadata,verification_did,verification_proof')
    .eq('domain', 'qriptopian')
    .eq('status', 'published')
    .eq('slug', slug)
    .contains('tags', ['thresholds', 'essay'])
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Threshold essay not found' }, { status: 404 });
  }

  const read = (data.modalities as any)?.read ?? {};
  const semantic = (data.ai_metadata as any) ?? {};

  return NextResponse.json({
    schema: semantic.schema ?? 'qriptopian.threshold-essay.v1',
    machineReadable: true,
    id: data.id,
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    publicationClass: semantic.publicationClass ?? 'essay',
    series: semantic.series ?? 'Thresholds',
    seriesNumber: semantic.seriesNumber ?? null,
    thesis: semantic.thesis ?? null,
    primaryQuestion: semantic.primaryQuestion ?? null,
    primitives: semantic.primitives ?? [],
    relations: semantic.relations ?? {},
    evidenceDiscipline: semantic.evidenceDiscipline ?? null,
    tags: data.tags ?? [],
    readingEditions: getReadingEditions(read),
    defaultReadingEdition: resolveReadingEdition(read)?.id ?? null,
    canonicalText: {
      format: 'markdown',
      text: read.text ?? '',
      duration: read.duration ?? null,
    },
    verification: {
      did: data.verification_did ?? null,
      proof: data.verification_proof ?? null,
    },
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
  });
}
