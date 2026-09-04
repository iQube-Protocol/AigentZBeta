/**
 * MoneyPenny Quotes API Route
 * 
 * Handles real-time quotes and market data
 */

import { NextRequest, NextResponse } from 'next/server';
import { simulateQuote, simulationSource, timeBucket } from '@/services/moneypenny/marketSimulation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chains = searchParams.get('chains')?.split(',') || ['ETH', 'ARB', 'BASE', 'POLYGON', 'OPTIMISM'];

    // Simulated quote data — there is no real Q¢ market-data feed today
    // (confirmed by codexes/packs/agentiq/updates/2026-09-02_mpy2-0b-moneypenny002-real-source-audit.md
    // §3). 2026-09-04 "atomic, capsule-composable surfaces" ruling: values
    // now come from the ONE deterministic, seeded simulation service
    // (services/moneypenny/marketSimulation.ts) instead of `Math.random()`,
    // and every quote carries an explicit source classification rather than
    // an unlabelled number.
    const bucket = timeBucket();
    const observedAt = new Date().toISOString();
    const quotes = chains.map(chain => {
      const q = simulateQuote(chain, bucket);
      return {
        chain,
        edge_bps: q.edgeBps,
        floor_bps: q.floorBps,
        price_usdc: q.priceUsdc,
        qty_qc: q.qtyQc,
        ts: observedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: quotes,
      source: simulationSource(observedAt),
      timestamp: observedAt,
    });

  } catch (error) {
    console.error('MoneyPenny quotes API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, chains, onEvent } = await request.json();

    // For now, return a mock event stream response
    // In production, this would set up Server-Sent Events for real-time streaming
    return NextResponse.json({
      success: true,
      message: 'Quote stream initiated',
      streamId: `stream_${Date.now()}`,
      chains,
    });

  } catch (error) {
    console.error('MoneyPenny quotes stream API error:', error);
    return NextResponse.json(
      { error: 'Failed to start quote stream' },
      { status: 500 }
    );
  }
}
