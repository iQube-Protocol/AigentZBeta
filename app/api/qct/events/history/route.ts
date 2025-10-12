import { NextRequest, NextResponse } from 'next/server';
import { getQCTEventListener } from '@/services/qct/EventListener';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!chainId) {
      return NextResponse.json(
        { ok: false, error: 'chainId parameter is required' },
        { status: 400 }
      );
    }

    const listener = getQCTEventListener();
    
    // Debug: Log all available chains
    const allHistory = listener.getAllLatestTransactions();
    console.log('[QCT Events History API] Available chains:', Object.keys(allHistory));
    console.log('[QCT Events History API] Requested chainId:', chainId);
    
    const history = listener.getTransactionHistory(chainId, limit, offset);
    const totalCount = listener.getTransactionCount(chainId);
    
    console.log('[QCT Events History API] Found transactions:', history.length, 'Total:', totalCount);

    // Serialize to handle BigInt values
    const serializedHistory = JSON.parse(JSON.stringify(history, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({
      ok: true,
      chainId,
      transactions: serializedHistory,
      count: serializedHistory.length,
      totalCount,
      hasMore: offset + limit < totalCount,
      at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[QCT Events History API] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch transaction history'
    }, { status: 500 });
  }
}
