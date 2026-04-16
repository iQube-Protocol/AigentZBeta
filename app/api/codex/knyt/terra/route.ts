/**
 * GET /api/codex/knyt/terra
 *
 * Returns ALL metaKNYT-related content from across the entire Qriptopian cartridge.
 * Four parallel streams merged and deduplicated by id:
 *
 *   A. All scrolls content that is not synthsims (core metaKnyts feed)
 *   B. Any section with placement.tab = 'metaknyts' (explicit editorial tag)
 *   C. Title sweep: title contains 'knyt', 'metaknyt', 'meta-knyt', 'qriptographic'
 *      (catches latest-news, home-hero, knowdz etc. not placement-tagged)
 *   D. Tags overlap: content tagged knyt/metaknyt/knyts in any section
 *
 * Synthsims items from stream A are filtered. All other streams include
 * content from any section of the Qriptopian.
 *
 * Status filter: published + live + active + archived (full codex scope).
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
    // All four streams run in parallel
    const [issueScoped, metaknytsAll, titleSweep, tagsSweep] = await Promise.all([
      // A1: scrolls with issue placement (matches QriptoScrollsTab primary path)
      runQuery(supabase, { section: "scrolls", issue: "issue-1" }),
      // B: any section explicitly tagged tab=metaknyts
      runQuery(supabase, { tab: "metaknyts" }),
      // C: title sweep — catches latest-news/hero/knowdz items with KNYT in title
      supabase
        .from("content")
        .select("*")
        .or("title.ilike.%metaknyt%,title.ilike.%meta-knyt%,title.ilike.%knyt%,title.ilike.%qriptographic%")
        .in("status", LIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(60),
      // D: tags overlap — any section tagged knyt/metaknyt/knyts
      supabase
        .from("content")
        .select("*")
        .overlaps("tags", ["knyt", "metaknyt", "knyts", "metaknyts", "meta-knyt"])
        .in("status", LIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    // Stream A: issue-scoped scrolls, fallback to unscoped
    let scrollsRows: Record<string, unknown>[] = [];
    if (!issueScoped.error && issueScoped.data && issueScoped.data.length > 0) {
      scrollsRows = issueScoped.data as Record<string, unknown>[];
    } else {
      const unscoped = await runQuery(supabase, { section: "scrolls" });
      if (!unscoped.error) {
        scrollsRows = (unscoped.data ?? []) as Record<string, unknown>[];
      }
    }

    const metaknytsRows = (!metaknytsAll.error ? (metaknytsAll.data ?? []) : []) as Record<string, unknown>[];
    const titleRows     = (!titleSweep.error   ? (titleSweep.data   ?? []) : []) as Record<string, unknown>[];
    const tagsRows      = (!tagsSweep.error    ? (tagsSweep.data    ?? []) : []) as Record<string, unknown>[];

    // Merge all four, deduplicate by id; exclude synthsims from scrolls stream
    const seen = new Set<string>();
    const merged: Record<string, unknown>[] = [];
    const scrollsSet = new Set(scrollsRows.map((r) => r.id as string));

    for (const row of [...scrollsRows, ...metaknytsRows, ...titleRows, ...tagsRows]) {
      const id = row.id as string;
      if (seen.has(id)) continue;
      seen.add(id);
      if (scrollsSet.has(id) && isSynthsims(row)) continue;
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
        metaknytsTabCount: metaknytsRows.length,
        titleSweepCount: titleRows.length,
        tagsSweepCount: tagsRows.length,
        mergedTotal: items.length,
      },
    });
  } catch (err) {
    console.error("[codex/knyt/terra] unexpected error:", err);
    return NextResponse.json({ ok: true, data: [], total: 0, debug: "caught_error" });
  }
}
