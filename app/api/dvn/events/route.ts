import { NextRequest, NextResponse } from 'next/server';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '@/services/dvn/cross_chain_service.did';

const CANISTER_ID = 'sp5ye-2qaaa-aaaao-qkqla-cai';
const IC_HOST = 'https://ic0.app';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || 'default';
    const limit = parseInt(searchParams.get('limit') || '10');

    const agent = new HttpAgent({ host: IC_HOST });
    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey();
    }

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: CANISTER_ID,
    });

    const messages = await actor.get_messages_for_persona(agentId, limit);
    
    const events = messages.map((msg: any) => ({
      id: msg.id,
      timestamp: Number(msg.timestamp),
      type: msg.message_type,
      status: msg.status,
      data: msg.payload,
    }));

    return NextResponse.json({
      success: true,
      events,
      agentId,
      limit,
    });

  } catch (error) {
    console.error('[DVN Events] Error:', error);
    return NextResponse.json({
      success: true,
      events: [],
      agentId: 'default',
      error: error instanceof Error ? error.message : 'Failed to fetch',
    });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
