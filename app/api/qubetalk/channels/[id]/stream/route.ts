/**
 * QubeTalk Channel Stream API
 * GET /api/qubetalk/channels/[id]/stream - SSE stream for real-time messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { qubetalkPersistence } from '@/services/qubetalk/qubetalkPersistence';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const tenant_id = searchParams.get('tenant_id');
    const last_event_id = searchParams.get('last_event_id');

    if (!id) {
      return NextResponse.json({
        error: 'Channel ID is required',
        code: 'MISSING_ID'
      }, { status: 400 });
    }

    if (!tenant_id) {
      return NextResponse.json({
        error: 'tenant_id is required',
        code: 'MISSING_TENANT'
      }, { status: 400 });
    }

    // Verify channel exists using database
    const channel = await qubetalkPersistence.getChannel(id, tenant_id);
    if (!channel) {
      return NextResponse.json({
        error: 'Channel not found or access denied',
        code: 'CHANNEL_NOT_FOUND'
      }, { status: 404 });
    }

    // Create Server-Sent Events stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const connectEvent = `event: connect\ndata: ${JSON.stringify({
          type: 'connect',
          channel_id: id,
          tenant_id,
          timestamp: new Date().toISOString(),
          message: 'Connected to QubeTalk channel',
        })}\n\n`;
        
        controller.enqueue(encoder.encode(connectEvent));

        // Send recent messages if this is a new connection
        if (!last_event_id) {
          sendRecentMessages(controller, encoder, id, tenant_id);
        }

        // Set up heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          
          try {
            controller.enqueue(encoder.encode(heartbeat));
          } catch (error) {
            // Connection closed, stop heartbeat
            clearInterval(heartbeatInterval);
          }
        }, 30000); // 30 seconds

        // Listen for new messages (polling for now, could use pub/sub later)
        const pollInterval = setInterval(async () => {
          try {
            const messages = await qubetalkPersistence.listMessages(id, tenant_id, {
              limit: 5,
              offset: 0,
            });

            // Send new messages (simple approach - in production would track last sent)
            for (const message of messages.items.slice(-1)) { // Only send latest
              const messageEvent = `event: message\ndata: ${JSON.stringify({
                type: 'message',
                channel_id: id,
                message: message,
                timestamp: message.created_at,
              })}\n\n`;
              
              controller.enqueue(encoder.encode(messageEvent));
            }
          } catch (error) {
            console.error('Error polling for messages:', error);
          }
        }, 5000);

        // Clean up when connection closes
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
          controller.close();
        });
      },
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
  } catch (error) {
    console.error('Error setting up QubeTalk stream:', error);
    return NextResponse.json({
      error: 'Failed to establish stream',
      code: 'STREAM_ERROR'
    }, { status: 500 });
  }
}

async function sendRecentMessages(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  channelId: string,
  tenantId: string
) {
  try {
    const messages = await qubetalkPersistence.listMessages(channelId, tenantId, {
      limit: 50,
      offset: 0,
    });

    // Send recent messages as history
    const historyEvent = `event: history\ndata: ${JSON.stringify({
      type: 'history',
      channel_id: channelId,
      messages: messages.items,
      count: messages.items.length,
      timestamp: new Date().toISOString(),
    })}\n\n`;
    
    controller.enqueue(encoder.encode(historyEvent));
  } catch (error) {
    console.error('Error sending recent messages:', error);
  }
}
