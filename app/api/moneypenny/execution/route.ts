/**
 * MoneyPenny Execution API Route
 * 
 * Handles trade execution and intent submission
 */

import { NextRequest, NextResponse } from 'next/server';

interface Intent {
  intent_id: string;
  chain: string;
  side: 'BUY' | 'SELL';
  amount_qc: number;
  min_edge_bps: number;
  max_slippage_bps: number;
  status: 'pending' | 'quoted' | 'executing' | 'filled' | 'cancelled' | 'failed';
  created_at: string;
  expires_at: string;
}

interface Execution {
  id: string;
  intent_id: string;
  chain: string;
  side: 'BUY' | 'SELL';
  qty_filled: number;
  avg_price: number;
  capture_bps: number;
  execution_venue?: string;
  metadata?: any;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'submit_intent') {
      const { chain, side, amountQc, minEdgeBps, maxSlippageBps } = await request.json();

      // Create mock intent
      const intent: Intent = {
        intent_id: `intent_${Date.now()}`,
        chain,
        side,
        amount_qc: amountQc,
        min_edge_bps: minEdgeBps,
        max_slippage_bps: maxSlippageBps,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      };

      // Simulate quick execution for demo
      setTimeout(() => {
        // In production, this would be handled by the execution engine
        console.log(`Intent ${intent.intent_id} would be executed now`);
      }, 1000);

      return NextResponse.json({
        success: true,
        data: intent,
      });

    } else if (action === 'get_executions') {
      // Mock execution history
      const executions: Execution[] = [
        {
          id: 'exec_1',
          intent_id: 'intent_123',
          chain: 'ETH',
          side: 'BUY',
          qty_filled: 5000,
          avg_price: 0.0105,
          capture_bps: 12.5,
          execution_venue: 'uniswap_v3',
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
        {
          id: 'exec_2',
          intent_id: 'intent_124',
          chain: 'ARB',
          side: 'SELL',
          qty_filled: 3000,
          avg_price: 0.0098,
          capture_bps: -3.2,
          execution_venue: 'camelot',
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        },
      ];

      return NextResponse.json({
        success: true,
        data: executions,
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('MoneyPenny execution API error:', error);
    return NextResponse.json(
      { error: 'Failed to process execution request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const intentId = searchParams.get('intentId');

    if (intentId) {
      // Mock intent status
      const intent: Intent = {
        intent_id: intentId,
        chain: 'ETH',
        side: 'BUY',
        amount_qc: 5000,
        min_edge_bps: 10,
        max_slippage_bps: 5,
        status: 'filled',
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      return NextResponse.json({
        success: true,
        data: intent,
      });
    } else {
      return NextResponse.json(
        { error: 'Intent ID required' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('MoneyPenny execution API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution data' },
      { status: 500 }
    );
  }
}
