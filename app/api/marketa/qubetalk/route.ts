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
    const { channel_id, tenant_id, message, recipient_agent, agent_name, priority } = body;

    // Validate required fields
    if (!channel_id || !tenant_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: channel_id, tenant_id, message' },
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

    // Store message in database
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: messageData, error: messageError } = await supabase
      .schema('marketa')
      .from('marketa_qubetalk_messages')
      .insert({
        message_id: messageId,
        channel_id,
        tenant_id,
        from_agent_id: 'aigent-marketa',
        to_agent_id: recipient_agent || null,
        message_type: 'outgoing',
        content: message,
        priority: priority || 'normal',
        status: 'sent',
        created_at: new Date().toISOString(),
        metadata: {
          agent_name: agent_name || 'Aigent Marketa',
          persona_id: personaId
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('Database error:', messageError);
      return NextResponse.json(
        { error: 'Failed to store message' },
        { status: 500 }
      );
    }

    // TODO: Send to actual QubeTalk service
    // For now, we'll just simulate the send
    console.log('QubeTalk message sent:', {
      messageId,
      channel_id,
      tenant_id,
      message,
      recipient_agent,
      agent_name,
      priority
    });

    return NextResponse.json({
      success: true,
      message_id: messageId,
      sent_at: messageData.created_at
    });

  } catch (error) {
    console.error('QubeTalk send error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel_id = searchParams.get('channel_id');
    const tenant_id = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate required fields
    if (!channel_id || !tenant_id) {
      return NextResponse.json(
        { error: 'Missing required fields: channel_id, tenant_id' },
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

    // Fetch messages from database
    const { data: messages, error: messagesError } = await supabase
      .schema('marketa')
      .from('marketa_qubetalk_messages')
      .select('*')
      .eq('channel_id', channel_id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (messagesError) {
      console.error('Database error:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Transform to QubeTalk message format
    const qubetalkMessages = messages.map(msg => ({
      message_id: msg.message_id,
      from_agent: {
        id: msg.from_agent_id,
        type: 'marketing',
        name: msg.metadata?.agent_name || 'Aigent Marketa'
      },
      to_agent: msg.to_agent_id ? { id: msg.to_agent_id } : undefined,
      content: {
        type: 'text',
        text: msg.content,
        metadata: msg.metadata
      },
      message_type: msg.message_type,
      created_at: msg.created_at,
      is_external: msg.from_agent_id !== 'aigent-marketa'
    }));

    return NextResponse.json({
      success: true,
      messages: qubetalkMessages,
      total: qubetalkMessages.length
    });

  } catch (error) {
    console.error('QubeTalk get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
