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
import { mkdtemp, writeFile, readFile, unlink, access, chmod, rename } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { gunzipSync } from "zlib";
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

// --- ffmpeg resolution -----------------------------------------------------
// The ffmpeg-static binary (~80MB) CANNOT be bundled into the Lambda: tracing
// it via outputFileTracingIncludes pushed the Amplify build output past the
// 220 MiB hard cap and broke all deploys (2026-07-05, reverted same day).
// Instead, the binary is fetched into /tmp on first use and cached for the
// container's lifetime. The download source is ffmpeg-static@5.3.0's OWN
// pinned release (read from its package.json `ffmpeg-static` config +
// install.js URL template — the same asset every `npm install` on the build
// machine already fetches), and honours the same env overrides the package
// defines: FFMPEG_BIN (direct path), FFMPEG_BINARIES_URL (mirror base),
// FFMPEG_BINARY_RELEASE (tag).

const FFMPEG_TMP_PATH = "/tmp/ffmpeg";
const FFMPEG_DOWNLOAD_TIMEOUT_MS = 45_000;

function ffmpegDownloadUrl(): string {
  const base = process.env.FFMPEG_BINARIES_URL || "https://github.com/eugeneware/ffmpeg-static/releases/download";
  const release = process.env.FFMPEG_BINARY_RELEASE || "b6.1.1";
  return `${base}/${release}/ffmpeg-${process.platform}-${process.arch}.gz`;
}

// Dedup concurrent downloads within one warm container.
let ffmpegDownloadInFlight: Promise<string> | null = null;

async function downloadFfmpegToTmp(): Promise<string> {
  if (!ffmpegDownloadInFlight) {
    ffmpegDownloadInFlight = (async () => {
      const url = ffmpegDownloadUrl();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FFMPEG_DOWNLOAD_TIMEOUT_MS);
      try {
        const res = await fetch(url, { redirect: "follow", signal: controller.signal });
        if (!res.ok) throw new Error(`ffmpeg download ${res.status} from ${url}`);
        const gz = Buffer.from(await res.arrayBuffer());
        const binary = gunzipSync(gz);
        // Write-then-rename so a concurrent reader never sees a partial binary.
        const partial = `${FFMPEG_TMP_PATH}.${process.pid}.partial`;
        await writeFile(partial, binary);
        await chmod(partial, 0o755);
        await rename(partial, FFMPEG_TMP_PATH);
        console.log(`[ffmpeg] downloaded ${Math.round(binary.byteLength / 1024 / 1024)}MB binary to ${FFMPEG_TMP_PATH}`);
        return FFMPEG_TMP_PATH;
      } finally {
        clearTimeout(timer);
      }
    })().catch((err) => {
      ffmpegDownloadInFlight = null; // allow retry on the next call
      throw err;
    });
  }
  return ffmpegDownloadInFlight;
}

export async function getFfmpegPath(): Promise<string> {
  // 1. Operator-provided path (ffmpeg-static's own env convention).
  const envPath = process.env.FFMPEG_BIN;
  if (envPath) {
    await access(envPath);
    return envPath;
  }
  // 2. Bundled ffmpeg-static binary (works locally / anywhere node_modules
  //    ships whole). Throws on require() if absent, access() if not downloaded.
  try {
    const p: string = require("ffmpeg-static");
    await access(p);
    return p;
  } catch {
    /* fall through to /tmp resolution */
  }
  // 3. Already fetched this container lifetime.
  try {
    await access(FFMPEG_TMP_PATH);
    return FFMPEG_TMP_PATH;
  } catch {
    /* fall through to download */
  }
  // 4. Cold fetch into /tmp.
  return downloadFfmpegToTmp();
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
  // adapter.upload expects Blob | ArrayBuffer | File — extract the underlying ArrayBuffer
  const data: ArrayBuffer = jpegBuffer.buffer.slice(
    jpegBuffer.byteOffset,
    jpegBuffer.byteOffset + jpegBuffer.byteLength,
  ) as ArrayBuffer;

  for (const bucket of THUMBNAIL_BUCKET_CANDIDATES) {
    try {
      const uploaded = await adapter.upload(bucket, path, data, {
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
          const uploaded = await adapter.upload(bucket, path, data, {
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
