/**
 * POST /api/skills/video/mux-audio — attach a voiceover track to ONE
 * generated (silent) video segment (Constitutional Video audio, 2026-07-19).
 *
 * The generated clips are silent. This route synthesizes the segment's
 * voiceover (services/audio/ttsSynthesis — Cartesia → OpenAI), pads/trims it
 * to the segment length honouring the G1 "breath" tail (afade out over the
 * final second), and muxes it onto the clip with `-c:v copy` (video untouched)
 * + uniform AAC. PER-SEGMENT by design: regenerating one segment (G6) only
 * re-voices that segment, and the audio-preserving stitch then concatenates
 * clips that all already carry a uniform AAC track.
 *
 * The music bed is out of scope for v1 (VO only); the filter graph is written
 * so a bed input can be amix'd in later without changing the contract.
 *
 * Request: { clip_url, voiceover_lines[], voice?, segment_index?,
 *            segment_seconds?, breath_seconds?, experience_id?, production_title? }
 * Response: { ok, video_url, provider, segment_index } | { ok:false, error }.
 *
 * Additive: existing silent clips are never touched; only the constitutional
 * video runner calls this. Spine-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getFfmpegPath } from '@/app/api/skills/video/_thumbnail';
import { synthesizeSpeech, type TtsVoice } from '@/services/audio/ttsSynthesis';
import { tierStudioArtifact } from '@/services/composer/studioArtifactTiering';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CLIP_BYTES = 60 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

const BUCKET_CANDIDATES = [
  process.env.SUPABASE_STORAGE_BUCKET,
  'content-assets',
  'assets',
  'codex-lite',
].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function uploadToSupabase(path: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');
  const errors: string[] = [];
  for (const bucket of BUCKET_CANDIDATES) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, body, {
        contentType,
        upsert: true,
        cacheControl: '86400',
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
  throw new Error(errors.join(' | ') || 'Failed to upload voiced video to Supabase');
}

async function downloadTo(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`clip fetch ${res.status} for ${url.slice(0, 80)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) throw new Error('empty clip body');
    if (buf.byteLength > MAX_CLIP_BYTES) throw new Error('clip exceeds size cap');
    await writeFile(destPath, buf);
  } finally {
    clearTimeout(timeout);
  }
}

function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`))));
    proc.on('error', reject);
  });
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let tmpDir: string | null = null;
  try {
    const body = await request.json().catch(() => null);
    const clipUrlRaw: unknown = body?.clip_url;
    const lines: unknown = body?.voiceover_lines;
    if (typeof clipUrlRaw !== 'string' || !clipUrlRaw.trim()) {
      return NextResponse.json({ ok: false, error: 'clip_url is required' }, { status: 400 });
    }
    if (!Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) {
      return NextResponse.json({ ok: false, error: 'voiceover_lines must be an array of strings' }, { status: 400 });
    }
    const clipUrl = clipUrlRaw.trim().startsWith('/')
      ? new URL(clipUrlRaw.trim(), request.nextUrl.origin).toString()
      : clipUrlRaw.trim();
    const voice = (typeof body?.voice === 'string' ? body.voice : 'nova') as TtsVoice;
    const segmentSeconds = typeof body?.segment_seconds === 'number' && body.segment_seconds > 0 ? Math.min(body.segment_seconds, 12) : 12;
    const breath = typeof body?.breath_seconds === 'number' && body.breath_seconds >= 0 ? Math.min(body.breath_seconds, 3) : 1;
    const segmentIndex = typeof body?.segment_index === 'number' ? body.segment_index : null;

    // Synthesize the voiceover. Pause between lines with a comma+space so the
    // TTS engine phrases them; the afade tail supplies the closing stillness.
    const voText = (lines as string[]).map((l) => l.trim()).filter(Boolean).join(', ');
    if (!voText) {
      // No voiceover for this segment — nothing to mux; the caller keeps the
      // silent clip. Honest no-op, not an error.
      return NextResponse.json({ ok: true, video_url: clipUrl, provider: null, muxed: false, segment_index: segmentIndex });
    }
    const synth = await synthesizeSpeech(voText, voice);
    if (!synth.ok || !synth.bytes) {
      return NextResponse.json({ ok: false, error: `tts_failed: ${synth.error ?? 'unknown'}` }, { status: 502 });
    }

    let ffmpegPath: string;
    try {
      ffmpegPath = await getFfmpegPath();
    } catch (e) {
      return NextResponse.json({ ok: false, error: `ffmpeg unavailable (${e instanceof Error ? e.message : String(e)})` }, { status: 500 });
    }

    tmpDir = await mkdtemp(join(tmpdir(), 'vid-mux-'));
    const clipPath = join(tmpDir, 'clip.mp4');
    const voPath = join(tmpDir, 'vo.mp3');
    const outPath = join(tmpDir, 'voiced.mp4');
    await downloadTo(clipUrl, clipPath);
    await writeFile(voPath, synth.bytes);

    // Audio graph: pad the VO to the segment length, trim exactly, then fade
    // out over the breath tail so the segment ends in stillness (G1). Video is
    // stream-copied (never re-encoded); audio is uniform AAC so the
    // audio-preserving stitch can concat all voiced segments cleanly.
    const fadeStart = Math.max(0, segmentSeconds - breath);
    const audioFilter = `[1:a]apad,atrim=0:${segmentSeconds},afade=t=out:st=${fadeStart}:d=${breath}[a]`;
    await runFfmpeg(ffmpegPath, [
      '-i', clipPath,
      '-i', voPath,
      '-filter_complex', audioFilter,
      '-map', '0:v:0',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-ar', '44100',
      '-movflags', '+faststart',
      '-y',
      outPath,
    ]);

    const voiced = await readFile(outPath);
    const voicedBuffer: ArrayBuffer = voiced.buffer.slice(
      voiced.byteOffset,
      voiced.byteOffset + voiced.byteLength,
    ) as ArrayBuffer;

    const muxId = createHash('sha256').update(`${clipUrl}|${voText}`).digest('hex').slice(0, 24);
    const storagePath = `generated/voiced/${muxId}.mp4`;
    const videoUrl = await uploadToSupabase(storagePath, voicedBuffer, 'video/mp4');

    // A voiced segment persisted to storage — operational multimedia.
    void tierStudioArtifact({
      kind: 'studio.video.voiceover.mux.completed',
      title: typeof body?.production_title === 'string' ? body.production_title : 'Voiced segment',
      outputs: [{ url: videoUrl, label: `voiced segment${segmentIndex != null ? ` ${segmentIndex + 1}` : ''}` }],
      generationId: muxId,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      video_url: videoUrl,
      provider: synth.provider ?? null,
      muxed: true,
      segment_index: segmentIndex,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mux-audio] Error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
