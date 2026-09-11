/**
 * GET /api/journey/knyts-bridge/crossing-of-the-week
 *
 * Public, unauthenticated read — the KNYTS Bridge front door (HOMECOMING/
 * VIEW) shows this without requiring sign-in. Returns null when no winner
 * has been selected yet this week (not an error).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { getCurrentCrossingOfTheWeek } from '@/services/journey/crossingOfTheWeek';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const supabase = getCommunityContentSupabase();
    const crossing = await getCurrentCrossingOfTheWeek(supabase, new Date());
    return NextResponse.json({ ok: true, crossing });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `This request threw before it could answer: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}.`,
      },
      { status: 500 },
    );
  }
}
