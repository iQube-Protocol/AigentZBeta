/**
 * DVN Events API
 * 
 * GET /api/dvn/events?agentId=guest&limit=10
 * 
 * Returns DVN events for an agent
 */

import { NextRequest, NextResponse } from 'next/server';

// CORS headers for cross-origin requests from thin client
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '10');

    // For now, return empty events array
    // TODO: Implement actual DVN events fetching when DVN is integrated
    const events: any[] = [];

    return NextResponse.json({
      success: true,
      events,
      agentId,
      limit,
    });

  } catch (error) {
    console.error('[DVN Events] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch DVN events',
    }, { status: 500,  });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
