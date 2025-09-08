import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // In a production environment, this would proxy to the actual registry service
    // const response = await fetch(`${process.env.REGISTRY_API_URL}/templates`, {
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

    // Generate mock templates
    const mockTemplates = [
      {
        id: "template-001",
        name: "Personal Data iQube",
        description: "Template for storing and managing personal identity information with high security and privacy controls.",
        riskScore: 8,
        accuracyScore: 9,
        verifiabilityScore: 7,
        createdAt: "2025-08-15T12:00:00Z"
      },
      {
        id: "template-002",
        name: "Financial Transaction iQube",
        description: "Secure template for recording and verifying financial transactions with audit trails.",
        riskScore: 6,
        accuracyScore: 10,
        verifiabilityScore: 9,
        createdAt: "2025-08-10T14:30:00Z"
      },
      {
        id: "template-003",
        name: "Content Verification iQube",
        description: "Template for verifying the authenticity and provenance of digital content and media.",
        riskScore: 4,
        accuracyScore: 8,
        verifiabilityScore: 10,
        createdAt: "2025-08-05T09:15:00Z"
      },
      {
        id: "template-004",
        name: "Credential iQube",
        description: "Template for storing and verifying professional credentials and certifications.",
        riskScore: 5,
        accuracyScore: 9,
        verifiabilityScore: 8,
        createdAt: "2025-07-28T16:45:00Z"
      },
      {
        id: "template-005",
        name: "Health Data iQube",
        description: "Secure template for managing sensitive health information with privacy controls.",
        riskScore: 9,
        accuracyScore: 9,
        verifiabilityScore: 6,
        createdAt: "2025-07-20T11:30:00Z"
      },
      {
        id: "template-006",
        name: "Research Data iQube",
        description: "Template for storing and sharing scientific research data with verification mechanisms.",
        riskScore: 3,
        accuracyScore: 8,
        verifiabilityScore: 9,
        createdAt: "2025-07-15T13:20:00Z"
      }
    ];

    return NextResponse.json(mockTemplates);

  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
