import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      channel_id, 
      tenant_id, 
      content, 
      recipient_agent, 
      transfer_method = 'raw_json' 
    } = body;

    // Validate required fields
    if (!channel_id || !tenant_id || !content || !recipient_agent) {
      return NextResponse.json(
        { error: 'Missing required fields: channel_id, tenant_id, content, recipient_agent' },
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
    const { data: persona, error: personaError } = await supabase
      .from('crm_personas')
      .select('tenant_id')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
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

    // Create transfer record
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: transferData, error: transferError } = await supabase
      .schema('marketa')
      .from('marketa_content_transfers')
      .insert({
        transfer_id: transferId,
        channel_id,
        tenant_id,
        from_agent_id: 'aigent-marketa',
        to_agent_id: recipient_agent,
        content_type: content.type,
        content_name: content.name,
        content_data: content.data,
        content_metadata: content.metadata || {},
        status: 'pending',
        transfer_method,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (transferError) {
      console.error('Database error:', transferError);
      return NextResponse.json(
        { error: 'Failed to create transfer record' },
        { status: 500 }
      );
    }

    // Create message for content transfer
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const contentMessage = JSON.stringify({
      type: 'content_transfer',
      content: content,
      transfer_id: transferId,
      transfer_method
    });

    const { data: messageData, error: messageError } = await supabase
      .schema('marketa')
      .from('marketa_qubetalk_messages')
      .insert({
        message_id: messageId,
        channel_id,
        tenant_id,
        from_agent_id: 'aigent-marketa',
        to_agent_id: recipient_agent,
        message_type: 'content_transfer',
        content: contentMessage,
        priority: 'high',
        status: 'sent',
        created_at: new Date().toISOString(),
        metadata: {
          transfer_id: transferId,
          content_type: content.type,
          agent_name: 'Aigent Marketa',
          persona_id: personaId
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('Database error:', messageError);
      return NextResponse.json(
        { error: 'Failed to create message record' },
        { status: 500 }
      );
    }

    // Update transfer status to sent
    await supabase
      .schema('marketa')
      .from('marketa_content_transfers')
      .update({ 
        status: 'sent', 
        sent_at: new Date().toISOString() 
      })
      .eq('transfer_id', transferId);

    // TODO: Send to actual QubeTalk service
    console.log('Content transfer initiated:', {
      transferId,
      messageId,
      channel_id,
      tenant_id,
      content: content.name,
      recipient_agent,
      transfer_method
    });

    return NextResponse.json({
      success: true,
      transfer_id: transferId,
      message_id: messageId,
      status: 'sent',
      sent_at: transferData.created_at
    });

  } catch (error) {
    console.error('Content transfer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const { data: persona, error: personaError } = await supabase
      .from('crm_personas')
      .select('tenant_id')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
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

    // Fetch transfers from database
    const { data: transfers, error: transfersError } = await supabase
      .schema('marketa')
      .from('marketa_content_transfers')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (transfersError) {
      console.error('Database error:', transfersError);
      return NextResponse.json(
        { error: 'Failed to fetch transfers' },
        { status: 500 }
      );
    }

    // Transform to response format
    const contentTransfers = transfers.map(transfer => ({
      id: transfer.transfer_id,
      from_agent: transfer.from_agent_id,
      to_agent: transfer.to_agent_id,
      content_type: transfer.content_type,
      content: {
        id: transfer.transfer_id,
        type: transfer.content_type,
        name: transfer.content_name,
        data: transfer.content_data,
        metadata: transfer.content_metadata,
        created_at: transfer.created_at
      },
      status: transfer.status,
      created_at: transfer.created_at,
      iqube_ref: transfer.iqube_ref,
      transfer_method: transfer.transfer_method
    }));

    return NextResponse.json({
      success: true,
      transfers: contentTransfers,
      total: contentTransfers.length
    });

  } catch (error) {
    console.error('Get content transfers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
