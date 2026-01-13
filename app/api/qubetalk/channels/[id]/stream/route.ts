/**
 * QubeTalk Channel Stream API
 * GET /api/qubetalk/channels/[id]/stream - SSE stream for real-time messages
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock storage for development
const channels = new Map();
const messages = new Map();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        error: 'Channel ID is required',
        code: 'MISSING_ID'
      }, { status: 400 });
    }

    // Verify channel exists
    const channel = channels.get(id);
    if (!channel) {
      return NextResponse.json({
        error: 'Channel not found',
        code: 'CHANNEL_NOT_FOUND'
      }, { status: 404 });
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        console.log(`SSE stream started for channel: ${id}`);

        // Send initial connection event
        const connectEvent = `event: connected\ndata: ${JSON.stringify({
          channel_id: id,
          connected_at: new Date().toISOString(),
          message: 'Connected to QubeTalk channel stream'
        })}\n\n`;
        
        controller.enqueue(encoder.encode(connectEvent));

        // Simulate real-time messages (in production, this would listen to actual events)
        let messageCount = 0;
        const interval = setInterval(() => {
          messageCount++;

          // Get recent messages for this channel
          const channelMessages = Array.from(messages.values())
            .filter(msg => msg.channel_id === id)
            .slice(-3); // Last 3 messages

          if (channelMessages.length > 0) {
            const messageEvent = `event: message\ndata: ${JSON.stringify({
              type: 'message_batch',
              channel_id: id,
              messages: channelMessages,
              timestamp: new Date().toISOString()
            })}\n\n`;
            
            controller.enqueue(encoder.encode(messageEvent));
          }

          // Send heartbeat every 30 seconds
          if (messageCount % 6 === 0) {
            const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({
              channel_id: id,
              timestamp: new Date().toISOString()
            })}\n\n`;
            
            controller.enqueue(encoder.encode(heartbeat));
          }

          // Stop after 2 minutes for demo
          if (messageCount >= 24) {
            clearInterval(interval);
            const closeEvent = `event: stream_closed\ndata: ${JSON.stringify({
              channel_id: id,
              closed_at: new Date().toISOString(),
              reason: 'demo_timeout'
            })}\n\n`;
            
            controller.enqueue(encoder.encode(closeEvent));
            controller.close();
          }
        }, 5000); // Every 5 seconds

        // Clean up on disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          console.log(`SSE stream closed for channel: ${id}`);
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error: any) {
    console.error('QubeTalk stream error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to create stream',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
