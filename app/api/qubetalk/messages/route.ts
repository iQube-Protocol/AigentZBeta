/**
 * QubeTalk Messages API
 * POST /api/qubetalk/messages - Send message to channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/services/receipts/receiptService';
import type { AgentReference } from '@/services/receipts/receiptService';
import { 
  getChannel, 
  createMessage,
  type MessageData
} from '@/services/qubetalk/qubetalkStore';

export const runtime = 'nodejs';

interface MessageRequest {
  channel_id: string;
  message_id?: string;
  in_reply_to?: string;
  from_agent: AgentReference;
  type: 'request' | 'response' | 'event' | 'error';
  content: string;
  iqube_refs?: string[];
  receipt_ref?: string;
  metadata?: Record<string, any>;
}

interface MessageResponse {
  message_id: string;
  channel_id: string;
  in_reply_to?: string;
  from_agent: AgentReference;
  type: string;
  content: string;
  created_at: string;
  iqube_refs?: string[];
  receipt_ref?: string;
  metadata?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: MessageRequest = await request.json();
    
    // Validate required fields
    const required = ['channel_id', 'from_agent', 'type', 'content'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({
          error: `${field} is required`,
          code: 'MISSING_FIELD'
        }, { status: 400 });
      }
    }

    // Verify channel exists
    const channel = getChannel(body.channel_id);
    if (!channel) {
      return NextResponse.json({
        error: 'Channel not found',
        code: 'CHANNEL_NOT_FOUND'
      }, { status: 404 });
    }

    // Verify sender is channel participant
    if (!channel.participants.includes(body.from_agent.id)) {
      return NextResponse.json({
        error: 'Sender not authorized for this channel',
        code: 'UNAUTHORIZED'
      }, { status: 403 });
    }

    // Create message
    const message_id = body.message_id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const message: MessageData = {
      message_id,
      channel_id: body.channel_id,
      in_reply_to: body.in_reply_to,
      from_agent: body.from_agent,
      type: body.type,
      content: body.content,
      created_at: now,
      iqube_refs: body.iqube_refs,
      receipt_ref: body.receipt_ref,
      metadata: body.metadata,
    };

    // Store message
    createMessage(message);

    console.log(`Created message: ${message_id} in channel: ${body.channel_id}`);

    // Create receipt for message
    if (body.type === 'response' || body.type === 'error') {
      try {
        await receiptService.createQubeTalkReceipt({
          delegationId: body.metadata?.delegation_id || 'unknown',
          fromAgent: body.from_agent,
          toAgent: { id: 'system', role: 'system', name: 'System' } as AgentReference,
          taskCompleted: `Message sent: ${body.type}`,
          resultData: { message_id, content_length: body.content.length },
          tenantId: channel.tenant_id,
        });
      } catch (receiptError) {
        console.warn('Failed to create message receipt:', receiptError);
      }
    }

    return NextResponse.json(message, { status: 201 });

  } catch (error: any) {
    console.error('QubeTalk message POST error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to send message',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
