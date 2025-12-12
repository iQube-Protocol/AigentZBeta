/**
 * AigentQube API
 * 
 * GET /api/agents - List agents
 * POST /api/agents - Create agent (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  aigentQubeFixtures,
  SEED_AGENTS,
  SEED_METAVATARS,
} from '@/services/drawer';
import type { AigentQube } from '@/types/aigentQube';

export const runtime = 'nodejs';

/**
 * GET /api/agents
 * 
 * Query params:
 * - id: Get specific agent
 * - appId: Filter by app
 * - type: Filter by type (copilot, franchise, metavatar, specialist)
 * - active: Filter by active status (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const appId = searchParams.get('appId');
    const type = searchParams.get('type');
    const activeOnly = searchParams.get('active') !== 'false';

    // Get by ID
    if (id) {
      const agent = aigentQubeFixtures.getAgentById(id);
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found', id },
          { status: 404 }
        );
      }

      // Include metavatars
      const metavatars = aigentQubeFixtures.getMetavatarsForAgent(id);

      return NextResponse.json({ agent, metavatars });
    }

    // Filter agents
    let agents = [...SEED_AGENTS];

    if (appId) {
      agents = agents.filter((a) => a.appIds.includes(appId));
    }

    if (type) {
      agents = agents.filter((a) => a.type === type);
    }

    if (activeOnly) {
      agents = agents.filter((a) => a.isActive);
    }

    return NextResponse.json({
      agents,
      count: agents.length,
    });
  } catch (error) {
    console.error('[Agents API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents
 * 
 * Body: AigentQube
 * 
 * Creates a new agent (admin only - TODO: add auth).
 */
export async function POST(request: NextRequest) {
  try {
    const body: AigentQube = await request.json();

    // Validate required fields
    if (!body.id || !body.label || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: id, label, type' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = aigentQubeFixtures.getAgentById(body.id);
    if (existing) {
      return NextResponse.json(
        { error: 'Agent already exists', id: body.id },
        { status: 409 }
      );
    }

    // TODO: Save to database
    // For now, just validate and return

    return NextResponse.json({
      agent: body,
      message: 'Agent created successfully (not persisted - database integration pending)',
    });
  } catch (error) {
    console.error('[Agents API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
