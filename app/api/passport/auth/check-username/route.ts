/**
 * POST /api/passport/auth/check-username — Bureau username availability.
 *
 * Best-effort UX probe; signup remains the authoritative duplicate check
 * (it returns 409 on conflict). PRD §9 step 1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { bureauUsernameAvailable } from '@/services/passport/bureauIdentityService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username : '';
    const result = await bureauUsernameAvailable(username);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Check failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
