/**
 * Codex Tabs Reorder API
 * 
 * POST /api/codex/registry/[codexId]/tabs/reorder - Reorder tabs
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

import { ReorderTabsRequest, CodexRegistryResponse } from '@/types/codex';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { codexId: string };
}

/**
 * POST /api/codex/registry/[codexId]/tabs/reorder
 * Reorder tabs by providing new order array
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { codexId } = params;
    const body: ReorderTabsRequest = await request.json();

    if (!body.tabOrder || !Array.isArray(body.tabOrder)) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'tabOrder array is required'
      }, { status: 400 });
    }

    const supabase = createServerClient();

    // Update each tab's order
    const updates = body.tabOrder.map(({ id, order }) =>
      supabase
        .from('codex_tabs')
        .update({ order })
        .eq('id', id)
        .eq('codex_id', codexId)
    );

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Error reordering tabs:', errors);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Failed to reorder some tabs'
      }, { status: 500 });
    }

    return NextResponse.json<CodexRegistryResponse>({
      success: true,
      message: 'Tabs reordered successfully'
    });

  } catch (error) {
    console.error('Error in POST /api/codex/registry/[codexId]/tabs/reorder:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
