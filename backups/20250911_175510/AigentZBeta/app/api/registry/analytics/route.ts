import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '30d';
    
    // In a production environment, this would proxy to the actual registry service
    // const response = await fetch(`${process.env.REGISTRY_API_URL}/analytics?timeRange=${timeRange}`, {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.API_KEY}`
    //   }
    // });
    // 
    // if (!response.ok) {
    //   const errorData = await response.json();
    //   return NextResponse.json(errorData, { status: response.status });
    // }
    // 
    // const data = await response.json();
    // return NextResponse.json(data);

    // For development, simulate a response
    // Add a delay to simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Generate mock analytics data based on the time range
    let multiplier = 1;
    switch (timeRange) {
      case '7d':
        multiplier = 0.3;
        break;
      case '30d':
        multiplier = 1;
        break;
      case '90d':
        multiplier = 2.5;
        break;
      case '1y':
        multiplier = 8;
        break;
      case 'all':
        multiplier = 12;
        break;
    }

    const totalTemplates = Math.floor(12 * multiplier);
    const totalInstances = Math.floor(87 * multiplier);

    const mockAnalyticsData = {
      totalTemplates,
      totalInstances,
      templatesByType: {
        "Data": Math.floor(4 * multiplier),
        "Content": Math.floor(3 * multiplier),
        "Tool": Math.floor(2 * multiplier),
        "Model": Math.floor(1 * multiplier),
        "Aigent": Math.floor(2 * multiplier)
      },
      instancesByRisk: [
        Math.floor(2 * multiplier),
        Math.floor(5 * multiplier),
        Math.floor(8 * multiplier),
        Math.floor(12 * multiplier),
        Math.floor(15 * multiplier),
        Math.floor(18 * multiplier),
        Math.floor(10 * multiplier),
        Math.floor(8 * multiplier),
        Math.floor(6 * multiplier),
        Math.floor(3 * multiplier)
      ],
      instancesByAccuracy: [
        Math.floor(1 * multiplier),
        Math.floor(3 * multiplier),
        Math.floor(5 * multiplier),
        Math.floor(7 * multiplier),
        Math.floor(10 * multiplier),
        Math.floor(15 * multiplier),
        Math.floor(18 * multiplier),
        Math.floor(14 * multiplier),
        Math.floor(9 * multiplier),
        Math.floor(5 * multiplier)
      ],
      instancesByVerifiability: [
        Math.floor(3 * multiplier),
        Math.floor(4 * multiplier),
        Math.floor(6 * multiplier),
        Math.floor(9 * multiplier),
        Math.floor(12 * multiplier),
        Math.floor(16 * multiplier),
        Math.floor(14 * multiplier),
        Math.floor(11 * multiplier),
        Math.floor(8 * multiplier),
        Math.floor(4 * multiplier)
      ],
      recentActivity: [
        { date: "2025-08-30T14:22:00Z", action: "Created Template", id: "template-007" },
        { date: "2025-08-29T09:15:00Z", action: "Added Instance", id: "instance-042" },
        { date: "2025-08-28T16:30:00Z", action: "Minted TokenQube", id: "token-031" },
        { date: "2025-08-27T11:45:00Z", action: "Updated Template", id: "template-003" },
        { date: "2025-08-26T13:20:00Z", action: "Added Instance", id: "instance-041" }
      ]
    };

    return NextResponse.json(mockAnalyticsData);

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
