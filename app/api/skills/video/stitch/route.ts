import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  getFfmpegPath,
  extractThumbnailFromBuffer,
  persistThumbnailAsset,
} from "@/app/api/skills/video/_thumbnail";

/**
 * POST /api/skills/video/stitch
 *
 * Concatenates 2–3 already-generated video clips into a single longer clip.
 * Since Sora and Venice (incl. Wan) each cap a single generation at 12s, this
 * is the path to longer videos: generate N ≤ 12s clips, then stitch them here
 * into one file up to ~24s (2×12) or ~36s (3×12).
 *
 * The clips are downloaded from the same proxy URLs the player already holds
 * (Sora → Supabase 302, Venice → streamed from /retrieve), concatenated with
 * ffmpeg (stream-copy when the encodings match, re-encode fallback otherwise),
 * uploaded to Supabase, and returned as a single public URL.
 *
 * Request body:
 * {
 *   clips: string[],          // 2–3 clip URLs, in play order
 *   experience_id?: string,
 *   tenant_id?: string,
 * }
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CLIPS = 3;
const MIN_CLIPS = 2;
const MAX_CLIP_BYTES = 60 * 1024 * 1024; // 60 MB per clip — a 12s 720p clip is well under this
const DOWNLOAD_TIMEOUT_MS = 30_000;

const BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function uploadToSupabase(path: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");
  const errors: string[] = [];
  for (const bucket of BUCKET_CANDIDATES) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, body, {
        contentType,
        upsert: true,
        cacheControl: "86400",
      });
      if (error && !/already exists/i.test(error.message) && !/duplicate/i.test(error.message)) {
        errors.push(`${bucket}: ${error.message}`);
        continue;
      }
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } catch (e) {
      errors.push(`${bucket}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join(" | ") || "Failed to upload stitched video to Supabase");
}

async function downloadClip(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store", signal: controller.signal });
    if (!res.ok) {
      throw new Error(`clip fetch ${res.status} for ${url.slice(0, 80)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) throw new Error(`empty clip body for ${url.slice(0, 80)}`);
    if (buf.byteLength > MAX_CLIP_BYTES) {
      throw new Error(`clip exceeds ${Math.round(MAX_CLIP_BYTES / 1024 / 1024)}MB cap`);
    }
    await writeFile(destPath, buf);
  } finally {
    clearTimeout(timeout);
  }
}

function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", reject);
  });
}

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;
  try {
    const body = await request.json().catch(() => null);
    const clips: unknown = body?.clips;
    const experienceId: string | null =
      typeof body?.experience_id === "string" ? body.experience_id : null;

    if (!Array.isArray(clips) || clips.some((c) => typeof c !== "string" || !c.trim())) {
      return NextResponse.json(
        { ok: false, error: "clips must be an array of non-empty URL strings" },
        { status: 400 },
      );
    }
    const clipUrls = (clips as string[]).map((c) => c.trim());
    if (clipUrls.length < MIN_CLIPS || clipUrls.length > MAX_CLIPS) {
      return NextResponse.json(
        { ok: false, error: `provide between ${MIN_CLIPS} and ${MAX_CLIPS} clips` },
        { status: 400 },
      );
    }

    let ffmpegPath: string;
    try {
      ffmpegPath = await getFfmpegPath();
    } catch {
      return NextResponse.json(
        { ok: false, error: "ffmpeg binary unavailable — cannot stitch clips" },
        { status: 500 },
      );
    }

    tmpDir = await mkdtemp(join(tmpdir(), "vid-stitch-"));

    // Download each clip in order.
    const localPaths: string[] = [];
    for (let i = 0; i < clipUrls.length; i += 1) {
      const p = join(tmpDir, `clip${i}.mp4`);
      await downloadClip(clipUrls[i], p);
      localPaths.push(p);
    }

    // ffmpeg concat demuxer needs a list file. Paths are quoted to survive spaces.
    const listPath = join(tmpDir, "list.txt");
    await writeFile(listPath, localPaths.map((p) => `file '${p}'`).join("\n"));

    const outputPath = join(tmpDir, "stitched.mp4");

    // Primary: stream-copy (no re-encode). Works when the clips share codec +
    // timebase — true for clips from the same provider/model/resolution.
    try {
      await runFfmpeg(ffmpegPath, [
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
        "-movflags", "+faststart",
        "-y",
        outputPath,
      ]);
    } catch (copyErr) {
      // Fallback: re-encode into a uniform H.264 stream. AI clips are silent,
      // so we drop audio (-an) to avoid concat failures on missing audio tracks.
      console.warn(
        "[VideoStitch] stream-copy concat failed, re-encoding:",
        copyErr instanceof Error ? copyErr.message : copyErr,
      );
      await runFfmpeg(ffmpegPath, [
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-an",
        "-movflags", "+faststart",
        "-y",
        outputPath,
      ]);
    }

    const stitched = await readFile(outputPath);
    const stitchedBuffer: ArrayBuffer = stitched.buffer.slice(
      stitched.byteOffset,
      stitched.byteOffset + stitched.byteLength,
    ) as ArrayBuffer;

    // Deterministic id from the ordered source URLs so re-stitching the same
    // clips is idempotent (upsert to the same path).
    const stitchId = createHash("sha256")
      .update(clipUrls.join("|"))
      .digest("hex")
      .slice(0, 24);
    const storagePath = `generated/stitched/${stitchId}.mp4`;

    const videoUrl = await uploadToSupabase(storagePath, stitchedBuffer, "video/mp4");

    // Thumbnail — awaited so we can return it (one-frame extraction is ~1s,
    // well within maxDuration). Returning it lets the player set a <video>
    // poster and persist the companion thumbnail the thin client reads. Any
    // failure is swallowed so it never blocks the stitched video.
    let thumbnailUrl: string | null = null;
    try {
      const thumb = await extractThumbnailFromBuffer(stitched, stitchId);
      if (thumb) thumbnailUrl = await persistThumbnailAsset(thumb, stitchId, "stitched");
    } catch {
      thumbnailUrl = null;
    }

    return NextResponse.json({
      ok: true,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl || undefined,
      stitch_id: stitchId,
      segments: clipUrls.length,
      experience_id: experienceId || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[VideoStitch] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
