/**
 * ttsSynthesis — speech synthesis extracted from /api/skills/tts (2026-07-19).
 *
 * The provider chain (Cartesia Sonic English primary → OpenAI tts-1 fallback,
 * same mp3 wire format) is now a reusable service so BOTH the copilot playback
 * route AND the constitutional-video voiceover mux consume one synthesizer.
 * The /api/skills/tts route becomes a thin wrapper over `synthesizeSpeech` —
 * its behaviour (voices, timeouts, headers, quota detection) is byte-identical.
 *
 * Server-only.
 */

import OpenAI from 'openai';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_VERSION = process.env.CARTESIA_VERSION || '2024-11-13';
const CARTESIA_VOICE_ID =
  process.env.CARTESIA_VOICE_ID || '694f9389-aac1-45b6-b726-9d9369183238';
const CARTESIA_MODEL = process.env.CARTESIA_MODEL || 'sonic-english';

/** OpenAI tts-1 voice ids. */
export type TtsVoice = 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';

export interface SynthResult {
  ok: boolean;
  bytes?: Buffer;
  provider?: 'cartesia' | 'openai';
  /** Cartesia's failure reason when the OpenAI fallback served the bytes. */
  cartesiaError?: string;
  error?: string;
}

/** Longest text a single tts-1 call accepts (mirrors the route's cap). */
export const TTS_MAX_CHARS = 950;

export function ttsProviderConfigured(): boolean {
  return Boolean(CARTESIA_API_KEY || process.env.OPENAI_API_KEY);
}

async function synthCartesia(text: string): Promise<SynthResult> {
  if (!CARTESIA_API_KEY) return { ok: false, error: 'cartesia-not-configured' };
  // 8s cap so ~20s of Lambda's 30s budget remains for the OpenAI fallback.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': CARTESIA_API_KEY,
        'Cartesia-Version': CARTESIA_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: CARTESIA_MODEL,
        transcript: text,
        voice: { mode: 'id', id: CARTESIA_VOICE_ID },
        output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[ttsSynthesis] Cartesia returned ${res.status}: ${detail.slice(0, 200)}`);
      return { ok: false, error: `cartesia-${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true, bytes: Buffer.from(await res.arrayBuffer()), provider: 'cartesia' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ttsSynthesis] Cartesia call failed: ${msg}`);
    return { ok: false, error: msg.includes('aborted') ? 'cartesia-timeout-8s' : msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function synthOpenAi(text: string, voice: string): Promise<SynthResult> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: 'openai-not-configured' };
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 18_000 });
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice as TtsVoice,
      input: text.slice(0, TTS_MAX_CHARS),
    });
    return { ok: true, bytes: Buffer.from(await mp3.arrayBuffer()), provider: 'openai' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ttsSynthesis] OpenAI tts-1 failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

/**
 * Synthesize `text` to mp3 bytes: Cartesia primary, OpenAI tts-1 fallback.
 * Returns the bytes + which provider served them, or an honest error. Never
 * throws.
 */
export async function synthesizeSpeech(text: string, voice: TtsVoice = 'nova'): Promise<SynthResult> {
  const trimmed = text.slice(0, TTS_MAX_CHARS);
  if (!trimmed.trim()) return { ok: false, error: 'text-required' };
  if (!ttsProviderConfigured()) return { ok: false, error: 'no-tts-provider-configured' };

  const primary = await synthCartesia(trimmed);
  if (primary.ok && primary.bytes) return primary;

  const fallback = await synthOpenAi(trimmed, voice);
  if (fallback.ok && fallback.bytes) {
    return { ...fallback, cartesiaError: primary.error };
  }

  const combined = `${primary.error ?? ''} | ${fallback.error ?? ''}`.toLowerCase();
  const isQuota = combined.includes('quota') || combined.includes('429');
  return {
    ok: false,
    error: isQuota ? 'tts-providers-quota-exhausted' : 'tts-failed',
    cartesiaError: primary.error,
  };
}
