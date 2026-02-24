/**
 * CRM Tenant Application API
 * POST /api/crm/tenants/apply - Apply for new tenant
 * GET /api/crm/tenants/apply - Get application status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { receiptService } from '@/services/receipts/receiptService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface TenantApplication {
  organization_name: string;
  organization_description: string;
  contact_email: string;
  contact_name: string;
  domain?: string;
  expected_users?: number;
  use_case?: string;
  franchise_id?: string;
  persona_id?: string; // Existing persona applying
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TenantApplication;
    
    // Validate required fields
    const required = ['organization_name', 'organization_description', 'contact_email', 'contact_name'];
    for (const field of required) {
      const key = field as keyof TenantApplication;
      if (!body[key]) {
        return NextResponse.json({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if organization with similar name already exists
    const { data: existingTenant } = await supabase
      .from('crm_tenants')
      .select('id, name, slug')
      .ilike('name', `%${body.organization_name}%`)
      .single();

    if (existingTenant) {
      return NextResponse.json({
        success: false,
        error: 'Organization with similar name already exists',
        existing: {
          name: existingTenant.name,
          slug: existingTenant.slug,
        },
      }, { status: 409 });
    }

    // Generate tenant slug from organization name
    const slug = body.organization_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug is available
    const { data: slugCheck } = await supabase
      .from('crm_tenants')
      .select('id, slug')
      .eq('slug', slug)
      .single();

    if (slugCheck) {
      return NextResponse.json({
        success: false,
        error: 'Tenant slug already exists',
        slug: slug,
      }, { status: 409 });
    }

    // Get AgentiQ anchor franchise (the mother ship)
    const { data: agentiqFranchise } = await supabase
      .from('crm_franchises')
      .select('id, name, slug')
      .eq('slug', 'agentiq')
      .eq('is_anchor', true)
      .single();

    if (!agentiqFranchise) {
      return NextResponse.json({
        success: false,
        error: 'AgentiQ anchor franchise not found - system not properly initialized',
      }, { status: 500 });
    }

    // For now, all applications go under AgentiQ directly
    // In the future, this could be extended to allow franchise selection
    const targetFranchise = agentiqFranchise;

    // Create the tenant application (as inactive pending approval)
    const { data: tenant, error: tenantError } = await supabase
      .from('crm_tenants')
      .insert({
        franchise_id: targetFranchise.id,
        slug: slug,
        name: body.organization_name,
        description: body.organization_description,
        domain: body.domain,
        config: {
          application: {
            contact_email: body.contact_email,
            contact_name: body.contact_name,
            expected_users: body.expected_users || 10,
            use_case: body.use_case,
            applied_at: new Date().toISOString(),
            status: 'pending_approval',
            hierarchy: {
              under_anchor: true,
              anchor_franchise: 'agentiq',
              path: ['agentiq', slug],
            },
          },
        },
        is_active: false, // Inactive until approved
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // If persona is provided, create CRM persona link
    if (body.persona_id) {
      await supabase
        .from('crm_personas')
        .insert({
          tenant_id: tenant.id,
          kybe_did: null, // Will be set when persona is linked
          persona_state: 'pseudonymous',
          external_user_id: body.persona_id,
          display_name: body.contact_name,
          email: body.contact_email,
        });
    }

    // Create receipt for tenant application
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'crm',
        action: 'tenant_application',
        tenantId: tenant.id,
        result: {
          tenantId: tenant.id,
          organizationName: body.organization_name,
          slug: slug,
          contactEmail: body.contact_email,
          applicationStatus: 'pending_approval',
        },
      });
    } catch (error) {
      console.warn('Failed to create tenant application receipt:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant application submitted successfully',
      application: {
        tenant_id: tenant.id,
        organization_name: tenant.name,
        slug: tenant.slug,
        status: 'pending_approval',
        contact_email: body.contact_email,
      },
    });
  } catch (error) {
    console.error('Error creating tenant application:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to submit tenant application',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const tenantId = searchParams.get('tenantId');

    if (!email && !tenantId) {
      return NextResponse.json({
        success: false,
        error: 'Email or tenantId is required',
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('crm_tenants')
      .select(`
        *,
        franchise:crm_franchises(id, name, slug)
      `);

    if (email) {
      // Search by contact email in config
      query = query.like('config->application->contact_email', `%${email}%`);
    }

    if (tenantId) {
      query = query.eq('id', tenantId);
    }

    const { data: tenant, error } = await query.single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Application not found',
      }, { status: 404 });
    }

    const applicationStatus = tenant.config?.application?.status || 'unknown';

    return NextResponse.json({
      success: true,
      application: {
        tenant_id: tenant.id,
        organization_name: tenant.name,
        slug: tenant.slug,
        description: tenant.description,
        status: applicationStatus,
        is_active: tenant.is_active,
        franchise: tenant.franchise,
        contact_info: {
          email: tenant.config?.application?.contact_email,
          name: tenant.config?.application?.contact_name,
        },
        application_details: {
          expected_users: tenant.config?.application?.expected_users,
          use_case: tenant.config?.application?.use_case,
          applied_at: tenant.config?.application?.applied_at,
        },
      },
    });
  } catch (error) {
    console.error('Error checking tenant application status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check application status',
    }, { status: 500 });
  }
}
