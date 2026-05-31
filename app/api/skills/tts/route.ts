/**
 * POST /api/skills/tts
 *
 * Speech synthesis for the copilot inference playback (ListenButton,
 * useTTSPlayer). Provider chain:
 *
 *   1. Cartesia (api.cartesia.ai/tts/bytes, Sonic English) — primary.
 *      Voice + model match the VAPI/Marketa wiring in
 *      app/components/codex/CodexCopilotLayer.tsx so the copilot voice
 *      is the same one the rest of the platform uses. Requires
 *      CARTESIA_API_KEY (already in Amplify env for the VAPI surface).
 *   2. OpenAI tts-1 — fallback when Cartesia is unavailable / quota /
 *      misconfigured. Same MP3 wire format so the client doesn't care
 *      which provider served the bytes.
 *
 * Body: { text: string; voice?: string }. `voice` is the OpenAI
 * voice id (nova / alloy / echo / fable / onyx / shimmer); Cartesia
 * uses its own voice ids (see CARTESIA_VOICE_ID).
 *
 * Response: audio/mpeg bytes (mp3) OR JSON { error } with 4xx/5xx.
 */

import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_VERSION = process.env.CARTESIA_VERSION || "2024-11-13";
// Matches the voice used by ComposerStudio + CodexCopilotLayer (Marketa
// voice). Override per-deployment via env if you want a different voice.
const CARTESIA_VOICE_ID =
  process.env.CARTESIA_VOICE_ID || "694f9389-aac1-45b6-b726-9d9369183238";
const CARTESIA_MODEL = process.env.CARTESIA_MODEL || "sonic-english";

interface SynthResult {
  ok: boolean;
  bytes?: Buffer;
  error?: string;
}

async function synthCartesia(text: string): Promise<SynthResult> {
  if (!CARTESIA_API_KEY) {
    return { ok: false, error: "cartesia-not-configured" };
  }
  // Lambda's hard exec budget is 30s. Cap Cartesia at 8s so we always
  // have ~20s left to try the OpenAI fallback before API Gateway
  // returns 504. Without this the fetch can hang indefinitely on
  // upstream network issues (TCP connect / TLS handshake / slow
  // response body) and eat the whole budget — that's what produced the
  // 504 the operator saw on 2026-05-29.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": CARTESIA_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: CARTESIA_MODEL,
        transcript: text,
        voice: { mode: "id", id: CARTESIA_VOICE_ID },
        output_format: {
          container: "mp3",
          encoding: "mp3",
          sample_rate: 44100,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[skills/tts] Cartesia returned ${res.status}: ${detail.slice(0, 200)}`,
      );
      return { ok: false, error: `cartesia-${res.status}: ${detail.slice(0, 200)}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, bytes: buf };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[skills/tts] Cartesia call failed: ${msg}`);
    return { ok: false, error: msg.includes("aborted") ? "cartesia-timeout-8s" : msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function synthOpenAi(text: string, voice: string): Promise<SynthResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "openai-not-configured" };
  }
  try {
    // Cartesia gets 8s of the Lambda budget (see synthCartesia); keep
    // OpenAI under 18s so the whole route returns inside Lambda's 30s
    // limit with margin for response serialization.
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 18_000,
    });
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as "nova" | "alloy" | "echo" | "fable" | "onyx" | "shimmer",
      input: text.slice(0, 950),
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return { ok: true, bytes: buffer };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[skills/tts] OpenAI tts-1 failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

export async function POST(req: NextRequest) {
  const { text, voice = "nova" } = (await req.json()) as { text?: string; voice?: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (!CARTESIA_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "no-tts-provider-configured" }, { status: 503 });
  }

  const trimmed = text.slice(0, 950);

  // Primary: Cartesia (Sonic English). Secondary: OpenAI tts-1.
  const primary = await synthCartesia(trimmed);
  if (primary.ok && primary.bytes) {
    return new NextResponse(primary.bytes, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(primary.bytes.length),
        "X-TTS-Provider": "cartesia",
      },
    });
  }

  const fallback = await synthOpenAi(trimmed, voice);
  if (fallback.ok && fallback.bytes) {
    return new NextResponse(fallback.bytes, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(fallback.bytes.length),
        "X-TTS-Provider": "openai",
        // Diagnostic: surface why Cartesia fell through so the operator
        // can DevTools the /api/skills/tts response and see the actual
        // failure reason (auth, model, version mismatch, quota, etc.)
        // without needing CloudWatch access.
        "X-TTS-Cartesia-Error": (primary.error ?? "unknown").slice(0, 200),
      },
    });
  }

  const combined = `${primary.error ?? ""} | ${fallback.error ?? ""}`.toLowerCase();
  const isQuota = combined.includes("quota") || combined.includes("429");
  return NextResponse.json(
    {
      error: isQuota ? "tts-providers-quota-exhausted" : "tts-failed",
      detail: combined.trim(),
      cartesia: primary.error ?? null,
      openai: fallback.error ?? null,
    },
    { status: isQuota ? 503 : 500 },
  );
}
