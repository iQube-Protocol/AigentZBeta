/**
 * AA-API QubeTalk Integration
 * Enables external agents to communicate via QubeTalk using AA-API
 * 
 * POST /api/aa/qubetalk/send - Send message to QubeTalk channel
 * GET /api/aa/qubetalk/channels - List available channels
 * POST /api/aa/qubetalk/channels - Create new channel
 * GET /api/aa/qubetalk/messages - Get messages from channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { qubetalkPersistence } from '@/services/qubetalk/qubetalkPersistence';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// AA-API authentication for external agents
function authenticateExternalAgent(request: NextRequest): { success: boolean; agentId?: string; error?: string } {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const agentId = request.headers.get('x-agent-id');
  
  // For now, accept API key or Authorization header
  // In production, this would validate against external agent registry
  if (!apiKey && !authHeader) {
    return { success: false, error: 'Missing API key or authorization header' };
  }
  
  if (!agentId) {
    return { success: false, error: 'Missing agent ID header' };
  }
  
  // Simple validation - in production would verify against external agent registry
  const validApiKeys = [
    process.env.AA_API_KEY,
    process.env.EXTERNAL_AGENT_API_KEY,
    'demo-external-key', // For development
  ];
  
  const key = apiKey || authHeader?.replace('Bearer ', '');
  if (!validApiKeys.includes(key || '')) {
    return { success: false, error: 'Invalid API key' };
  }
  
  return { success: true, agentId };
}

// Send message to QubeTalk channel
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateExternalAgent(request);
    if (!auth.success) {
      return NextResponse.json({
        success: false,
        error: auth.error,
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { channel_id, tenant_id, message, recipient_agent } = body;
    
    // Validate required fields
    if (!channel_id || !tenant_id || !message) {
      return NextResponse.json({
        success: false,
        error: 'channel_id, tenant_id, and message are required',
      }, { status: 400 });
    }
    
    // Verify channel exists
    const channel = await qubetalkPersistence.getChannel(channel_id, tenant_id);
    if (!channel) {
      return NextResponse.json({
        success: false,
        error: 'Channel not found or access denied',
      }, { status: 404 });
    }
    
    // Create message from external agent
    const messageData = await qubetalkPersistence.createMessage({
      message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      channel_id,
      from_agent: {
        id: auth.agentId!,
        type: 'external',
        source: 'aa-api',
        name: body.agent_name || `External Agent ${auth.agentId}`,
      },
      type: 'text',
      content: message,
      metadata: {
        source: 'aa-api',
        external: true,
        recipient_agent: recipient_agent || null,
        priority: body.priority || 'normal',
        timestamp: new Date().toISOString(),
      },
    });
    
    // Create receipt for external message
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'qubetalk',
        action: 'external_message',
        tenantId: tenant_id,
        result: {
          messageId: messageData.message_id,
          channelId: channel_id,
          externalAgentId: auth.agentId,
          message: message.substring(0, 100), // Truncate for receipt
        },
      });
    } catch (error) {
      console.warn('Failed to create external message receipt:', error);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Message sent successfully via QubeTalk',
      data: {
        message_id: messageData.message_id,
        channel_id,
        sent_at: messageData.created_at,
        from_agent: auth.agentId,
      },
    });
  } catch (error) {
    console.error('Error sending external QubeTalk message:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to send message',
    }, { status: 500 });
  }
}

// List channels available to external agents
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateExternalAgent(request);
    if (!auth.success) {
      return NextResponse.json({
        success: false,
        error: auth.error,
      }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!tenant_id) {
      return NextResponse.json({
        success: false,
        error: 'tenant_id is required',
      }, { status: 400 });
    }
    
    // Get channels for the tenant
    const result = await qubetalkPersistence.listChannels({
      tenant_id,
      limit,
      offset: 0,
    });
    
    // Filter channels that allow external access
    const externalChannels = result.items.filter(channel =>
      channel.participants.includes('external')
    );
    
    return NextResponse.json({
      success: true,
      channels: externalChannels.map(channel => ({
        channel_id: channel.channel_id,
        tenant_id: channel.tenant_id,
        participants: channel.participants,
        created_at: channel.created_at,
        allows_external: true,
      })),
      total: externalChannels.length,
    });
  } catch (error) {
    console.error('Error listing external QubeTalk channels:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list channels',
    }, { status: 500 });
  }
}
