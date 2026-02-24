/**
 * AG-UI Stream Endpoint (SSE)
 * 
 * Server-Sent Events stream for real-time UI state synchronization.
 * Emits STATE_SNAPSHOT, STATE_DELTA, and HEARTBEAT events.
 */

import { NextRequest } from 'next/server';
import { getStateManager } from '@/services/agui/SmartTriadStateManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');
  const personaId = searchParams.get('personaId');
  const tenantId = searchParams.get('tenantId');
  const device = (searchParams.get('device') || 'desktop') as 'mobile' | 'tablet' | 'desktop';

  // Validate required parameters
  if (!sessionId || !personaId) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameters: sessionId, personaId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const stateManager = getStateManager();

      // Initialize or get existing session
      let state = stateManager.getState(sessionId);
      if (!state) {
        state = stateManager.initializeSession(
          sessionId,
          personaId,
          tenantId || personaId, // Default tenant to persona if not provided
          device
        );
      }

      // Send initial STATE_SNAPSHOT
      const snapshotData = `event: STATE_SNAPSHOT\ndata: ${JSON.stringify(state)}\n\n`;
      controller.enqueue(encoder.encode(snapshotData));

      // Register event listener
      const unsubscribe = stateManager.addEventListener(sessionId, (event) => {
        try {
          const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(eventData));
        } catch (error) {
          console.error('Error sending SSE event:', error);
        }
      });

      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          stateManager.emitHeartbeat(sessionId);
        } catch (error) {
          console.error('Error sending heartbeat:', error);
        }
      }, 30000);

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        // Note: We don't destroy the session here as it may be reused
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
