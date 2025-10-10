// QCT Event Listener API - Control and monitor the event listening service
import { NextRequest, NextResponse } from 'next/server';
import { getQCTEventListener } from '@/services/qct/EventListener';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const listener = getQCTEventListener();

    switch (action) {
      case 'status':
        return NextResponse.json({
          ok: true,
          running: listener.isListening(),
          stats: listener.getStats(),
          chains: listener.getSupportedChains().map(chain => ({
            chainId: chain.chainId,
            name: chain.name,
            type: chain.type,
            enabled: chain.enabled,
          })),
          at: new Date().toISOString(),
        });

      case 'stats':
        const chainId = searchParams.get('chainId');
        if (chainId) {
          const chainStats = listener.getChainStats(chainId);
          if (!chainStats) {
            return NextResponse.json(
              { ok: false, error: `Chain not found: ${chainId}` },
              { status: 404 }
            );
          }
          return NextResponse.json({ ok: true, stats: chainStats });
        }
        return NextResponse.json({ ok: true, stats: listener.getStats() });

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[QCT Events API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const listener = getQCTEventListener();

    switch (action) {
      case 'start':
        if (listener.isListening()) {
          return NextResponse.json({
            ok: true,
            message: 'Event listener is already running',
            stats: listener.getStats(),
          });
        }

        await listener.start();
        return NextResponse.json({
          ok: true,
          message: 'Event listener started successfully',
          stats: listener.getStats(),
        });

      case 'stop':
        if (!listener.isListening()) {
          return NextResponse.json({
            ok: true,
            message: 'Event listener is already stopped',
            stats: listener.getStats(),
          });
        }

        await listener.stop();
        return NextResponse.json({
          ok: true,
          message: 'Event listener stopped successfully',
          stats: listener.getStats(),
        });

      case 'restart':
        if (listener.isListening()) {
          await listener.stop();
        }
        await listener.start();
        return NextResponse.json({
          ok: true,
          message: 'Event listener restarted successfully',
          stats: listener.getStats(),
        });

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[QCT Events API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
