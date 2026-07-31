/**
 * Codex Tab API - Individual Tab Operations
 * 
 * PUT /api/codex/registry/[codexId]/tabs/[tabId] - Update tab
 * DELETE /api/codex/registry/[codexId]/tabs/[tabId] - Delete tab
 * PATCH /api/codex/registry/[codexId]/tabs/[tabId] - Enable/disable tab
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

import { UpdateTabRequest, CodexRegistryResponse } from '@/types/codex';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ codexId: string; tabId: string }>;
}

/**
 * PUT /api/codex/registry/[codexId]/tabs/[tabId]
 * Update tab configuration
 */
export async function PUT(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const { codexId, tabId } = params;
    const body: UpdateTabRequest = await request.json();

    const supabase = createServerClient();

    // Build update object
    const updates: any = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.type !== undefined) updates.type = body.type;
    if (body.config !== undefined) updates.config = body.config;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'No updates provided'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('codex_tabs')
      .update(updates)
      .eq('id', tabId)
      .eq('codex_id', codexId)
      .select()
      .single();

    if (error) {
      console.error('Error updating tab:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Tab not found'
      }, { status: 404 });
    }

    return NextResponse.json<CodexRegistryResponse>({
      success: true,
      message: 'Tab updated successfully'
    });

  } catch (error) {
    console.error('Error in PUT /api/codex/registry/[codexId]/tabs/[tabId]:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/codex/registry/[codexId]/tabs/[tabId]
 * Enable/disable tab
 */
export async function PATCH(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const { codexId, tabId } = params;
    const body = await request.json();

    if (body.enabled === undefined) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'PATCH only supports enabled field'
      }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('codex_tabs')
      .update({ enabled: body.enabled })
      .eq('id', tabId)
      .eq('codex_id', codexId)
      .select()
      .single();

    if (error) {
      console.error('Error updating tab:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Tab not found'
      }, { status: 404 });
    }

    return NextResponse.json<CodexRegistryResponse>({
      success: true,
      message: `Tab ${body.enabled ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error) {
    console.error('Error in PATCH /api/codex/registry/[codexId]/tabs/[tabId]:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/codex/registry/[codexId]/tabs/[tabId]
 * Delete tab
 */
export async function DELETE(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const { codexId, tabId } = params;

    const supabase = createServerClient();

    const { error } = await supabase
      .from('codex_tabs')
      .delete()
      .eq('id', tabId)
      .eq('codex_id', codexId);

    if (error) {
      console.error('Error deleting tab:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json<CodexRegistryResponse>({
      success: true,
      message: 'Tab deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/codex/registry/[codexId]/tabs/[tabId]:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
