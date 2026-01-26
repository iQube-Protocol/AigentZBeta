import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock KPI stats - replace with real database calls
    const kpiStats = {
      packsPendingApproval: 3,
      packsApproved: 12,
      packsSent: 45,
      rewardsKnyt: 125000,
      rewardsQc: 8500
    };

    return NextResponse.json(kpiStats);
  } catch (error: any) {
    console.error('Failed to fetch KPI stats:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch KPI stats' },
      { status: 500 }
    );
  }
}
