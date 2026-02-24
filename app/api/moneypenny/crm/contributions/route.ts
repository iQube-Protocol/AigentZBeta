/**
 * MoneyPenny CRM Contributions API Route
 * 
 * Handles contribution tracking and recording
 */

import { NextRequest, NextResponse } from 'next/server';

interface Contribution {
  id: string;
  type: 'trade_execution' | 'strategy_optimization' | 'market_analysis' | 'ai_insight';
  title: string;
  description: string;
  value: number;
  currency: string;
  timestamp: string;
  status: 'pending' | 'recorded' | 'processed';
}

// Mock database (in production, this would use Supabase or another database)
let contributions: Contribution[] = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || 'moneypenny';

    // Filter contributions by agent
    const agentContributions = contributions.filter(c => 
      c.title.toLowerCase().includes(agentId.toLowerCase())
    );

    return NextResponse.json({
      success: true,
      data: agentContributions,
      total: agentContributions.length,
    });

  } catch (error) {
    console.error('MoneyPenny CRM contributions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contribution: Contribution = await request.json();

    // Validate contribution data
    if (!contribution.title || !contribution.value || contribution.value <= 0) {
      return NextResponse.json(
        { error: 'Invalid contribution data' },
        { status: 400 }
      );
    }

    // Add contribution with generated ID and timestamp
    const newContribution: Contribution = {
      ...contribution,
      id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: 'recorded',
    };

    // Store contribution (in production, this would save to database)
    contributions.push(newContribution);

    // Mock CRM integration
    console.log(`CRM: Recorded contribution ${newContribution.id} - ${newContribution.title}`);

    return NextResponse.json({
      success: true,
      data: newContribution,
      message: 'Contribution recorded successfully',
    });

  } catch (error) {
    console.error('MoneyPenny CRM contributions API error:', error);
    return NextResponse.json(
      { error: 'Failed to record contribution' },
      { status: 500 }
    );
  }
}
