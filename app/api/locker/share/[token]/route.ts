/**
 * GET /api/locker/share/[token] — governed-link redirect (spec §15.3,
 * §4.7 "links by default"). No auth required (external recipient) — the
 * unguessable token itself, plus the pack's authorization_state
 * (sent / not revoked / not expired), is the access control. Never
 * exposes the raw storage URL directly; always a 302 redirect resolved
 * server-side. Mirrors CLAUDE.md's Gated Content proxy discipline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveShareLink } from '@/services/locker/sharePack';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await ctx.params;
  const result = await resolveShareLink(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code === 'not_found' ? 404 : 403 });
  }
  return NextResponse.redirect(result.value.publicUrl, { status: 302 });
}
