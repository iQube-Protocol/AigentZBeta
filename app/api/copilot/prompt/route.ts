/**
 * Copilot Prompt API
 * 
 * POST /api/copilot/prompt - Process a user prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCopilotPrompt, getMergedDrawerSet } from '@/services/copilot';
import type { Device } from '@/types/smartDrawer';

export const runtime = 'nodejs';

/**
 * POST /api/copilot/prompt
 * 
 * Process a user prompt in an existing session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, prompt, device = 'desktop' } = body;

    if (!sessionId || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, prompt' },
        { status: 400 }
      );
    }

    const result = await processCopilotPrompt({
      sessionId,
      prompt,
      device: device as Device,
    });

    // Get merged drawer set if drawer was modified
    let mergedDrawerSet = null;
    if (result.drawerModified) {
      mergedDrawerSet = await getMergedDrawerSet(sessionId);
    }

    return NextResponse.json({
      response: result.response,
      drawerModified: result.drawerModified,
      compilation: result.compilation ? {
        changes: result.compilation.changes,
        confidence: result.compilation.confidence,
        warnings: result.compilation.warnings,
        reasoning: result.compilation.reasoning,
      } : null,
      mergedDrawerSet: mergedDrawerSet ? {
        id: mergedDrawerSet.id,
        drawers: mergedDrawerSet.drawers.map((d) => ({
          id: d.id,
          label: d.label,
          tabs: d.tabs.map((t) => ({
            id: t.id,
            label: t.label,
            slotCount: t.slots.length,
            hasAgentPanel: !!t.agentPanel,
          })),
        })),
      } : null,
      session: {
        id: result.session.id,
        messageCount: result.session.messages.length,
        lastActivityAt: result.session.lastActivityAt,
        isActive: result.session.isActive,
      },
    });
  } catch (error) {
    console.error('[Copilot Prompt API] error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Session not found')) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('Session expired')) {
        return NextResponse.json(
          { error: 'Session expired', message: 'Please create a new session' },
          { status: 410 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
