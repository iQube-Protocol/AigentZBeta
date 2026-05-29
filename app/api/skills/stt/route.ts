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
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getActivePersona } from "@/services/identity/getActivePersona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB cap matches Whisper-friendly clip sizes

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
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

  // Lambda's hard exec budget is 30s; the OpenAI SDK retries by default
  // and can easily blow past that if Whisper is slow / quota-throttled,
  // producing a 504 at API Gateway instead of a clean error here.
  // maxRetries=0 + a 22s timeout keeps us safely inside the budget so
  // the operator gets a real error (quota / timeout) instead of a
  // gateway timeout.
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 22_000,
    });
    const ext = audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([audio], `clip.${ext}`, { type: audio.type || "audio/webm" });
    const result = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      ...(lang ? { language: lang } : {}),
    });
    return NextResponse.json(
      { text: result.text ?? "" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[skills/stt] whisper failed:", msg);
    const lower = msg.toLowerCase();
    // Map common upstream failure modes so the FE can surface useful
    // copy instead of a generic "stt failed". Quota exhaustion is the
    // most common dev-env failure mode today.
    const isQuota = lower.includes("quota") || lower.includes("429") || lower.includes("insufficient_quota");
    const isTimeout = lower.includes("timeout") || lower.includes("aborted");
    return NextResponse.json(
      {
        error: isQuota ? "openai-quota-exhausted" : isTimeout ? "stt-timeout" : "stt-failed",
        detail: msg,
      },
      { status: isQuota ? 503 : isTimeout ? 504 : 500 },
    );
  }
}
