/**
 * QubeTalk Channels API
 * GET /api/qubetalk/channels - List channels
 * POST /api/qubetalk/channels - Create new channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { qubetalkPersistence } from '@/services/qubetalk/qubetalkPersistence';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const tenant_id = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenant_id) {
      return NextResponse.json({
        success: false,
        error: 'tenant_id is required',
      }, { status: 400 });
    }

    const result = await qubetalkPersistence.listChannels({
      tenant_id,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      channels: result.items,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing channels:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list channels',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['tenant_id', 'participants'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    const channel = await qubetalkPersistence.createChannel({
      channel_id: `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: body.tenant_id,
      participants: Array.isArray(body.participants) ? body.participants : [body.participants],
    });

    // Create receipt for channel creation
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'qubetalk',
        action: 'create_channel',
        tenantId: body.tenant_id,
        result: {
          channelId: channel.channel_id,
          tenantId: body.tenant_id,
          participants: channel.participants,
        },
      });
    } catch (error) {
      console.warn('Failed to create channel creation receipt:', error);
    }

    return NextResponse.json({
      success: true,
      channel,
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create channel',
    }, { status: 500 });
  }
}
