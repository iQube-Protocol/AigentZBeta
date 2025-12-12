/**
 * Copilot Session API
 * 
 * POST /api/copilot/session - Create new session
 * GET /api/copilot/session - Get session by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createCopilotSession,
  getCopilotSession,
  sessionManager,
} from '@/services/copilot';

export const runtime = 'nodejs';

/**
 * POST /api/copilot/session
 * 
 * Create a new Copilot session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { drawerSetId, appId, tenantId, personaId, welcomeMessage } = body;

    if (!drawerSetId || !appId || !tenantId || !personaId) {
      return NextResponse.json(
        { error: 'Missing required fields: drawerSetId, appId, tenantId, personaId' },
        { status: 400 }
      );
    }

    const session = createCopilotSession({
      drawerSetId,
      appId,
      tenantId,
      personaId,
      welcomeMessage,
    });

    return NextResponse.json({
      session: {
        id: session.id,
        drawerSetId: session.drawerSetId,
        messages: session.messages,
        createdAt: session.createdAt,
        isActive: session.isActive,
      },
    });
  } catch (error) {
    console.error('[Copilot Session API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/copilot/session
 * 
 * Get session by ID.
 * 
 * Query params:
 * - id: Session ID
 * - personaId: List sessions for persona
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const personaId = searchParams.get('personaId');

    if (id) {
      const session = getCopilotSession(id);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found', id },
          { status: 404 }
        );
      }

      return NextResponse.json({
        session: {
          id: session.id,
          drawerSetId: session.drawerSetId,
          messages: session.messages,
          overlay: session.overlay,
          compilations: session.compilations.map((c) => ({
            changes: c.changes,
            confidence: c.confidence,
            warnings: c.warnings,
          })),
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          isActive: session.isActive,
        },
      });
    }

    if (personaId) {
      const sessions = sessionManager.listSessions(personaId);
      return NextResponse.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          drawerSetId: s.drawerSetId,
          messageCount: s.messages.length,
          createdAt: s.createdAt,
          lastActivityAt: s.lastActivityAt,
          isActive: s.isActive,
        })),
        count: sessions.length,
      });
    }

    return NextResponse.json(
      { error: 'Missing required query parameter: id or personaId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Copilot Session API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
