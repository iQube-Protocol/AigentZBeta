/**
 * Marketa API Routes with RBAC Implementation
 * 
 * All Marketa API endpoints with proper tenant isolation and role-based access control.
 * Partners can only access their own tenant data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  withMarketaAuth, 
  MarketaAuthContext, 
  applyTenantFilter, 
  applyPartnerFilter 
} from '@/codexes/packs/marketa/services/rbac';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// PARTNERS API ROUTES
// ============================================================================

/**
 * GET /api/marketa/partners
 * List partners for the authenticated user's tenant only
 */
export async function GET(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    let query = supabase
      .from('marketa_partners')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply tenant filtering - partners can only see their tenant's partners
    query = applyTenantFilter(query, authContext);

    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      tenant_id: authContext.tenantId // Include for debugging
    });
  }, {
    requiredPermission: 'marketa:partners:read',
    requireTenantId: true,
  })(req);
}

/**
 * POST /api/marketa/partners
 * Create a new partner for the authenticated user's tenant
 */
export async function POST(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    const body = await req.json();
    
    // Ensure partner is created for user's tenant (override any tenant_id in request)
    const partnerData = {
      ...body,
      tenant_id: authContext.tenantId, // Force tenant isolation
      created_by: authContext.personaId,
    };

    const { data, error } = await supabase
      .from('marketa_partners')
      .insert(partnerData)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data,
      tenant_id: authContext.tenantId
    });
  }, {
    requiredPermission: 'marketa:partners:write',
  })(req);
}

// ============================================================================
// CAMPAIGNS API ROUTES
// ============================================================================

/**
 * GET /api/marketa/campaigns
 * List campaigns for the authenticated user's tenant only
 */
async function getCampaigns(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    let query = supabase
      .from('marketa_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply tenant filtering
    query = applyTenantFilter(query, authContext);

    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      tenant_id: authContext.tenantId
    });
  }, {
    requiredPermission: 'marketa:campaigns:read',
    requireTenantId: true,
  })(req);
}

// ============================================================================
// PACKS API ROUTES
// ============================================================================

/**
 * GET /api/marketa/packs
 * List packs for the authenticated user's tenant only
 */
async function getPacks(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    let query = supabase
      .from('marketa_packs')
      .select(`
        *,
        marketa_partners!inner(
          id,
          name,
          code
        )
      `)
      .order('created_at', { ascending: false });

    // Apply tenant filtering
    query = applyTenantFilter(query, authContext);

    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      tenant_id: authContext.tenantId
    });
  }, {
    requiredPermission: 'marketa:packs:read',
    requireTenantId: true,
  })(req);
}

/**
 * POST /api/marketa/packs/generate
 * Generate a new pack for the authenticated user's tenant only
 */
async function generatePack(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    const body = await req.json();
    
    // Ensure pack is generated for user's tenant
    const packData = {
      ...body,
      tenant_id: authContext.tenantId, // Force tenant isolation
      created_by: authContext.personaId,
      status: 'draft',
      version: 1,
    };

    // Verify partner belongs to user's tenant if specified
    if (body.partner_id) {
      const { data: partner } = await supabase
        .from('marketa_partners')
        .select('id')
        .eq('id', body.partner_id)
        .eq('tenant_id', authContext.tenantId)
        .single();

      if (!partner) {
        return NextResponse.json(
          { success: false, error: 'Partner not found or access denied' },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from('marketa_packs')
      .insert(packData)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data,
      tenant_id: authContext.tenantId
    });
  }, {
    requiredPermission: 'marketa:packs:write',
  })(req);
}

// ============================================================================
// SEGMENTS API ROUTES
// ============================================================================

/**
 * POST /api/marketa/segments/preview
 * Preview segment for the authenticated user's tenant only
 */
async function previewSegment(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    const { filters } = await req.json();
    
    // Build query for audience profiles with tenant filtering
    let query = supabase
      .from('marketa_audience_profiles')
      .select('id', { count: 'exact' });

    // Apply tenant filtering - only profiles from user's tenant
    query = applyTenantFilter(query, authContext);

    // Apply additional filters
    if (filters.value_tier?.length > 0) {
      query = query.in('investment_tier', filters.value_tier);
    }
    if (filters.engagement_tier?.length > 0) {
      query = query.in('engagement_tier', filters.engagement_tier);
    }
    if (filters.mythos_bias !== undefined) {
      query = query.eq('flags->>mythos_bias', filters.mythos_bias);
    }
    if (filters.logos_bias !== undefined) {
      query = query.eq('flags->>logos_bias', filters.logos_bias);
    }
    if (filters.email_opt_in !== undefined) {
      query = query.eq('consent->>email_opt_in', filters.email_opt_in);
    }

    // Get count and sample IDs
    const { data: sampleProfiles, count, error } = await query.limit(10);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const result = {
      count: count || 0,
      sample_profile_ids: sampleProfiles?.map(p => p.id) || [],
      filters_applied: filters,
      tenant_id: authContext.tenantId,
    };

    return NextResponse.json({ 
      success: true, 
      data: result
    });
  }, {
    requiredPermission: 'marketa:segments:read',
    requireTenantId: true,
  })(req);
}

