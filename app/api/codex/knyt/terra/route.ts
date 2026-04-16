/**
 * GET /api/codex/knyt/terra
 *
 * Returns metaKNYT-related Qriptopian content for the KNYT Terra tab.
 *
 * Sources (merged, deduplicated by id):
 *   1. Primary  — content table where placement @> {section:"scrolls", tab:"metaknyts"}
 *                 (the metaKnyts sub-tab of the Qriptopian Scrolls side-menu)
 *   2. Broad    — content table where title contains metaknyt / metaknyts / knyt / meta-knyt
 *                 (case-insensitive; catches content not yet placement-tagged)
 *
 * Fails gracefully on DB errors (returns empty array).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

const SELECT_COLS =
  "id, title, excerpt, placement, tags, status, thumbnail, cover_image_url, " +
  "image, modalities, format, type, issue_ref, created_at";

const LIVE_STATUSES = ["published", "live", "active"];

function mapRow(r: Record<string, unknown>): TerraItem {
  const placement = (r.placement as Record<string, unknown> | null) ?? {};
  const modalities = (r.modalities as Record<string, unknown> | null) ?? {};
  const readMod = (modalities.read as Record<string, unknown> | null) ?? {};
  const linkMod = (modalities.link as Record<string, unknown> | null) ?? {};

  return {
    id:            r.id as string,
    title:         r.title as string,
    description:   (r.excerpt as string | null) ?? undefined,
    tags:          (r.tags as string[] | null) ?? [],
    type:          (r.format ?? r.type ?? "article") as string,
    featured:      (placement.position as number | null) === 1,
    coverImageUrl: (r.cover_image_url ?? r.thumbnail ?? r.image) as string | undefined,
    socialUrl:     (linkMod.url ?? readMod.url) as string | undefined,
    createdAt:     r.created_at as string,
  };
}

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

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: [], total: 0 });
  }

  try {
    // ── 1. Primary: content in the metaKnyts placement slot ─────────────────
    const placementQuery = supabase
      .from("content")
      .select(SELECT_COLS)
      .contains("placement", { section: "scrolls", tab: "metaknyts" })
      .in("status", LIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(40);

    // ── 2. Broad: title-based sweep for any KNYT / metaKnyt content ──────────
    const titleQuery = supabase
      .from("content")
      .select(SELECT_COLS)
      .or(
        "title.ilike.%metaknyt%," +
        "title.ilike.%metaknyts%," +
        "title.ilike.%knyt%," +
        "title.ilike.%meta-knyt%"
      )
      .in("status", LIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(40);

    const [primary, broad] = await Promise.all([placementQuery, titleQuery]);

    // Merge and deduplicate by id
    const seen = new Set<string>();
    const merged: TerraItem[] = [];

    for (const row of [
      ...(primary.data ?? []),
      ...(broad.data ?? []),
    ] as Record<string, unknown>[]) {
      const id = row.id as string;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(mapRow(row));
    }

    // Sort: featured first, then newest
    merged.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ ok: true, data: merged, total: merged.length });
  } catch (err) {
    console.error("[codex/knyt/terra] unexpected error:", err);
    return NextResponse.json({ ok: true, data: [], total: 0 });
  }
}
