export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    // In a production environment, this would proxy to the actual backend service
    // const response = await fetch(`${process.env.CORE_API_URL}/metaqube/${id}`, {
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
    await new Promise(resolve => setTimeout(resolve, 800));

    // Check if ID exists in our mock database
    if (!id.match(/^[a-zA-Z0-9-_]{8,24}$/)) {
      return NextResponse.json(
        { error: "Invalid iQube ID format" },
        { status: 400 }
      );
    }

    // Generate a mock response based on the ID
    const mockMetaQube = {
      identifier: id,
      creator: `creator-${id.substring(0, 4)}`,
      ownerType: ["Individual", "Organization", "DAO", "Anonymous"][Math.floor(Math.random() * 4)],
      contentType: ["Data", "Content", "Tool", "Model", "Aigent", "Credential"][Math.floor(Math.random() * 6)],
      ownerIdentifiability: ["Identifiable", "Pseudonymous", "Anonymous"][Math.floor(Math.random() * 3)],
      transactionDate: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
      sensitivity: Math.floor(Math.random() * 10) + 1,
      verifiable: Math.floor(Math.random() * 10) + 1,
      accuracy: Math.floor(Math.random() * 10) + 1,
      risk: Math.floor(Math.random() * 10) + 1,
      description: `This is a sample MetaQube with ID ${id} generated for demonstration purposes.`,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
      updatedAt: new Date().toISOString(),
      hasBlakQube: Math.random() > 0.3,
      hasTokenQube: Math.random() > 0.7,
    };

    return NextResponse.json(mockMetaQube);

  } catch (error) {
    console.error('Error fetching MetaQube:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
