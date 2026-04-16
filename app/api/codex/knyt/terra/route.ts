/**
 * GET /api/codex/knyt/terra
 *
 * Returns metaKNYT-related Qriptopian content for the KNYT Terra tab.
 *
 * Mirrors the QriptoScrollsTab metaKnyts classification exactly:
 *   - Fetch all content with placement.section = 'scrolls'
 *   - Exclude items whose placement.tab = 'synthsims'
 *   - Everything else defaults to metaKnyts (same logic as QriptoScrollsTab)
 *
 * Status filter includes 'archived' to match the scrolls route codex scope.
 * Falls back to an empty array on any DB error.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

// Match the codex-scope status filter used by /api/content/section/scrolls?scope=codex
const LIVE_STATUSES = ["published", "live", "archived"];

interface TerraItem {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  type: string;
  featured: boolean;
  coverImageUrl?: string;
  socialUrl?: string;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): TerraItem {
  const placement = (r.placement as Record<string, unknown> | null) ?? {};
  const modalities = (r.modalities as Record<string, unknown> | null) ?? {};
  const readMod  = (modalities.read  as Record<string, unknown> | null) ?? {};
  const linkMod  = (modalities.link  as Record<string, unknown> | null) ?? {};

  return {
    id:           r.id as string,
    title:        r.title as string,
    description:  (r.excerpt as string | null) ?? undefined,
    tags:         (r.tags as string[] | null) ?? [],
    type:         (r.format ?? r.type ?? "article") as string,
    featured:     (placement.position as number | null) === 1,
    coverImageUrl:(r.cover_image_url ?? r.thumbnail ?? r.image) as string | undefined,
    socialUrl:    (linkMod.url ?? readMod.url) as string | undefined,
    createdAt:    r.created_at as string,
  };
}

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: [], total: 0 });
  }

  try {
    // Fetch all scrolls content (same source as QriptoScrollsTab)
    const { data, error } = await supabase
      .from("content")
      .select(
        "id, title, excerpt, placement, tags, status, thumbnail, " +
        "cover_image_url, image, modalities, format, type, created_at"
      )
      .contains("placement", { section: "scrolls" })
      .in("status", LIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("[codex/knyt/terra] DB error:", error.message);
      return NextResponse.json({ ok: true, data: [], total: 0 });
    }

    const rows = (data ?? []) as Record<string, unknown>[];

    // Mirror QriptoScrollsTab classification:
    // Exclude synthsims; everything else is metaKnyts
    const metaKnyts = rows.filter((r) => {
      const placement = (r.placement as Record<string, unknown> | null) ?? {};
      const tab = ((placement.tab as string) ?? "").toLowerCase();
      return tab !== "synthsims";
    });

    const items = metaKnyts.map(mapRow);

    // Featured first, then newest
    items.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ ok: true, data: items, total: items.length });
  } catch (err) {
    console.error("[codex/knyt/terra] unexpected error:", err);
    return NextResponse.json({ ok: true, data: [], total: 0 });
  }
}
