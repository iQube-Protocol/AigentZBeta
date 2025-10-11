// QCT Event Listener API - Control and monitor the event listening service
import { NextRequest, NextResponse } from 'next/server';
import { getQCTEventListener } from '@/services/qct/EventListener';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const listener = getQCTEventListener();
    
    // Note: Auto-start disabled to prevent hanging
    // User must manually start the listener via the UI

    switch (action) {
      case 'status':
        const stats = listener.getStats();
        const chains = listener.getSupportedChains();
        
        // Serialize to handle BigInt values
        const serializedStats = JSON.parse(JSON.stringify(stats, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));
        
        return NextResponse.json({
          ok: true,
          running: listener.isListening(),
          stats: serializedStats,
          chains: chains.map(chain => ({
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
          // Serialize chainStats
          const serializedChainStats = JSON.parse(JSON.stringify(chainStats, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));
          return NextResponse.json({ ok: true, stats: serializedChainStats });
        }
        // Serialize all stats
        const allStats = listener.getStats();
        const serializedAllStats = JSON.parse(JSON.stringify(allStats, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));
        return NextResponse.json({ ok: true, stats: serializedAllStats });

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
          const startStats = listener.getStats();
          const serializedStartStats = JSON.parse(JSON.stringify(startStats, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));
          return NextResponse.json({
            ok: true,
            message: 'Event listener is already running',
            stats: serializedStartStats,
          });
        }

        await listener.start();
        const afterStartStats = listener.getStats();
        const serializedAfterStartStats = JSON.parse(JSON.stringify(afterStartStats, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));
        return NextResponse.json({
          ok: true,
          message: 'Event listener started successfully',
          stats: serializedAfterStartStats,
        });

      case 'stop':
        if (!listener.isListening()) {
          const stopStats = listener.getStats();
          const serializedStopStats = JSON.parse(JSON.stringify(stopStats, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));
          return NextResponse.json({
            ok: true,
            message: 'Event listener is already stopped',
            stats: serializedStopStats,
          });
        }

        await listener.stop();
        const afterStopStats = listener.getStats();
        const serializedAfterStopStats = JSON.parse(JSON.stringify(afterStopStats, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));
        return NextResponse.json({
          ok: true,
          message: 'Event listener stopped successfully',
          stats: serializedAfterStopStats,
        });

      case 'restart':
        if (listener.isListening()) {
          await listener.stop();
        }
        await listener.start();
        const restartStats = listener.getStats();
        const serializedRestartStats = JSON.parse(JSON.stringify(restartStats, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ));
        return NextResponse.json({
          ok: true,
          message: 'Event listener restarted successfully',
          stats: serializedRestartStats,
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
