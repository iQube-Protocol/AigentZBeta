import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock campaigns data - replace with real database calls
    const campaigns = [
      {
        id: '1',
        name: 'Q1 Product Launch',
        description: 'Multi-channel campaign for new product line',
        status: 'active',
        budget: 50000,
        channels: ['email', 'social', 'web'],
        created_at: new Date().toISOString(),
        performance: {
          impressions: 125000,
          clicks: 3200,
          conversions: 128,
          revenue: 25600
        }
      },
      {
        id: '2',
        name: 'Brand Awareness Campaign',
        description: 'Increase brand visibility across platforms',
        status: 'paused',
        budget: 30000,
        channels: ['social', 'influencer'],
        created_at: new Date().toISOString(),
        performance: {
          impressions: 89000,
          clicks: 2100,
          conversions: 84,
          revenue: 16800
        }
      }
    ];

    return NextResponse.json({
      success: true,
      campaigns
    });
  } catch (error: any) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}
