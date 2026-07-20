/**
 * POST /api/skills/tts
 *
 * Speech synthesis for the copilot inference playback (ListenButton,
 * useTTSPlayer). Thin wrapper over `synthesizeSpeech`
 * (services/audio/ttsSynthesis.ts) — Cartesia Sonic English primary, OpenAI
 * tts-1 fallback, mp3 wire format. The synthesizer was extracted so the
 * constitutional-video voiceover mux reuses the same provider chain; this
 * route's behaviour (voices, timeouts, headers, quota detection) is unchanged.
 *
 * Body: { text: string; voice?: string }. Response: audio/mpeg bytes (mp3)
 * OR JSON { error } with 4xx/5xx.
 */

import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech, ttsProviderConfigured, type TtsVoice } from '@/services/audio/ttsSynthesis';

export async function POST(req: NextRequest) {
  const { text, voice = 'nova' } = (await req.json()) as { text?: string; voice?: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  if (!ttsProviderConfigured()) {
    return NextResponse.json({ error: 'no-tts-provider-configured' }, { status: 503 });
  }

  const result = await synthesizeSpeech(text, voice as TtsVoice);

  if (result.ok && result.bytes) {
    const headers: Record<string, string> = {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(result.bytes.length),
      'X-TTS-Provider': result.provider ?? 'unknown',
    };
    // Diagnostic: surface why Cartesia fell through (auth/model/version/quota)
    // so the operator can DevTools the response without CloudWatch access.
    if (result.provider === 'openai' && result.cartesiaError) {
      headers['X-TTS-Cartesia-Error'] = result.cartesiaError.slice(0, 200);
    }
    return new NextResponse(result.bytes, { headers });
  }

  const isQuota = result.error === 'tts-providers-quota-exhausted';
  return NextResponse.json(
    {
      error: result.error ?? 'tts-failed',
      cartesia: result.cartesiaError ?? null,
    },
    { status: isQuota ? 503 : 500 },
  );
}
