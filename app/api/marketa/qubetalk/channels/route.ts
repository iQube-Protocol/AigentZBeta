import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCrmPersona } from '../_lib';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate required fields
    if (!tenant_id) {
      return NextResponse.json(
        { error: 'Missing required field: tenant_id' },
        { status: 400 }
      );
    }

    // Get current persona from request headers
    const personaId = request.headers.get('x-persona-id');
    if (!personaId) {
      return NextResponse.json(
        { error: 'Missing persona identification' },
        { status: 401 }
      );
    }

    // Get tenant info for validation
    const persona = await resolveCrmPersona(supabase, personaId);
    if (!persona) {
      return NextResponse.json(
        { error: 'Invalid persona' },
        { status: 401 }
      );
    }

    // Verify tenant access
    if (persona.tenant_id !== tenant_id) {
      return NextResponse.json(
        { error: 'Access denied: tenant mismatch' },
        { status: 403 }
      );
    }

    // Fetch channels from database
    const { data: channels, error: channelsError } = await supabase
      .schema('marketa')
      .from('marketa_qubetalk_channels')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (channelsError) {
      console.error('Database error:', channelsError);
      return NextResponse.json(
        { error: 'Failed to fetch channels' },
        { status: 500 }
      );
    }

    // Transform to QubeTalk channel format
    const qubetalkChannels = channels.map(channel => ({
      channel_id: channel.channel_id,
      tenant_id: channel.tenant_id,
      participants: channel.participants,
      config: channel.config,
      created_at: channel.created_at,
      allows_external: channel.allows_external
    }));

    return NextResponse.json({
      success: true,
      channels: qubetalkChannels,
      total: qubetalkChannels.length
    });

  } catch (error) {
    console.error('Get channels error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      tenant_id, 
      participants, 
      channel_name, 
      description 
    } = body;

    // Validate required fields
    if (!tenant_id || !participants || !Array.isArray(participants)) {
      return NextResponse.json(
        { error: 'Missing required fields: tenant_id, participants (array)' },
        { status: 400 }
      );
    }

    // Get current persona from request headers
    const personaId = request.headers.get('x-persona-id');
    if (!personaId) {
      return NextResponse.json(
        { error: 'Missing persona identification' },
        { status: 401 }
      );
    }

    // Get tenant info for validation
    const persona = await resolveCrmPersona(supabase, personaId);
    if (!persona) {
      return NextResponse.json(
        { error: 'Invalid persona' },
        { status: 401 }
      );
    }

    // Verify tenant access
    if (persona.tenant_id !== tenant_id) {
      return NextResponse.json(
        { error: 'Access denied: tenant mismatch' },
        { status: 403 }
      );
    }

    // Generate channel ID
    const channelId = `ch_${tenant_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create channel
    const { data: channelData, error: channelError } = await supabase
      .schema('marketa')
      .from('marketa_qubetalk_channels')
      .insert({
        channel_id: channelId,
        tenant_id,
        channel_name: channel_name || `Channel ${Date.now()}`,
        description: description || '',
        participants: [...participants, 'aigent-marketa'], // Always include Marketa
        channel_type: 'agent_to_agent',
        allows_external: true,
        allows_content_transfer: true,
        allows_iqube_transfer: false,
        status: 'active',
        config: {
          created_by: 'aigent-marketa',
          persona_id: persona.id
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (channelError) {
      console.error('Database error:', channelError);
      return NextResponse.json(
        { error: 'Failed to create channel' },
        { status: 500 }
      );
    }

    // Transform to response format
    const qubetalkChannel = {
      channel_id: channelData.channel_id,
      tenant_id: channelData.tenant_id,
      participants: channelData.participants,
      config: channelData.config,
      created_at: channelData.created_at,
      allows_external: channelData.allows_external
    };

    return NextResponse.json({
      success: true,
      channel: qubetalkChannel
    });

  } catch (error) {
    console.error('Create channel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
