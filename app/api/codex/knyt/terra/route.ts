/**
 * GET /api/codex/knyt/terra
 *
 * Returns all metaKNYT-related Qriptopian content for the KNYT Terra tab.
 *
 * Content is fetched from two parallel streams and merged (deduplicated by id):
 *   A. All scrolls content that is not synthsims (mirrors QriptoScrollsTab metaKnyts logic)
 *   B. Content in ANY section whose placement.tab = 'metaknyts' (catches hero, knowdz, news, etc.)
 *
 * Status filter: published + archived (codex scope).
 * Falls back to an empty array on any DB error.
 */

import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

const LIVE_STATUSES = ["published", "live", "active", "archived"];

export interface TerraItem {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  type: string;
  featured: boolean;
  coverImageUrl?: string;
  socialUrl?: string;
  videoUrl?: string;
  hasWatch: boolean;
  hasRead: boolean;
  hasListen: boolean;
  section: string;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): TerraItem {
  const placement = (r.placement as Record<string, unknown> | null) ?? {};
  const modalities = (r.modalities as Record<string, unknown> | null) ?? {};
  const readMod   = (modalities.read   as Record<string, unknown> | null) ?? {};
  const watchMod  = (modalities.watch  as Record<string, unknown> | null) ?? {};
  const listenMod = (modalities.listen as Record<string, unknown> | null) ?? {};
  const linkMod   = (modalities.link   as Record<string, unknown> | null) ?? {};

  const coverImageUrl =
    (r.thumbnail ?? r.image) as string | undefined;

  const socialUrl = (linkMod.url ?? readMod.url) as string | undefined;
  const videoUrl  = (watchMod.video_url ?? watchMod.url) as string | undefined;

  return {
    id:          r.id as string,
    title:       r.title as string,
    description: (r.excerpt as string | null) ?? undefined,
    tags:        (r.tags as string[] | null) ?? [],
    type:        (r.format ?? r.type ?? "article") as string,
    featured:    (placement.position as number | null) === 1,
    coverImageUrl,
    socialUrl,
    videoUrl,
    hasWatch:  Boolean(watchMod.video_url ?? watchMod.url),
    hasRead:   Boolean(readMod.text ?? readMod.url),
    hasListen: Boolean(listenMod.audio_url),
    section:   (placement.section as string) ?? "scrolls",
    createdAt: r.created_at as string,
  };
}

function isSynthsims(r: Record<string, unknown>): boolean {
  const placement = (r.placement as Record<string, unknown> | null) ?? {};
  const tab = ((placement.tab as string) ?? "").toLowerCase();
  return tab === "synthsims" || tab.includes("synth");
}

async function runQuery(
  supabase: SupabaseClient,
  placement: Record<string, unknown>
) {
  return supabase!
    .from("content")
    .select("*")
    .contains("placement", placement)
    .in("status", LIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(60);
}

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: true, data: [], total: 0, debug: "no_supabase" });
  }

  try {
    // Stream A: All scrolls content — try issue-scoped, fall back to unscoped
    const [issueScoped, metaknytsAll] = await Promise.all([
      // A1: scrolls with issue placement (matches QriptoScrollsTab primary path)
      runQuery(supabase, { section: "scrolls", issue: "issue-1" }),
      // B: any section with tab=metaknyts (catches hero, knowdz, news drawers)
      runQuery(supabase, { tab: "metaknyts" }),
    ]);

    let scrollsRows: Record<string, unknown>[] = [];

    if (!issueScoped.error && issueScoped.data && issueScoped.data.length > 0) {
      scrollsRows = issueScoped.data as Record<string, unknown>[];
    } else {
      // A2: fall back to unscoped scrolls
      const unscoped = await runQuery(supabase, { section: "scrolls" });
      if (!unscoped.error) {
        scrollsRows = (unscoped.data ?? []) as Record<string, unknown>[];
      }
    }

    const metaknytsRows = (!metaknytsAll.error ? (metaknytsAll.data ?? []) : []) as Record<string, unknown>[];

    // Merge streams, deduplicate by id
    const seen = new Set<string>();
    const merged: Record<string, unknown>[] = [];

    for (const row of [...scrollsRows, ...metaknytsRows]) {
      const id = row.id as string;
      if (seen.has(id)) continue;
      seen.add(id);
      // Stream A: filter out synthsims (stream B already targeted metaknyts only)
      if (scrollsRows.includes(row) && isSynthsims(row)) continue;
      merged.push(row);
    }

    const items = merged.map(mapRow);

    // Featured first, then newest
    items.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      ok: true,
      data: items,
      total: items.length,
      debug: {
        scrollsCount: scrollsRows.length,
        metaknytsAllCount: metaknytsRows.length,
        mergedTotal: items.length,
      },
    });
  } catch (err) {
    console.error("[codex/knyt/terra] unexpected error:", err);
    return NextResponse.json({ ok: true, data: [], total: 0, debug: "caught_error" });
  }
}
