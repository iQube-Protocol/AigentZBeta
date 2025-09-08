import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activationCode, ownerIdentifier } = body;
    
    if (!activationCode || !ownerIdentifier) {
      return NextResponse.json(
        { error: "Missing required parameters: activationCode and ownerIdentifier are required" },
        { status: 400 }
      );
    }

    // In a production environment, this would proxy to the actual backend service
    // const response = await fetch(`${process.env.CORE_API_URL}/iqube/activate`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.API_KEY}`
    //   },
    //   body: JSON.stringify({ activationCode, ownerIdentifier })
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

    // Validate activation code format
    if (!activationCode.match(/^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/)) {
      return NextResponse.json(
        { error: "Invalid activation code format. Expected format: XXXXXX-XXXXXX-XXXXXX" },
        { status: 400 }
      );
    }

    // Generate a mock response
    const mockResponse = {
      success: true,
      message: "iQube activated successfully",
      iqubeId: `iq-${Math.random().toString(36).substring(2, 10)}`,
      activationDate: new Date().toISOString(),
      owner: ownerIdentifier,
      expiresAt: new Date(Date.now() + 31536000000).toISOString(), // 1 year from now
      permissions: ["read", "write", "activate", "transfer"],
    };

    return NextResponse.json(mockResponse);

  } catch (error) {
    console.error('Error activating iQube:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
