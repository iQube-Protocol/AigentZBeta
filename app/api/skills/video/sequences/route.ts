/**
 * /api/skills/video/sequences — video sequence manifests.
 *
 * A "sequence" is a multi-segment generation run: N clips that belong
 * together IN A FIXED PLAY ORDER, destined to be stitched into one film.
 * Before this route existed, that membership lived only in the browser's
 * component state — a failed stitch (or a closed tab) orphaned the clips
 * into an undifferentiated pile of storage objects with no record of which
 * run they belonged to or what order they played in (the 2026-07-05 EXP-002
 * recovery incident: two runs' Venice clips became untraceable).
 *
 * POST — called by SkillVideoPlayer at submit time, BEFORE any generation
 *        completes: writes a JSON manifest to storage recording the ordered
 *        segment generation ids. Whatever happens afterwards (stitch failure,
 *        tab close, gateway timeout), the sequence is recoverable.
 * GET  — admin-gated: lists manifests newest-first with per-segment clip
 *        URLs resolved (persisted storage URL when available, provider proxy
 *        path otherwise), ready to feed the stitcher in recorded order.
 *
 * The recorded order is constitutionally meaningful: stitching honours the
 * manifest's segment order — Constitutional Sequencing (Law XV corollary)
 * applied to the recovery path, not just the render path.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActivePersona } from "@/services/identity/getActivePersona";

export const dynamic = "force-dynamic";

const MAX_SEQUENCES = 30;
const MAX_SEGMENTS = 6;

const BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

interface SequenceSegment {
  index: number;
  provider: "openai" | "venice";
  generationId: string;
  prompt?: string;
}

interface SequenceManifest {
  sequenceId: string;
  createdAt: string;
  skillId: string;
  provider: "openai" | "venice";
  veniceModel: string | null;
  title: string | null;
  segments: SequenceSegment[];
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function publicUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/** Persisted-copy path for a segment (written by the proxy/status routes). */
function persistedPath(seg: SequenceSegment): string {
  return seg.provider === "venice"
    ? `generated/venice/videos/${seg.generationId}.mp4`
    : `generated/openai/videos/${seg.generationId}.mp4`;
}

/** Provider proxy path — works while the provider still retains the asset. */
function proxyPath(seg: SequenceSegment, veniceModel: string | null): string {
  return seg.provider === "venice"
    ? `/api/skills/video/venice/${encodeURIComponent(seg.generationId)}${veniceModel ? `?model=${encodeURIComponent(veniceModel)}` : ""}`
    : `/api/skills/video/${encodeURIComponent(seg.generationId)}`;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const sequenceId: unknown = body?.sequence_id;
  const skillId: unknown = body?.skill_id;
  const provider: unknown = body?.provider;
  const segments: unknown = body?.segments;

  if (typeof sequenceId !== "string" || !/^[a-z0-9][a-z0-9-]{5,63}$/.test(sequenceId)) {
    return NextResponse.json({ ok: false, error: "sequence_id must be 6-64 chars of [a-z0-9-]" }, { status: 400 });
  }
  if (typeof skillId !== "string" || !skillId.trim()) {
    return NextResponse.json({ ok: false, error: "skill_id required" }, { status: 400 });
  }
  if (provider !== "openai" && provider !== "venice") {
    return NextResponse.json({ ok: false, error: "provider must be openai|venice" }, { status: 400 });
  }
  if (
    !Array.isArray(segments) ||
    segments.length < 2 ||
    segments.length > MAX_SEGMENTS ||
    segments.some(
      (s) =>
        typeof s?.index !== "number" ||
        typeof s?.generation_id !== "string" ||
        !s.generation_id.trim() ||
        (s.provider !== "openai" && s.provider !== "venice"),
    )
  ) {
    return NextResponse.json(
      { ok: false, error: `segments must be 2-${MAX_SEGMENTS} entries of {index, provider, generation_id}` },
      { status: 400 },
    );
  }

  const manifest: SequenceManifest = {
    sequenceId,
    createdAt: new Date().toISOString(),
    skillId,
    provider,
    veniceModel: typeof body?.venice_model === "string" && body.venice_model ? body.venice_model : null,
    title: typeof body?.title === "string" && body.title ? body.title.slice(0, 120) : null,
    segments: (segments as Array<Record<string, unknown>>)
      .map((s) => ({
        index: s.index as number,
        provider: s.provider as "openai" | "venice",
        generationId: (s.generation_id as string).trim(),
        ...(typeof s.prompt === "string" ? { prompt: s.prompt.slice(0, 300) } : {}),
      }))
      .sort((a, b) => a.index - b.index),
  };

  const path = `generated/sequences/${sequenceId}.json`;
  const payload = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const errors: string[] = [];
  for (const bucket of BUCKET_CANDIDATES) {
    const { error } = await supabase.storage.from(bucket).upload(path, payload, {
      contentType: "application/json",
      upsert: true,
    });
    if (!error || /already exists|duplicate/i.test(error.message)) {
      return NextResponse.json({ ok: true, sequence_id: sequenceId });
    }
    errors.push(`${bucket}: ${error.message}`);
  }
  return NextResponse.json({ ok: false, error: errors.join(" | ") }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) as string;

  for (const bucket of BUCKET_CANDIDATES) {
    const { data: files, error } = await supabase.storage.from(bucket).list("generated/sequences", {
      limit: MAX_SEQUENCES,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !files || files.length === 0) continue;

    const sequences = [];
    for (const f of files) {
      if (!f.name.endsWith(".json")) continue;
      const { data: blob } = await supabase.storage.from(bucket).download(`generated/sequences/${f.name}`);
      if (!blob) continue;
      let manifest: SequenceManifest;
      try {
        manifest = JSON.parse(await blob.text()) as SequenceManifest;
      } catch {
        continue;
      }

      // Resolve each segment: persisted storage copy wins (survives provider
      // expiry); provider proxy path is the fallback.
      const segments = await Promise.all(
        manifest.segments.map(async (seg) => {
          const persisted = persistedPath(seg);
          const persistedUrl = publicUrl(supabaseUrl, bucket, persisted);
          let clipUrl = proxyPath(seg, manifest.veniceModel);
          let persistedCopy = false;
          try {
            const head = await fetch(persistedUrl, { method: "HEAD", cache: "no-store" });
            if (head.ok) {
              clipUrl = persistedUrl;
              persistedCopy = true;
            }
          } catch {
            /* keep proxy path */
          }
          return { ...seg, clipUrl, persistedCopy };
        }),
      );

      sequences.push({ ...manifest, segments });
    }
    return NextResponse.json({ ok: true, sequences });
  }
  return NextResponse.json({ ok: true, sequences: [] });
}
