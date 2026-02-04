/**
 * Orchestrate Flow API
 * 
 * POST /api/orchestrate-flow
 * 
 * Runs the ARRIVE → ALIGN → ASSESS → ADAPT → ACT → ANCHOR pipeline
 * and returns orchestration decisions including drawer changes and narrative hints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { orchestrateFlow } from '@/orchestration/orchestrate';
import { applyDrawerChanges } from '@/orchestration/drawerIntegration';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.tenantId || !body.appId || !body.personaId) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, appId, personaId' },
        { status: 400 }
      );
    }

    // Run orchestration
    const decision = await orchestrateFlow({
      userId: body.userId || 'anonymous',
      tenantId: body.tenantId,
      appId: body.appId,
      personaId: body.personaId,
      activeAgentId: body.activeAgentId || 'Copilot',
      smartContentId: body.smartContentId,
      activeDrawerId: body.activeDrawerId,
      activeTabId: body.activeTabId,
      explicitGoal: body.explicitGoal,
    });

    // Convert drawer changes to state delta
    const drawerDelta = applyDrawerChanges(decision.drawerChanges, {});

    return NextResponse.json({
      success: true,
      flowContext: decision.flowContext,
      primaryAgentId: decision.primaryAgentId,
      secondaryAgentIds: decision.secondaryAgentIds,
      drawerDelta,
      narrativeHints: decision.narrativeHints,
    });
  } catch (error) {
    console.error('Orchestration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/orchestrate-flow',
    method: 'POST',
    description: 'Run the orchestration pipeline for a given context',
    requiredFields: ['tenantId', 'appId', 'personaId'],
    optionalFields: [
      'userId',
      'activeAgentId',
      'smartContentId',
      'activeDrawerId',
      'activeTabId',
      'explicitGoal',
    ],
    pipeline: [
      'ARRIVE - Identify where the user is',
      'ALIGN - Map persona, wallet, risk, and agents',
      'ASSESS - Determine what\'s possible next',
      'ADAPT - Reshape menu/drawers for the goal',
      'ACT - Propose concrete actions',
      'ANCHOR - Connect to the bigger journey',
    ],
  });
}
