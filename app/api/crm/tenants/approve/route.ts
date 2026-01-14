/**
 * CRM Tenant Approval API
 * POST /api/crm/tenants/approve - Approve or reject tenant application
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

interface ApprovalRequest {
  tenant_id: string;
  approved: boolean;
  approved_by: string;
  rejection_reason?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ApprovalRequest;
    
    // Validate required fields
    const required = ['tenant_id', 'approved', 'approved_by'];
    for (const field of required) {
      const key = field as keyof ApprovalRequest;
      if (body[key] === undefined || body[key] === null) {
        return NextResponse.json({
          success: false,
          error: `${field} is required`,
        }, { status: 400 });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('crm_tenants')
      .select('*')
      .eq('id', body.tenant_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant not found',
      }, { status: 404 });
    }

    // Check if tenant is already processed
    const currentStatus = tenant.config?.application?.status;
    if (currentStatus === 'approved' || currentStatus === 'rejected') {
      return NextResponse.json({
        success: false,
        error: `Application already ${currentStatus}`,
        current_status: currentStatus,
      }, { status: 409 });
    }

    // Update tenant status
    const updateData: any = {
      config: {
        ...tenant.config,
        application: {
          ...tenant.config?.application,
          status: body.approved ? 'approved' : 'rejected',
          approved_by: body.approved_by,
          approved_at: new Date().toISOString(),
          rejection_reason: body.rejection_reason,
          notes: body.notes,
        },
      },
    };

    // If approved, activate the tenant
    if (body.approved) {
      updateData.is_active = true;
    }

    const { data: updatedTenant, error: updateError } = await supabase
      .from('crm_tenants')
      .update(updateData)
      .eq('id', body.tenant_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create receipt for approval/rejection
    try {
      await receiptService.createSmartTriadReceipt({
        component: 'crm',
        action: body.approved ? 'tenant_approved' : 'tenant_rejected',
        tenantId: body.tenant_id,
        result: {
          tenantId: body.tenant_id,
          organizationName: tenant.name,
          decision: body.approved ? 'approved' : 'rejected',
          approvedBy: body.approved_by,
          rejectionReason: body.rejection_reason,
          processedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('Failed to create tenant approval receipt:', error);
    }

    // If approved, create default roles and setup
    if (body.approved) {
      // This would trigger any additional setup for approved tenants
      // For example: creating default personas, setting up initial configurations, etc.
      console.log(`[Tenant Approval] Tenant ${tenant.name} (${body.tenant_id}) approved and activated`);
    }

    return NextResponse.json({
      success: true,
      message: body.approved 
        ? 'Tenant application approved successfully' 
        : 'Tenant application rejected',
      tenant: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        slug: updatedTenant.slug,
        is_active: updatedTenant.is_active,
        application_status: updatedTenant.config?.application?.status,
      },
    });
  } catch (error) {
    console.error('Error processing tenant approval:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process tenant approval',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('crm_tenants')
      .select(`
        *,
        franchise:crm_franchises(id, name, slug)
      `, { count: 'exact' });

    // Filter by application status
    if (status) {
      query = query.like('config->application->status', status);
    }

    const { data: tenants, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format applications
    const applications = (tenants || []).map(tenant => ({
      tenant_id: tenant.id,
      organization_name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      is_active: tenant.is_active,
      franchise: tenant.franchise,
      application_status: tenant.config?.application?.status || 'unknown',
      contact_info: {
        email: tenant.config?.application?.contact_email,
        name: tenant.config?.application?.contact_name,
      },
      application_details: {
        expected_users: tenant.config?.application?.expected_users,
        use_case: tenant.config?.application?.use_case,
        applied_at: tenant.config?.application?.applied_at,
        approved_by: tenant.config?.application?.approved_by,
        approved_at: tenant.config?.application?.approved_at,
        rejection_reason: tenant.config?.application?.rejection_reason,
        notes: tenant.config?.application?.notes,
      },
      created_at: tenant.created_at,
    }));

    return NextResponse.json({
      success: true,
      applications,
      total: count || 0,
      limit,
      offset,
      filters: {
        status,
      },
    });
  } catch (error) {
    console.error('Error listing tenant applications:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to list tenant applications',
    }, { status: 500 });
  }
}
