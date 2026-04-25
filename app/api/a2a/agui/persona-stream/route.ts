/**
 * AG-UI Persona Action Stream (SSE)
 *
 * Platform-side bridge: subscribes by personaId and emits ACTION events
 * whenever the thin client sends an action for that persona. This lets the
 * platform's SmartTriadProvider react to thin-client UI actions in real time
 * without needing to share a sessionId.
 *
 * URL: GET /api/a2a/agui/persona-stream?personaId=<id>
 */

import { NextRequest } from 'next/server';
import { getStateManager } from '@/services/agui/SmartTriadStateManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const personaId = req.nextUrl.searchParams.get('personaId');

  if (!personaId) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameter: personaId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();
  const stateManager = getStateManager();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial ready event
      controller.enqueue(encoder.encode(`event: READY\ndata: {"personaId":"${personaId}"}\n\n`));

      const unsubscribe = stateManager.addPersonaActionListener(personaId, (event) => {
        try {
          const line = `event: ACTION\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          // ignore closed stream
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: HEARTBEAT\ndata: {}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
