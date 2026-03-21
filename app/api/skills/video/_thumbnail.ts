/**
 * Server-side video thumbnail extraction.
 *
 * Extracts a JPEG frame at 00:00:01 from a video buffer using ffmpeg-static,
 * then persists it to Supabase storage. Returns the public thumbnail URL or
 * null if ffmpeg is unavailable or extraction fails.
 *
 * Called from both Sora and Venice status routes at the moment a video
 * generation job is detected as completed.
 */

import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, unlink, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { StorageAdapterFactory } from "@/services/content/storageAdapter";
import { createClient } from "@supabase/supabase-js";

const THUMBNAIL_BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  "content-assets",
  "assets",
  "codex-lite",
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

let cachedAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cachedAdmin = createClient(url, key);
  return cachedAdmin;
}

async function ensureBucket(bucket: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: "10MB",
  });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

async function getFfmpegPath(): Promise<string> {
  // ffmpeg-static ships a pre-compiled binary at this path.
  // Will throw on require() if the package isn't installed.
  // Will throw on access() if binary wasn't downloaded (e.g. proxy issues in dev).
  const p: string = require("ffmpeg-static");
  await access(p); // throws if file missing
  return p;
}

/**
 * Extracts a JPEG thumbnail at 00:00:01 from the given video buffer.
 * Returns the raw JPEG bytes or null if extraction fails.
 */
export async function extractThumbnailFromBuffer(
  videoBuffer: Buffer,
  id: string,
): Promise<Buffer | null> {
  let ffmpegPath: string;
  try {
    ffmpegPath = await getFfmpegPath();
  } catch {
    // ffmpeg binary not available — skip thumbnail extraction gracefully
    return null;
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "vid-thumb-")).catch(() => null);
  if (!tmpDir) return null;

  const inputPath = join(tmpDir, `${id}.mp4`);
  const outputPath = join(tmpDir, `${id}-thumb.jpg`);

  try {
    await writeFile(inputPath, videoBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        "-ss", "00:00:01",
        "-i", inputPath,
        "-frames:v", "1",
        "-q:v", "3",       // quality 2-5, lower = better
        "-f", "image2",
        "-y",
        outputPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`));
      });
      proc.on("error", reject);
    });

    return await readFile(outputPath);
  } catch (err) {
    console.warn("[VideoThumb] extraction failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}

/**
 * Extracts a thumbnail from the first `rangeBytes` bytes of a remote video URL,
 * useful for Venice where we have a URL but not the full buffer.
 */
export async function extractThumbnailFromUrl(
  videoUrl: string,
  id: string,
  rangeBytes = 4_194_304, // 4 MB — enough for ffmpeg to seek to 1 s in most formats
): Promise<Buffer | null> {
  try {
    const res = await fetch(videoUrl, {
      headers: { Range: `bytes=0-${rangeBytes - 1}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok && res.status !== 206) return null;
    const partial = Buffer.from(await res.arrayBuffer());
    return extractThumbnailFromBuffer(partial, id);
  } catch {
    return null;
  }
}

/**
 * Persists a JPEG thumbnail buffer to Supabase storage.
 * Returns the public URL or null on failure.
 */
export async function persistThumbnailAsset(
  jpegBuffer: Buffer,
  id: string,
  namespace = "openai",
): Promise<string | null> {
  const adapter = StorageAdapterFactory.getAdapter("supabase");
  const path = `generated/${namespace}/thumbnails/${id}-thumb.jpg`;

  for (const bucket of THUMBNAIL_BUCKET_CANDIDATES) {
    try {
      const uploaded = await adapter.upload(bucket, path, jpegBuffer, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      });
      return uploaded.publicUrl || adapter.getPublicUrl(bucket, path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/bucket not found/i.test(msg)) {
        try {
          await ensureBucket(bucket);
          const uploaded = await adapter.upload(bucket, path, jpegBuffer, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
          return uploaded.publicUrl || adapter.getPublicUrl(bucket, path);
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}
