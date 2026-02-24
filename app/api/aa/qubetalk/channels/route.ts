/**
 * AA-API QubeTalk Channel Management
 * Enables external agents to create and manage QubeTalk channels
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
  
  if (!apiKey && !authHeader) {
    return { success: false, error: 'Missing API key or authorization header' };
  }
  
  if (!agentId) {
    return { success: false, error: 'Missing agent ID header' };
  }
  
  const validApiKeys = [
    process.env.AA_API_KEY,
    process.env.EXTERNAL_AGENT_API_KEY,
    'demo-external-key',
  ];
  
  const key = apiKey || authHeader?.replace('Bearer ', '');
  if (!validApiKeys.includes(key || '')) {
    return { success: false, error: 'Invalid API key' };
  }
  
  return { success: true, agentId };
}

// Create new channel for external agent communication
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
    const { tenant_id, participants, channel_name, description } = body;
    
    // Validate required fields
    if (!tenant_id) {
      return NextResponse.json({
        success: false,
        error: 'tenant_id is required',
      }, { status: 400 });
    }
    
    // Default participants include the external agent and system
    const defaultParticipants = [
      auth.agentId!,
      'system_copilot',
      ...(participants || []),
      'external', // Mark as external-accessible
    ];
    
    // Create channel
    const channel = await qubetalkPersistence.createChannel({
      channel_id: `ch_ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenant_id,
      participants: defaultParticipants,
    });
    
    // Create receipt for external channel creation
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'qubetalk',
        action: 'create_external_channel',
        tenantId: tenant_id,
        result: {
          channelId: channel.channel_id,
          externalAgentId: auth.agentId,
          participants: defaultParticipants,
        },
      });
    } catch (error) {
      console.warn('Failed to create external channel receipt:', error);
    }
    
    return NextResponse.json({
      success: true,
      message: 'External QubeTalk channel created successfully',
      channel: {
        channel_id: channel.channel_id,
        tenant_id: channel.tenant_id,
        participants: channel.participants,
        config: {
          name: channel_name || `External Channel ${auth.agentId}`,
          description: description || `Channel for external agent ${auth.agentId}`,
          created_by: 'external_agent',
          allows_external_access: true,
          external_agent_id: auth.agentId,
        },
        created_at: channel.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating external QubeTalk channel:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create channel',
    }, { status: 500 });
  }
}

// List messages in a channel for external agents
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
    const channel_id = searchParams.get('channel_id');
    const tenant_id = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!channel_id || !tenant_id) {
      return NextResponse.json({
        success: false,
        error: 'channel_id and tenant_id are required',
      }, { status: 400 });
    }
    
    // Verify channel exists and allows external access
    const channel = await qubetalkPersistence.getChannel(channel_id, tenant_id);
    if (!channel) {
      return NextResponse.json({
        success: false,
        error: 'Channel not found',
      }, { status: 404 });
    }
    
    if (!channel.participants.includes('external')) {
      return NextResponse.json({
        success: false,
        error: 'Channel does not allow external access',
      }, { status: 403 });
    }
    
    // Get messages
    const result = await qubetalkPersistence.listMessages(channel_id, tenant_id, {
      limit,
      offset: 0,
    });
    
    return NextResponse.json({
      success: true,
      messages: result.items.map(msg => ({
        message_id: msg.message_id,
        from_agent: msg.from_agent,
        content: msg.content,
        message_type: msg.type,
        created_at: msg.created_at,
        is_external: msg.from_agent?.type === 'external',
      })),
      total: result.total,
      channel_id,
    });
  } catch (error) {
    console.error('Error listing external QubeTalk messages:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list messages',
    }, { status: 500 });
  }
}
