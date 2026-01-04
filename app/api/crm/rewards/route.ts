/**
 * CRM Rewards API
 * 
 * GET /api/crm/rewards - List rewards
 * POST /api/crm/rewards - Propose rewards for top contributors
 * PATCH /api/crm/rewards - Update reward status (approve, pay, cancel)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import { TenantId, TokenType, RewardStatus } from '@/types/crm';
import { getCrmClient } from '@/services/crm/crmDataAccess';

async function fetchTenantPersonaMap(tenantId: string) {
  const client = getCrmClient();
  const map = new Map<string, { displayName: string | null; fioHandle: string | null }>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('personas')
      .select('id, display_name, fio_handle')
      .eq('tenant_id', tenantId)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    (data || []).forEach((row: any) => {
      map.set(row.id, { displayName: row.display_name || null, fioHandle: row.fio_handle || null });
    });

    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  return map;
}

function chunkArray<T>(arr: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function fetchWalletRewards(tenantId: string, personaId?: string) {
  const client = getCrmClient();
  let personaNameMap = new Map<string, { displayName: string | null; fioHandle: string | null }>();

  if (tenantId) {
    personaNameMap = await fetchTenantPersonaMap(tenantId);
  }

  const personaIds = personaId
    ? [personaId]
    : Array.from(personaNameMap.keys());

  if (personaIds.length === 0) return [];

  const transactions: any[] = [];
  const chunks = chunkArray(personaIds, 500);

  for (const chunk of chunks) {
    const { data, error } = await client
      .from('wallet_transactions')
      .select('id, persona_id, asset_code, amount, direction, source, metadata, created_at')
      .in('persona_id', chunk)
      .eq('direction', 'credit')
      .order('created_at', { ascending: false });

    if (error) throw error;
    transactions.push(...(data || []));
  }

  return transactions.map((row: any) => {
    const personaMeta = personaNameMap.get(row.persona_id);
    return {
      id: row.id,
      tenantId,
      personaId: row.persona_id,
      personaName: personaMeta?.displayName || personaMeta?.fioHandle || null,
      periodStart: row.created_at,
      periodEnd: row.created_at,
      pokwScoreUsed: 0,
      tokenType: row.asset_code || 'KNYT',
      amount: Number(row.amount || 0),
      status: 'paid',
      txHash: null,
      chainId: null,
      notes: row.metadata?.taskType || row.source || null,
      createdAt: row.created_at,
      updatedAt: row.created_at,
      source: 'wallet',
    };
  });
}

async function fetchGrantRewards(tenantId: string, personaId?: string, limit?: number, offset?: number) {
  const client = getCrmClient();
  let query = client
    .from('reward_grants')
    .select('id, persona_id, amount_knyt, base_amount_knyt, rep_multiplier, task_type, metadata, created_at, personas!inner(id, tenant_id, display_name, fio_handle)')
    .order('created_at', { ascending: false });

  if (limit != null && offset != null) {
    query = query.range(offset, offset + limit - 1);
  }

  if (tenantId) {
    query = query.eq('personas.tenant_id', tenantId);
  }
  if (personaId) query = query.eq('persona_id', personaId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    tenantId: row.personas?.tenant_id || tenantId,
    personaId: row.persona_id,
    personaName: row.personas?.display_name || row.personas?.fio_handle || null,
    periodStart: row.created_at,
    periodEnd: row.created_at,
    pokwScoreUsed: 0,
    tokenType: 'KNYT',
    amount: row.amount_knyt,
    status: 'paid',
    txHash: row.tx_hash || null,
    chainId: row.chain_id || null,
    notes: row.task_type || row.metadata?.taskType || null,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    source: 'grants',
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') as TenantId;
    const personaId = searchParams.get('personaId') || undefined;
    const status = searchParams.get('status') as RewardStatus | undefined;
    const tokenType = searchParams.get('tokenType') as TokenType | undefined;
    const source = searchParams.get('source') || 'crm';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (source === 'wallet') {
      const walletRewards = await fetchWalletRewards(tenantId, personaId || undefined);
      const sorted = walletRewards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const sliced = sorted.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: sliced,
        pagination: {
          limit,
          offset,
          count: walletRewards.length,
        },
      });
    }

    if (source === 'combined') {
      const [walletRewards, grantRewards] = await Promise.all([
        fetchWalletRewards(tenantId, personaId || undefined),
        fetchGrantRewards(tenantId, personaId || undefined),
      ]);

      const combined = [...walletRewards, ...grantRewards];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const sliced = combined.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: sliced,
        pagination: {
          limit,
          offset,
          count: combined.length,
        },
      });
    }

    if (source === 'grants') {
      const grantRewards = await fetchGrantRewards(tenantId, personaId || undefined, limit, offset);

      return NextResponse.json({
        success: true,
        data: grantRewards,
        pagination: {
          limit,
          offset,
          count: grantRewards.length,
        },
      });
    }

    const rewards = await crmService.listRewards(tenantId, {
      personaId,
      status,
      tokenType,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: rewards,
      pagination: {
        limit,
        offset,
        count: rewards.length,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /rewards error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      periodStart,
      periodEnd,
      budget,
      topN,
    } = body;

    if (!tenantId || !periodStart || !periodEnd || !budget) {
      return NextResponse.json(
        { error: 'tenantId, periodStart, periodEnd, and budget are required' },
        { status: 400 }
      );
    }

    // Validate budget has at least one token type
    const hasValidBudget = Object.values(budget).some((v: any) => v > 0);
    if (!hasValidBudget) {
      return NextResponse.json(
        { error: 'budget must have at least one token type with amount > 0' },
        { status: 400 }
      );
    }

    const result = await crmService.proposeRewards({
      tenantId,
      periodStart,
      periodEnd,
      budget,
      topN,
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /rewards error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to propose rewards' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      rewardId,
      status,
      txHash,
      chainId,
      notes,
    } = body;

    if (!tenantId || !rewardId) {
      return NextResponse.json(
        { error: 'tenantId and rewardId are required' },
        { status: 400 }
      );
    }

    const reward = await crmService.updateReward(tenantId, rewardId, {
      status,
      txHash,
      chainId,
      notes,
    });

    return NextResponse.json({
      success: true,
      data: reward,
    });
  } catch (error: any) {
    console.error('[CRM API] PATCH /rewards error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update reward' },
      { status: 500 }
    );
  }
}
