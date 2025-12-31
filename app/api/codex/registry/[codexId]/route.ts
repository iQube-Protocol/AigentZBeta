/**
 * Codex Registry API - Individual Codex Operations
 * 
 * GET /api/codex/registry/[codexId] - Get codex details
 * PUT /api/codex/registry/[codexId] - Update codex
 * DELETE /api/codex/registry/[codexId] - Delete codex
 * PATCH /api/codex/registry/[codexId] - Partial update (enable/disable)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

import { CodexConfig, UpdateCodexRequest, CodexRegistryResponse } from '@/types/codex';
import { getCodexById } from '@/data/codex-configs';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { codexId: string };
}

/**
 * GET /api/codex/registry/[codexId]
 * Get complete codex configuration including tabs
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { codexId } = params;
    const searchParams = request.nextUrl.searchParams;
    const useDefaults = searchParams.get('defaults') === 'true';

    // If defaults flag is set, return hardcoded definition
    if (useDefaults) {
      const codex = getCodexById(codexId);
      if (!codex) {
        return NextResponse.json<CodexRegistryResponse>({
          success: false,
          error: 'Codex not found'
        }, { status: 404 });
      }
      return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
        success: true,
        data: codex
      });
    }

    const supabase = createServerClient();

    // Fetch codex config
    const { data: config, error: configError } = await supabase
      .from('codex_configs')
      .select('*')
      .eq('id', codexId)
      .single();

    if (configError || !config) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Codex not found'
      }, { status: 404 });
    }

    // Fetch tabs
    const { data: tabs, error: tabsError } = await supabase
      .from('codex_tabs')
      .select('*')
      .eq('codex_id', codexId)
      .order('order', { ascending: true });

    if (tabsError) {
      console.error('Error fetching tabs:', tabsError);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: tabsError.message
      }, { status: 500 });
    }

    const codex: CodexConfig = {
      id: config.id,
      name: config.name,
      slug: config.slug,
      enabled: config.enabled,
      version: config.version,
      owner: config.owner,
      metadata: config.metadata,
      tabs: (tabs || []).map(t => ({
        id: t.id,
        label: t.label,
        slug: t.slug,
        enabled: t.enabled,
        order: t.order,
        type: t.type,
        config: t.config,
        metadata: t.metadata
      })),
      permissions: config.permissions,
      liquidUI: config.liquid_ui,
      createdAt: config.created_at,
      updatedAt: config.updated_at
    };

    return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
      success: true,
      data: codex
    });

  } catch (error) {
    console.error('Error in GET /api/codex/registry/[codexId]:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/codex/registry/[codexId]
 * Update codex configuration
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { codexId } = params;
    const body: UpdateCodexRequest = await request.json();

    const supabase = createServerClient();

    // Build update object
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.permissions !== undefined) updates.permissions = body.permissions;
    if (body.liquidUI !== undefined) updates.liquid_ui = body.liquidUI;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'No updates provided'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('codex_configs')
      .update(updates)
      .eq('id', codexId)
      .select()
      .single();

    if (error) {
      console.error('Error updating codex:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Codex not found'
      }, { status: 404 });
    }

    return NextResponse.json<CodexRegistryResponse>({
      success: true,
      message: 'Codex updated successfully'
    });

  } catch (error) {
    console.error('Error in PUT /api/codex/registry/[codexId]:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/codex/registry/[codexId]
 * Partial update - primarily for enable/disable
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { codexId } = params;
    const body = await request.json();

    const supabase = createServerClient();

    // Only allow enabled field for PATCH
    if (body.enabled === undefined) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'PATCH only supports enabled field'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('codex_configs')
      .update({ enabled: body.enabled })
      .eq('id', codexId)
      .select()
      .single();

    if (error) {
      console.error('Error updating codex:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Codex not found'
      }, { status: 404 });
    }

    return NextResponse.json<CodexRegistryResponse>({
      success: true,
      message: `Codex ${body.enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Error in PATCH /api/codex/registry/[codexId]:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/codex/registry/[codexId]
 * Delete codex and all its tabs
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { codexId } = params;

    const supabase = createServerClient();

    // Delete codex (tabs will be cascade deleted)
    const { error } = await supabase
      .from('codex_configs')
      .delete()
      .eq('id', codexId);

    if (error) {
      console.error('Error deleting codex:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json<CodexRegistryResponse>({
      success: true,
      message: 'Codex deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/codex/registry/[codexId]:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
