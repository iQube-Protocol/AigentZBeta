/**
 * QubeTalk Delegations API
 * POST /api/qubetalk/delegations - Create delegation request
 * GET /api/qubetalk/delegations - List delegations
 */

import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/services/receipts/receiptService';
import type { AgentReference } from '@/services/receipts/receiptService';
import { 
  createDelegation, 
  getDelegation, 
  getAllDelegations, 
  createChannel, 
  getChannel,
  createMessage,
  type DelegationData,
  type ChannelData,
  type MessageData
} from '@/services/qubetalk/qubetalkStore';

export const runtime = 'nodejs';

interface DelegationRequest {
  tenant_id: string;
  channel_id: string;
  request_id: string;
  from_agent: AgentReference;
  to_agent: AgentReference;
  task: {
    type: 'summarize' | 'compare' | 'classify' | 'route' | 'generate' | 'analyze';
    prompt: string;
    iqube_refs: string[];
    parameters?: Record<string, any>;
    expected_output?: string;
  };
  context?: {
    user_iq_refs?: string[];
    receipt_refs?: string[];
    session_context?: Record<string, any>;
    tenant_context?: Record<string, any>;
  };
  constraints?: {
    risk_tier?: 'low' | 'medium' | 'high';
    max_tokens?: number;
    timeout_seconds?: number;
    allowed_actions?: string[];
    forbidden_actions?: string[];
  };
  expires_at?: string;
}

interface DelegationResponse {
  delegation_id: string;
  tenant_id: string;
  channel_id: string;
  request_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  created_at: string;
  updated_at: string;
  from_agent: AgentReference;
  to_agent: AgentReference;
  task: DelegationRequest['task'];
  context?: DelegationRequest['context'];
  result?: {
    status: 'success' | 'error' | 'timeout';
    output?: string;
    data?: any;
    error_message?: string;
    completion_time_ms?: number;
  };
  receipt_ref?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DelegationRequest = await request.json();
    
    // Validate required fields
    const required = ['tenant_id', 'channel_id', 'request_id', 'from_agent', 'to_agent', 'task'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({
          error: `${field} is required`,
          code: 'MISSING_FIELD'
        }, { status: 400 });
      }
    }

    // Check for duplicate request_id
    const existingDelegations = getAllDelegations();
    for (const delegation of existingDelegations) {
      if (delegation.request_id === body.request_id) {
        return NextResponse.json({
          error: 'Request ID already exists',
          code: 'DUPLICATE_REQUEST',
          existing_request_id: body.request_id
        }, { status: 409 });
      }
    }

    // Create delegation
    const delegation_id = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const delegation: DelegationData = {
      delegation_id,
      tenant_id: body.tenant_id,
      channel_id: body.channel_id,
      request_id: body.request_id,
      status: 'pending',
      created_at: now,
      updated_at: now,
      from_agent: body.from_agent,
      to_agent: body.to_agent,
      task: body.task,
      context: body.context,
    };

    // Store delegation
    createDelegation(delegation);

    // Ensure channel exists
    const existingChannel = getChannel(body.channel_id);
    if (!existingChannel) {
      const channel: ChannelData = {
        channel_id: body.channel_id,
        tenant_id: body.tenant_id,
        participants: [body.from_agent.id, body.to_agent.id],
        created_at: now,
      };
      createChannel(channel);
    }

    console.log(`Created delegation: ${delegation_id} for tenant: ${body.tenant_id}`);

    // Create receipt for delegation creation
    try {
      await receiptService.createQubeTalkReceipt({
        delegationId: delegation_id,
        fromAgent: body.from_agent,
        toAgent: body.to_agent,
        taskCompleted: `Delegation created: ${body.task.type}`,
        tenantId: body.tenant_id,
      });
    } catch (receiptError) {
      console.warn('Failed to create delegation receipt:', receiptError);
    }

    return NextResponse.json(delegation, { status: 201 });

  } catch (error: any) {
    console.error('QubeTalk delegation POST error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to create delegation',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const tenant_id = searchParams.get('tenant_id');
    const channel_id = searchParams.get('channel_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Filter delegations
    let filtered = getAllDelegations();
    
    if (tenant_id) {
      filtered = filtered.filter(d => d.tenant_id === tenant_id);
    }
    
    if (channel_id) {
      filtered = filtered.filter(d => d.channel_id === channel_id);
    }
    
    if (status) {
      filtered = filtered.filter(d => d.status === status);
    }

    // Sort by created_at descending
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      delegations: paginated,
      total: filtered.length,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('QubeTalk delegation GET error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to retrieve delegations',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
