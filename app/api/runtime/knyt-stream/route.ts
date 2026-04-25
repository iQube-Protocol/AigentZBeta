/**
 * GET /api/runtime/knyt-stream?personaId=<id>
 *
 * SSE stream that emits refresh signals for the KNYT runtime surface.
 * The CartridgeRuntimeTemplate subscribes via EventSource and re-fetches
 * state data from /api/runtime/knyt-state on each refresh event.
 *
 * Events emitted:
 *   event: connected  — on connect (includes personaId echo)
 *   event: refresh    — immediately on connect, then every 30s
 *
 * The template triggers a full state re-fetch on each 'refresh' event,
 * keeping the surface reactive without polling the heavier state endpoint.
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REFRESH_INTERVAL_MS = 30_000;

export async function GET(request: NextRequest) {
  const personaId = request.nextUrl.searchParams.get('personaId');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Immediate connect + first refresh
      send('connected', { personaId: personaId ?? null });
      send('refresh', { t: Date.now(), reason: 'initial' });

      // Periodic refresh signal
      const interval = setInterval(() => {
        try {
          send('refresh', { t: Date.now(), reason: 'heartbeat' });
        } catch {
          clearInterval(interval);
        }
      }, REFRESH_INTERVAL_MS);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
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
