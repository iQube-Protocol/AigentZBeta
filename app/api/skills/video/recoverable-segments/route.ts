/**
 * GET /api/skills/video/recoverable-segments — admin-gated recovery listing.
 *
 * When a multi-segment run generates its clips but the stitch pass fails
 * (e.g. the 2026-07-05 "ffmpeg binary unavailable" incident), the generated
 * segments are NOT lost — they are just orphaned:
 *
 *   - Sora clips persist to Supabase storage at generated/openai/videos/<id>.mp4
 *     (uploaded by the status/proxy routes on completion) — recoverable as
 *     absolute public URLs.
 *   - Venice clips stay retrievable from Venice's /retrieve by queueId; the
 *     queueIds are recoverable from the persisted companion thumbnails at
 *     generated/venice/thumbnails/<queueId>-thumb.jpg — recoverable as proxy
 *     URLs (/api/skills/video/venice/<queueId>), which the stitch route now
 *     resolves against its own origin.
 *
 * This route lists both sets, newest first, so the operator can re-stitch
 * already-paid-for segments instead of regenerating them.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActivePersona } from "@/services/identity/getActivePersona";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 60;

const BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

interface RecoverableSegment {
  kind: "sora" | "venice";
  /** Storage object name (sora: <id>.mp4; venice: <queueId>-thumb.jpg). */
  name: string;
  /** Clip URL to feed the stitch route. Venice entries are proxy paths. */
  clipUrl: string;
  thumbnailUrl: string | null;
  createdAt: string | null;
  sizeBytes: number | null;
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }
  const supabase = createClient(url, key);

  const segments: RecoverableSegment[] = [];
  const errors: string[] = [];
  const veniceIdsWithVideo = new Set<string>();

  for (const bucket of BUCKET_CANDIDATES) {
    // Sora — the completed videos themselves.
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("generated/openai/videos", {
          limit: MAX_ITEMS,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (error) throw error;
      for (const f of data ?? []) {
        if (!f.name.endsWith(".mp4")) continue;
        const path = `generated/openai/videos/${f.name}`;
        const videoId = f.name.replace(/\.mp4$/, "");
        segments.push({
          kind: "sora",
          name: f.name,
          clipUrl: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
          thumbnailUrl: supabase.storage
            .from(bucket)
            .getPublicUrl(`generated/openai/thumbnails/${videoId}-thumb.jpg`).data.publicUrl,
          createdAt: f.created_at ?? null,
          sizeBytes: (f.metadata as { size?: number } | null)?.size ?? null,
        });
      }
    } catch (e) {
      errors.push(`${bucket}/openai: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Venice — persisted full videos (written by the status route on
    // completion detection since 2026-07-05).
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("generated/venice/videos", {
          limit: MAX_ITEMS,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (error) throw error;
      for (const f of data ?? []) {
        if (!f.name.endsWith(".mp4")) continue;
        const path = `generated/venice/videos/${f.name}`;
        const queueId = f.name.replace(/\.mp4$/, "");
        veniceIdsWithVideo.add(queueId);
        segments.push({
          kind: "venice",
          name: f.name,
          clipUrl: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
          thumbnailUrl: supabase.storage
            .from(bucket)
            .getPublicUrl(`generated/venice/thumbnails/${queueId}-thumb.jpg`).data.publicUrl,
          createdAt: f.created_at ?? null,
          sizeBytes: (f.metadata as { size?: number } | null)?.size ?? null,
        });
      }
    } catch (e) {
      errors.push(`${bucket}/venice-videos: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Venice — queueIds recovered from the persisted companion thumbnails
    // (legacy path for clips completed before full-video persistence landed).
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("generated/venice/thumbnails", {
          limit: MAX_ITEMS,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (error) throw error;
      for (const f of data ?? []) {
        const match = f.name.match(/^(.+)-thumb\.jpg$/);
        if (!match) continue;
        const queueId = match[1];
        if (veniceIdsWithVideo.has(queueId)) continue; // persisted copy already listed
        segments.push({
          kind: "venice",
          name: f.name,
          clipUrl: `/api/skills/video/venice/${encodeURIComponent(queueId)}`,
          thumbnailUrl: supabase.storage
            .from(bucket)
            .getPublicUrl(`generated/venice/thumbnails/${f.name}`).data.publicUrl,
          createdAt: f.created_at ?? null,
          sizeBytes: null,
        });
      }
    } catch (e) {
      errors.push(`${bucket}/venice: ${e instanceof Error ? e.message : String(e)}`);
    }

    // First bucket that yielded anything wins — the candidates are fallbacks
    // for env differences, not parallel stores.
    if (segments.length > 0) break;
  }

  segments.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({
    ok: true,
    segments: segments.slice(0, MAX_ITEMS),
    ...(segments.length === 0 && errors.length > 0 ? { detail: errors.join(" | ") } : {}),
  });
}
