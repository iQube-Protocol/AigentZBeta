import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meta, blak, coreRef } = body;
    
    if (!meta || !coreRef) {
      return NextResponse.json(
        { error: "Missing required parameters: meta and coreRef are required" },
        { status: 400 }
      );
    }

    // In a production environment, this would proxy to the actual registry service
    // const response = await fetch(`${process.env.REGISTRY_API_URL}/iqube`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.API_KEY}`
    //   },
    //   body: JSON.stringify({ meta, blak, coreRef })
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate a mock response
    const mockResponse = {
      success: true,
      message: "iQube registered successfully",
      registryId: `reg-${Math.random().toString(36).substring(2, 10)}`,
      coreRef,
      metaIdentifier: meta.identifier,
      registeredAt: new Date().toISOString(),
      registryUrl: `/registry/view/${meta.identifier}`,
      templateId: `template-00${Math.floor(Math.random() * 6) + 1}`,
    };

    return NextResponse.json(mockResponse);

  } catch (error) {
    console.error('Error registering iQube:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
