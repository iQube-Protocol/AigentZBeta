/**
 * POST /api/runtime/takeover/signal
 *
 * Generic signal write-back endpoint for the Runtime Takeover system.
 *
 * Records a lightweight user interaction signal (view, like, spark, etc.) against
 * a cartridge takeover session. Used by actions that don't have a dedicated content
 * endpoint (e.g. the generic `view` signal fired on every capsule launch).
 *
 * Body: { cartridgeSlug, personaId, action, contentId?, runtimeSource?, ...extra }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SignalBody {
  cartridgeSlug?: string;
  personaId?: string | null;
  action: string;
  contentId?: string;
  runtimeSource?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  let body: SignalBody;
  try {
    body = await req.json() as SignalBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { cartridgeSlug, personaId, action, ...extra } = body;

  if (!action) {
    return NextResponse.json({ ok: false, error: 'action_required' }, { status: 400 });
  }

  // Only write to DB when we have a personaId — anonymous signals are silently dropped
  if (personaId && supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('knyt_signals').insert({
        persona_id: personaId,
        signal_type: action,
        source: 'runtime_takeover',
        cartridge_slug: cartridgeSlug ?? null,
        metadata: extra,
      });
    } catch {
      // Signal write is fire-and-forget; never fail the caller
    }
  }

  return NextResponse.json({ ok: true });
}
