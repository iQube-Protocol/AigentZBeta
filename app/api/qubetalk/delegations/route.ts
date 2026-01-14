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
  result?: DelegationResponse['result'];
  receipt_ref?: string;
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
    const missingField = !body.tenant_id
      ? 'tenant_id'
      : !body.channel_id
        ? 'channel_id'
        : !body.request_id
          ? 'request_id'
          : !body.from_agent
            ? 'from_agent'
            : !body.to_agent
              ? 'to_agent'
              : !body.task
                ? 'task'
                : null;

    if (missingField) {
      return NextResponse.json({
        error: `${missingField} is required`,
        code: 'MISSING_FIELD'
      }, { status: 400 });
    }

    const delegation = await createDelegation({
      delegation_id: `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: body.tenant_id,
      channel_id: body.channel_id,
      request_id: body.request_id,
      status: 'pending',
      from_agent: body.from_agent,
      to_agent: body.to_agent,
      task: body.task,
      context: body.context,
      result: body.result,
      receipt_ref: body.receipt_ref,
    });

    // Create receipt for delegation
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'qubetalk',
        action: 'create_delegation',
        tenantId: body.tenant_id,
        result: {
          delegationId: delegation.delegation_id,
          requestId: body.request_id,
          fromAgent: body.from_agent.id,
          toAgent: body.to_agent.id,
          status: delegation.status,
        },
      });
    } catch (error) {
      console.warn('Failed to create delegation receipt:', error);
    }

    return NextResponse.json({
      success: true,
      delegation,
    });
  } catch (error) {
    console.error('Error creating delegation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create delegation',
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

    if (!tenant_id) {
      return NextResponse.json({
        success: false,
        error: 'tenant_id is required',
      }, { status: 400 });
    }

    const delegations = await getAllDelegations(tenant_id, {
      channel_id: channel_id || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      delegations,
      total: delegations.length,
      limit,
      offset,
      filters: {
        tenant_id,
        channel_id,
        status,
      },
    });
  } catch (error) {
    console.error('Error listing delegations:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list delegations',
    }, { status: 500 });
  }
}
