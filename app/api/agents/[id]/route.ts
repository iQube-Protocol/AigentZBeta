/**
 * Agent by ID API
 * 
 * GET /api/agents/[id] - Get agent with metavatars
 */

import { NextRequest, NextResponse } from 'next/server';
import { aigentQubeFixtures } from '@/services/drawer';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/agents/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const agent = aigentQubeFixtures.getAgentById(id);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found', id },
        { status: 404 }
      );
    }

    // Get metavatars for this agent
    const metavatars = aigentQubeFixtures.getMetavatarsForAgent(id);

    return NextResponse.json({
      agent,
      metavatars,
    });
  } catch (error) {
    console.error('[Agent API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
