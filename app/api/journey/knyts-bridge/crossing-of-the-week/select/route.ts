/**
 * POST /api/journey/knyts-bridge/crossing-of-the-week/select
 *
 * Admin-triggered (or ops-token, e.g. a weekly cron) selection of this
 * week's Crossing of the Week. Idempotent — a second call in the same week
 * returns the already-selected winner rather than re-selecting.
 *
 * Gated via requireAdminPersona (services/identity spine's server-resolved
 * isAdmin, or ADMIN_OPS_TOKEN for headless callers) — never a hand-rolled
 * admin check, per CLAUDE.md's Security — Access Gates rule.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPersona } from '@/app/api/_lib/requireAdmin';
import { getCommunityContentSupabase } from '@/app/api/community-content/_lib/personaContext';
import { selectCrossingOfTheWeek } from '@/services/journey/crossingOfTheWeek';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isAdmin = await requireAdminPersona(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: 'admin required' }, { status: 403 });
  }
  try {
    const supabase = getCommunityContentSupabase();
    const crossing = await selectCrossingOfTheWeek(supabase, new Date(), 'admin');
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
