/**
 * QubeTalk Channel Messages API
 * GET /api/qubetalk/channels/[id]/messages - Get messages in channel
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getChannel,
  getChannelMessages,
} from '@/services/qubetalk/qubetalkStore';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const tenant_id = searchParams.get('tenant_id');
    
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

    // Verify channel exists
    const channel = await getChannel(id, tenant_id);
    if (!channel) {
      return NextResponse.json({
        error: 'Channel not found',
        code: 'CHANNEL_NOT_FOUND'
      }, { status: 404 });
    }

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const since = searchParams.get('since');

    // Get messages for this channel
    let channelMessages = await getChannelMessages(id, tenant_id, { limit, offset });

    // Filter by timestamp if provided
    if (since) {
      const sinceDate = new Date(since);
      channelMessages = channelMessages.filter(msg =>
        new Date(msg.created_at) > sinceDate
      );
    }

    // Sort by created_at ascending (oldest first)
    channelMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return NextResponse.json({
      messages: channelMessages,
      total: channelMessages.length,
      limit,
      offset,
      channel_id: id,
    });

  } catch (error: any) {
    console.error('QubeTalk channel messages error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to retrieve channel messages',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
