/**
 * GET /api/codex/knyt/terra
 *
 * Returns Qriptopian content that is tagged or related to KNYT / metaKNYT.
 * Surfaced in the Terra tab of the KNYT Cartridge.
 *
 * Content qualifies when it has ANY of:
 *   - tags array contains 'knyt' or 'metaknyt'
 *   - strand = 'qriptopian'
 *   - strand contains 'knyt'
 *
 * Results are ordered: featured first, then newest.
 * Fails gracefully when the table doesn't exist (pre-migration envs).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

const KNYT_TAGS = ["knyt", "metaknyt", "meta-knyt"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: [], total: 0 });
  }

  try {
    // Query nakamoto_content_items for KNYT-tagged or Qriptopian-strand content
    const { data, error } = await supabase
      .from("nakamoto_content_items")
      .select(
        "id, slug, title, description, tags, type, strand, status, featured, " +
        "social_url, social_embed_html, og_json, views_count, cover_image_id, created_at"
      )
      .eq("status", "published")
      .or(
        `tags.cs.{${KNYT_TAGS.join(",")}},strand.eq.qriptopian,strand.ilike.%knyt%`
      )
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // Table may not exist in all environments — return empty gracefully
      console.warn("[codex/knyt/terra] query error:", error.message);
      return NextResponse.json({ ok: true, data: [], total: 0 });
    }

    const items = (data ?? []).map((r) => ({
      id:              r.id as string,
      slug:            r.slug as string,
      title:           r.title as string,
      description:     (r.description as string | null) ?? undefined,
      tags:            (r.tags as string[] | null) ?? [],
      type:            r.type as string,
      strand:          r.strand as string,
      featured:        Boolean(r.featured),
      socialUrl:       (r.social_url as string | null) ?? undefined,
      socialEmbedHtml: (r.social_embed_html as string | null) ?? undefined,
      ogJson:          (r.og_json as Record<string, unknown> | null) ?? undefined,
      viewsCount:      Number(r.views_count ?? 0),
      createdAt:       r.created_at as string,
    }));

    return NextResponse.json({ ok: true, data: items, total: items.length });
  } catch (err) {
    console.error("[codex/knyt/terra] unexpected error:", err);
    return NextResponse.json({ ok: true, data: [], total: 0 });
  }
}
