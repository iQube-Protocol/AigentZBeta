/**
 * CRM Personas API
 * 
 * GET /api/crm/personas - List personas for a tenant
 * POST /api/crm/personas - Create a new persona
 * 
 * Auto-provisions registry profile on persona creation (DiDQube compliant)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import * as db from '@/services/crm/crmDataAccess';
import { getCrmClient } from '@/services/crm/crmDataAccess';
import { TenantId } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get('tenantId') as TenantId;
    const personaId = searchParams.get('personaId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;
    const source = searchParams.get('source') || 'crm';
    const includeCount = searchParams.get('includeCount') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';
    const stats = searchParams.get('stats') === 'true';
    const tenantStats = searchParams.get('tenantStats') === 'true';

    const isTenantStatsAll = tenantStats && (!tenantIdParam || tenantIdParam === 'all');

    if (!tenantIdParam && !isTenantStatsAll) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const tenantId = source === 'live'
      ? await resolveTenantId(tenantIdParam)
      : tenantIdParam;

    if (source === 'live') {
      const client = getCrmClient();

      if (stats || tenantStats) {
        const statusBuckets = ['active', 'pending', 'suspended', 'inactive', 'deleted'];
        const byStatus: Record<string, number> = {};

        const baseQuery = client
          .from('personas')
          .select('id', { count: 'exact', head: true });

        const totalQuery = tenantId && !isTenantStatsAll
          ? baseQuery.eq('tenant_id', tenantId)
          : baseQuery;

        const { count: totalCount, error: totalError } = await totalQuery;

        if (totalError) throw totalError;

        if (!isTenantStatsAll) {
          for (const status of statusBuckets) {
            const { count, error } = await client
              .from('personas')
              .select('id', { count: 'exact', head: true })
              .eq('tenant_id', tenantId)
              .eq('status', status);
            if (error) throw error;
            byStatus[status] = count ?? 0;
          }
        }

        let byTenant: Record<string, number> | undefined;

        if (tenantStats) {
          const tenantCounts = new Map<string, number>();
          const pageSize = 1000;
          let tenantOffset = 0;

          while (true) {
            let tenantQuery = client
              .from('personas')
              .select('tenant_id')
              .range(tenantOffset, tenantOffset + pageSize - 1);

            if (tenantId && !isTenantStatsAll) {
              tenantQuery = tenantQuery.eq('tenant_id', tenantId);
            }

            const { data: rows, error } = await tenantQuery;

            if (error) throw error;

            (rows || []).forEach((row: { tenant_id: string | null }) => {
              if (!row.tenant_id) return;
              tenantCounts.set(row.tenant_id, (tenantCounts.get(row.tenant_id) || 0) + 1);
            });

            if (!rows || rows.length < pageSize) break;
            tenantOffset += pageSize;
          }

          byTenant = Object.fromEntries(tenantCounts.entries());
        }

        return NextResponse.json({
          success: true,
          data: {
            total: totalCount ?? 0,
            ...(Object.keys(byStatus).length ? { byStatus } : {}),
            ...(byTenant ? { byTenant } : {}),
          },
        });
      }

      if (personaId) {
        const baseSelect = 'id, display_name, fio_handle, status, reputation_bucket, reputation_tier, tenant_id, created_at, updated_at';
        let { data, error } = await client
          .from('personas')
          .select(baseSelect)
          .eq('tenant_id', tenantId)
          .eq('id', personaId)
          .maybeSingle();

        if (!data && (error?.code === 'PGRST116' || error == null)) {
          const fallback = await client
            .from('personas')
            .select(baseSelect)
            .eq('id', personaId)
            .maybeSingle();
          data = fallback.data;
          error = fallback.error;
        }

        if (error) {
          if (error.code === 'PGRST116') {
            return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
          }
          throw error;
        }

        if (!data) {
          return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
        }

        const reputationBucket = mapReputationBucket(data.reputation_tier, data.reputation_bucket);
        const persona = {
          id: data.id,
          tenantId: data.tenant_id,
          displayName: data.display_name || data.fio_handle || data.id?.slice(0, 12) + '...',
          email: data.fio_handle || null,
          personaState: mapStatusToPersonaState(data.status),
          reputationBucket,
          totalPokw: 0,
          contributionCount: 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };

        return NextResponse.json({ success: true, data: persona });
      }

      let query = client
        .from('personas')
        .select('id, display_name, fio_handle, status, reputation_bucket, reputation_tier, tenant_id, created_at, updated_at', {
          count: includeCount || countOnly ? 'exact' : undefined,
        })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`display_name.ilike.%${search}%,fio_handle.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const personas = (data || []).map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        displayName: row.display_name || row.fio_handle || row.id?.slice(0, 12) + '...',
        email: row.fio_handle || null,
        personaState: mapStatusToPersonaState(row.status),
        reputationBucket: mapReputationBucket(row.reputation_tier, row.reputation_bucket),
        totalPokw: 0,
        contributionCount: 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return NextResponse.json({
        success: true,
        data: countOnly ? [] : personas,
        pagination: {
          limit,
          offset,
          count: count ?? personas.length,
        },
      });
    }

    // If personaId provided, get persona summary
    if (personaId) {
      const summary = await crmService.getPersonaSummary(tenantId, personaId);
      if (!summary) {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: summary });
    }

    if (countOnly || includeCount) {
      const client = getCrmClient();
      const { count, error } = await client
        .from('crm_personas')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          limit,
          offset,
          count: count ?? 0,
        },
      });
    }

    // List personas (CRM source)
    const personas = await crmService.listPersonas(tenantId, { limit, offset, search });
    
    return NextResponse.json({
      success: true,
      data: personas,
      pagination: {
        limit,
        offset,
        count: personas.length,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /personas error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch personas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      displayName,
      email,
      kybeDid,
      rootDidProxyId,
      externalUserId,
      primaryWalletAddress,
      authProfileId,
      primaryFranchiseId,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Create persona
    const persona = await crmService.createPersona({
      tenantId,
      displayName,
      email,
      kybeDid,
      rootDidProxyId,
      externalUserId,
      primaryWalletAddress,
      authProfileId,
      primaryFranchiseId,
    });

    // Auto-provision registry profile if kybeDid provided
    // This ensures any account signup creates a registry profile (DiDQube compliant)
    if (kybeDid) {
      const tenant = await db.getTenant(tenantId);
      await db.ensureRegistryProfile({
        kybeDid,
        displayName,
        originLayer: 'tenant',
        originTenantId: tenantId,
        originFranchiseId: tenant?.franchiseId,
      });
    }

    return NextResponse.json({
      success: true,
      data: persona,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /personas error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create persona' },
      { status: 500 }
    );
  }
}

async function resolveTenantId(tenantId?: string | null) {
  if (!tenantId || tenantId === 'all') return tenantId || null;
  const client = getCrmClient();
  const { data } = await client
    .from('tenants')
    .select('id, slug')
    .or(`id.eq.${tenantId},slug.eq.${tenantId}`)
    .maybeSingle();
  return data?.id || tenantId;
}

function mapStatusToPersonaState(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return 'pending';
    case 'suspended':
      return 'suspended';
    case 'inactive':
    case 'deleted':
      return 'inactive';
    case 'active':
    default:
      return 'active';
  }
}

function mapReputationBucket(reputationTier?: string | null, reputationBucket?: number | null) {
  if (reputationTier) return reputationTier;
  if (reputationBucket == null) return null;
  if (reputationBucket >= 4) return 'trusted';
  if (reputationBucket >= 2) return 'verified';
  if (reputationBucket >= 1) return 'new';
  return 'flagged';
}
