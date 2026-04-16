/**
 * GET /api/codex/knyt/terra
 *
 * Returns metaKNYT-related Qriptopian content for the KNYT Terra tab.
 *
 * Query strategy mirrors /api/content/section/[section] exactly:
 *   1. Try placement @> {section:"scrolls", issue:"issue-1"} (issue-scoped)
 *   2. Fall back to placement @> {section:"scrolls"} (unscoped)
 *   3. Filter: exclude placement.tab = 'synthsims' (same as QriptoScrollsTab)
 *
 * Status filter: ['published', 'archived'] (codex scope, matches scrolls route).
 * Falls back to an empty array on any DB error.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

const LIVE_STATUSES = ["published", "live", "active", "archived"];
const SELECT_COLS = "*";

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

function isSynthsims(r: Record<string, unknown>): boolean {
  const placement = (r.placement as Record<string, unknown> | null) ?? {};
  const tab = ((placement.tab as string) ?? "").toLowerCase();
  return tab === "synthsims" || tab.includes("synth");
}

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: [], total: 0, debug: "no_supabase" });
  }

  try {
    // Step 1: try issue-scoped query (same as section/scrolls route primary path)
    let { data, error } = await supabase
      .from("content")
      .select(SELECT_COLS)
      .contains("placement", { section: "scrolls", issue: "issue-1" })
      .in("status", LIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(60);

    const step1Count = data?.length ?? 0;

    // Step 2: fall back to unscoped if issue-scoped returns nothing
    if (!error && (!data || data.length === 0)) {
      const fallback = await supabase
        .from("content")
        .select(SELECT_COLS)
        .contains("placement", { section: "scrolls" })
        .in("status", LIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(60);

      data = fallback.data;
      error = fallback.error;
    }

    const step2Count = data?.length ?? 0;

    if (error) {
      console.error("[codex/knyt/terra] DB error:", error.message);
      return NextResponse.json({ ok: true, data: [], total: 0, debug: `db_error: ${error.message}` });
    }

    const rows = (data ?? []) as Record<string, unknown>[];

    // Mirror QriptoScrollsTab classification: exclude synthsims, rest is metaKnyts
    const metaKnyts = rows.filter((r) => !isSynthsims(r));
    const items = metaKnyts.map(mapRow);

    // Featured first, then newest
    items.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      ok: true,
      data: items,
      total: items.length,
      debug: { step1Count, step2Count, afterFilter: items.length },
    });
  } catch (err) {
    console.error("[codex/knyt/terra] unexpected error:", err);
    return NextResponse.json({ ok: true, data: [], total: 0, debug: "caught_error" });
  }
}
