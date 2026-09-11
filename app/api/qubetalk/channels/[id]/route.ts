/**
 * QubeTalk Individual Channel API
 * GET /api/qubetalk/channels/[id] - Get specific channel
 * PUT /api/qubetalk/channels/[id] - Update channel
 * DELETE /api/qubetalk/channels/[id] - Delete channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireChannelAccess } from '@/app/api/qubetalk/_lib/requireChannelAccess';
import { qubetalkPersistence } from '@/services/qubetalk/qubetalkPersistence';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Tenant scope is RESOLVED from the caller, never trusted from the query
    // string — the 2026-07-28 anonymous-read leak. Fails closed on no persona.
    const gate = await requireChannelAccess(request, searchParams.get('tenant_id'));
    if (!gate.ok) return gate.response;
    const tenant_id = gate.access.tenantId;
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Channel ID is required',
      }, { status: 400 });
    }


    const channel = await qubetalkPersistence.getChannel(id, tenant_id);

    if (!channel) {
      return NextResponse.json({
        success: false,
        error: 'Channel not found',
      }, { status: 404 });
    }

    // Get channel stats
    const stats = await qubetalkPersistence.getChannelStats(id, tenant_id);

    return NextResponse.json({
      success: true,
      channel: {
        ...channel,
        stats,
      },
    });
  } catch (error) {
    console.error('Error getting channel:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get channel',
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const body = await request.json();
    
    // Write paths were ungated too: an anonymous caller could modify or delete
    // a channel, which is worse than the read leak that surfaced the incident.
    const gate = await requireChannelAccess(request, searchParams.get('tenant_id'));
    if (!gate.ok) return gate.response;
    const tenant_id = gate.access.tenantId;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Channel ID is required',
      }, { status: 400 });
    }


    // Check if channel exists
    const existingChannel = await qubetalkPersistence.getChannel(id, tenant_id);
    if (!existingChannel) {
      return NextResponse.json({
        success: false,
        error: 'Channel not found',
      }, { status: 404 });
    }

    const updatedChannel = await qubetalkPersistence.updateChannel(id, body, tenant_id);

    return NextResponse.json({
      success: true,
      channel: updatedChannel,
    });
  } catch (error) {
    console.error('Error updating channel:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update channel',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Write paths were ungated too: an anonymous caller could modify or delete
    // a channel, which is worse than the read leak that surfaced the incident.
    const gate = await requireChannelAccess(request, searchParams.get('tenant_id'));
    if (!gate.ok) return gate.response;
    const tenant_id = gate.access.tenantId;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Channel ID is required',
      }, { status: 400 });
    }


    // Check if channel exists
    const existingChannel = await qubetalkPersistence.getChannel(id, tenant_id);
    if (!existingChannel) {
      return NextResponse.json({
        success: false,
        error: 'Channel not found',
      }, { status: 404 });
    }

    const deleted = await qubetalkPersistence.deleteChannel(id, tenant_id);

    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete channel',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Channel deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete channel',
    }, { status: 500 });
  }
}
