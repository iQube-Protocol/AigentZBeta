/**
 * POST /api/skills/stt
 *
 * Whisper-backed speech-to-text fallback for browsers that don't expose
 * a working Web Speech API (Brave Shields blocks the Chromium native
 * impl; iOS Safari has spotty support; Firefox has none).
 *
 * Body: multipart/form-data with an `audio` blob (webm/ogg/mp4).
 * Optional `lang` field hints Whisper at the language (ISO-639-1).
 *
 * Auth: requires an authenticated persona via the spine — Whisper calls
 * cost real money so we don't expose the endpoint anonymously. Mirrors
 * /api/wallet/* gating semantics.
 *
 * Provider chain (mirrors llmDraftHelper's tiering):
 *   1. OpenAI Whisper-1 (primary; paid account)
 *   2. Groq Whisper-large-v3 (free-tier fallback; same Whisper family,
 *      OpenAI-compatible endpoint at api.groq.com/openai/v1/)
 *   3. surface a 503 with the upstream failure reason so the FE can
 *      tell the operator the mic is offline
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getActivePersona } from "@/services/identity/getActivePersona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB cap matches Whisper-friendly clip sizes

interface TranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
  status?: number;
}

async function transcribeOpenAi(file: File, lang?: string): Promise<TranscribeResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "openai-not-configured", status: 503 };
  }
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 22_000,
    });
    const result = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      ...(lang ? { language: lang } : {}),
    });
    return { ok: true, text: result.text ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[skills/stt] openai whisper failed:", msg);
    return { ok: false, error: msg };
  }
}

async function transcribeGroq(file: File, lang?: string): Promise<TranscribeResult> {
  if (!process.env.GROQ_API_KEY) {
    return { ok: false, error: "groq-not-configured", status: 503 };
  }
  try {
    // Groq exposes an OpenAI-compatible audio/transcriptions endpoint, so we
    // can use the OpenAI SDK with a baseURL override. whisper-large-v3 is
    // the same Whisper family OpenAI runs — quality parity, not the lossy
    // Llama-on-Venice tradeoff we accept for chat drafts.
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      maxRetries: 0,
      timeout: 22_000,
    });
    const result = await groq.audio.transcriptions.create({
      model: "whisper-large-v3",
      file,
      ...(lang ? { language: lang } : {}),
    });
    return { ok: true, text: result.text ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[skills/stt] groq whisper failed:", msg);
    return { ok: false, error: msg };
  }
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Require at least one provider configured. Groq alone is enough since
  // it serves the same Whisper family.
  if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "no-stt-provider-configured" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form-data body" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "audio blob required" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio exceeds 8MB cap" }, { status: 413 });
  }

  const lang = typeof form.get("lang") === "string" ? (form.get("lang") as string) : undefined;
  const ext = audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([audio], `clip.${ext}`, { type: audio.type || "audio/webm" });

  // Primary: OpenAI Whisper. Secondary: Groq Whisper-large-v3.
  const primary = await transcribeOpenAi(file, lang);
  if (primary.ok) {
    return NextResponse.json(
      { text: primary.text, provider: "openai" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const fallback = await transcribeGroq(file, lang);
  if (fallback.ok) {
    return NextResponse.json(
      { text: fallback.text, provider: "groq" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Both providers failed — surface the most actionable error code so the
  // FE can show real copy instead of a generic 504.
  const combined = `${primary.error ?? ""} | ${fallback.error ?? ""}`.toLowerCase();
  const isQuota = combined.includes("quota") || combined.includes("429") || combined.includes("insufficient_quota");
  const isTimeout = combined.includes("timeout") || combined.includes("aborted");
  return NextResponse.json(
    {
      error: isQuota ? "stt-providers-quota-exhausted" : isTimeout ? "stt-timeout" : "stt-failed",
      detail: combined.trim(),
    },
    { status: isQuota ? 503 : isTimeout ? 504 : 500 },
  );
}