// ============================================================================
// REPORTS API ROUTES
// ============================================================================

/**
 * GET /api/marketa/reports/summary
 * Get reports summary for the authenticated user's tenant only
 */
async function getReportsSummary(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || authContext.tenantId;
    
    // Ensure user can access requested tenant
    if (tenantId !== authContext.tenantId && authContext.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Cannot access other tenant data' },
        { status: 403 }
      );
    }

    // Get campaign metrics for tenant
    const { data: campaigns } = await supabase
      .from('marketa_campaigns')
      .select('id, status, phase')
      .eq('tenant_id', tenantId);

    // Get pack metrics for tenant
    const { data: packs } = await supabase
      .from('marketa_packs')
      .select('id, status, type')
      .eq('tenant_id', tenantId);

    // Get delivery logs for tenant
    const { data: deliveries } = await supabase
      .from('marketa_delivery_logs')
      .select('id, status, platform')
      .eq('tenant_id', tenantId);

    // Get reward actions for tenant
    const { data: rewards } = await supabase
      .from('marketa_reward_actions')
      .select('id, status, type, amount')
      .eq('tenant_id', tenantId);

    // Calculate summary metrics
    const summary = {
      tenant_id: tenantId,
      campaigns: {
        total: campaigns?.length || 0,
        active: campaigns?.filter(c => c.status === 'active').length || 0,
        completed: campaigns?.filter(c => c.status === 'completed').length || 0,
      },
      packs: {
        total: packs?.length || 0,
        draft: packs?.filter(p => p.status === 'draft').length || 0,
        approved: packs?.filter(p => p.status === 'approved').length || 0,
        sent: packs?.filter(p => p.status === 'sent').length || 0,
      },
      deliveries: {
        total: deliveries?.length || 0,
        successful: deliveries?.filter(d => d.status === 'delivered').length || 0,
        failed: deliveries?.filter(d => d.status === 'failed').length || 0,
      },
      rewards: {
        total: rewards?.length || 0,
        issued: rewards?.filter(r => r.status === 'issued').length || 0,
        total_value: rewards?.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0) || 0,
      },
    };

    return NextResponse.json({ 
      success: true, 
      data: summary
    });
  }, {
    requiredPermission: 'marketa:reports:read',
    requireTenantId: true,
  })(req);
}

// ============================================================================
// CRM EVENTS API ROUTES
// ============================================================================

/**
 * POST /api/marketa/crm/event
 * Log CRM event for the authenticated user's tenant only
 */
async function logCRMEvent(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    const body = await req.json();
    
    // Ensure event is logged for user's tenant
    const eventData = {
      ...body,
      tenant_id: authContext.tenantId, // Force tenant isolation
      created_by: authContext.personaId,
    };

    // Verify profile belongs to user's tenant if specified
    if (body.profile_id) {
      const { data: profile } = await supabase
        .from('marketa_audience_profiles')
        .select('id')
        .eq('id', body.profile_id)
        .eq('tenant_id', authContext.tenantId)
        .single();

      if (!profile) {
        return NextResponse.json(
          { success: false, error: 'Profile not found or access denied' },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from('marketa_crm_events')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data,
      tenant_id: authContext.tenantId
    });
  }, {
    requiredPermission: 'marketa:crm:write',
  })(req);
}

// ============================================================================
// PUBLISHING API ROUTES
// ============================================================================

/**
 * POST /api/marketa/publish
 * Publish pack for the authenticated user's tenant only
 */
async function publishPack(req: NextRequest) {
  return withMarketaAuth(async (req: NextRequest, authContext: MarketaAuthContext) => {
    const { pack_id, targets, dry_run = false } = await req.json();
    
    // Verify pack belongs to user's tenant
    const { data: pack } = await supabase
      .from('marketa_packs')
      .select('id, status, tenant_id')
      .eq('id', pack_id)
      .eq('tenant_id', authContext.tenantId)
      .single();

    if (!pack) {
      return NextResponse.json(
        { success: false, error: 'Pack not found or access denied' },
        { status: 404 }
      );
    }

    if (pack.status !== 'approved' && !dry_run) {
      return NextResponse.json(
        { success: false, error: 'Pack must be approved before publishing' },
        { status: 400 }
      );
    }

    // Create publish job
    const publishJob = {
      pack_id,
      tenant_id: authContext.tenantId,
      targets,
      dry_run,
      status: dry_run ? 'completed' : 'pending',
      created_by: authContext.personaId,
    };

    const { data, error } = await supabase
      .from('marketa_publish_jobs')
      .insert(publishJob)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        ...data,
        tenant_id: authContext.tenantId,
      }
    });
  }, {
    requiredPermission: 'marketa:publish',
  })(req);
}
