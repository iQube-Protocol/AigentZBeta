/**
 * GET /api/moneypenny/learn-content — MoneyPenny Cartridge C-15/C-17
 * (2026-09-02). Reads MoneyPenny's ONE educational-video section through
 * the shared bridge editorial reader (services/journey/moneyPennyEducationalMedia.ts)
 * — the SAME publication path native Qriptopian Bridges admin uses for
 * every other bridge section.
 *
 * Deliberately NOT gated on auth — mirrors
 * /api/journey/knyts-bridge/editorial-config's own GET posture (public
 * bridge/educational copy is browsable signed-out); this is free/preview
 * content, not gated per CLAUDE.md's "Gated Content" rules.
 */

import { NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { getMoneyPennyLearnContent } from '@/services/journey/moneyPennyEducationalMedia';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getCommunityContentSupabase();
    const content = await getMoneyPennyLearnContent(supabase);
    return NextResponse.json({ ok: true, content });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'internal-error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
