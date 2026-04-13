/**
 * GET  /api/crm/campaign/tracking-links
 *   Returns the full link registry with live click counts and ready-to-use
 *   redirect URLs. Supports optional ?ownerType= and ?channel= filters.
 *
 * POST /api/crm/campaign/tracking-links
 *   Body: { action: 'generate' }
 *   Regenerates (upserts) the canonical link pack from the built-in config.
 *   Safe to call repeatedly — idempotent.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLinkRegistry,
  generateLinkPack,
} from '@/services/campaign/knytTrackingService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ownerType = searchParams.get('ownerType') ?? undefined;
  const channel   = searchParams.get('channel')   ?? undefined;

  const links = await getLinkRegistry({ ownerType, channel });

  return NextResponse.json({
    data:  links,
    total: links.length,
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* no body — fine */ }

  if (body.action !== 'generate' && body.action !== undefined) {
    return NextResponse.json({ error: 'Unknown action — use { action: "generate" }' }, { status: 400 });
  }

  const result = await generateLinkPack({
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success:  true,
    upserted: result.upserted,
    tags:     result.tags,
  });
}
