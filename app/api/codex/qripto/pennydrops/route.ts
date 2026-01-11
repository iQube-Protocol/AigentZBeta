/**
 * Codex Helper Route: Qriptopian PennyDrops
 * GET /api/codex/qripto/pennydrops
 *
 * This route exists for backward compatibility with codex tab configs.
 * It proxies to the canonical section endpoint:
 *   /api/content/section/pennydrops
 *
 * Query params are passed through (e.g. ?issue=issue-1).
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const target = new URL('/api/content/section/pennydrops', url.origin);
    target.search = url.search;

    const res = await fetch(target.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to proxy PennyDrops', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
