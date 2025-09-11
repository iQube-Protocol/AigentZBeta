import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentKey, message, context } = body;
    
    if (!agentKey || !message) {
      return NextResponse.json(
        { error: "Missing required parameters: agentKey and message are required" },
        { status: 400 }
      );
    }

    // In a production environment, this would proxy to the actual backend service
    // const response = await fetch(`${process.env.BACKEND_URL}/agents/${agentKey}/chat`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.API_KEY}`
    //   },
    //   body: JSON.stringify({ message, context })
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

    // Generate a response based on the agent key and message
    let responseText = '';
    
    switch (agentKey) {
      case 'researcher':
        responseText = `Based on my research capabilities, I have analyzed your query: "${message}". Here's what I found in the context provided: ${context ? 'The context contains relevant information about ' + context.substring(0, 50) + '...' : 'No context was provided for analysis.'}`;
        break;
      case 'analyst':
        responseText = `I have analyzed your request: "${message}". My analytical assessment is that ${Math.random() > 0.5 ? 'there are several factors to consider' : 'the data suggests a clear pattern'}. ${context ? 'The context you provided offers additional insights.' : ''}`;
        break;
      case 'creator':
        responseText = `Creative response to "${message}": I have generated a unique approach that combines innovative thinking with practical application. ${context ? 'I have incorporated elements from your context to enhance creativity.' : ''}`;
        break;
      case 'critic':
        responseText = `Critical analysis of "${message}": I have identified several points that warrant further examination. ${Math.random() > 0.5 ? 'The approach has merit but could be refined in specific areas.' : 'There are fundamental issues that need to be addressed.'} ${context ? 'The context provides important background for this critique.' : ''}`;
        break;
      case 'synthesizer':
        responseText = `Synthesizing information about "${message}": I have combined multiple perspectives to form a cohesive understanding. ${context ? 'The context you provided has been integrated into this synthesis.' : 'Without additional context, this synthesis is based on general principles.'}`;
        break;
      default:
        responseText = `I have processed your message: "${message}". ${context ? 'I have taken the provided context into account.' : ''}`;
    }

    return NextResponse.json({
      response: responseText,
      agentKey,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing chat request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
