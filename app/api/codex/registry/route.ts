/**
 * Codex Registry API - List and Create Codexes
 * 
 * GET /api/codex/registry - List all codexes (with optional filters)
 * POST /api/codex/registry - Create new codex
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
import { CodexConfig, CodexListItem, CreateCodexRequest, CodexRegistryResponse } from '@/types/codex';
import { CODEX_DEFINITIONS } from '@/data/codex-configs';
import { codexToListItem, loadPackCodexes } from './_lib/packRegistry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/codex/registry
 * List all codexes with optional filtering
 * Query params: ?enabled=true&owner=aigent-z
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enabledFilter = searchParams.get('enabled');
    const ownerFilter = searchParams.get('owner');
    const useDefaults = searchParams.get('defaults') === 'true';

    // If defaults flag is set, return pack-scanned + hardcoded definitions
    if (useDefaults) {
      const packCodexes = await loadPackCodexes();
      const packIds = new Set(packCodexes.map(codex => codex.id));
      let codexes = [...packCodexes, ...CODEX_DEFINITIONS.filter(codex => !packIds.has(codex.id))];
      
      if (enabledFilter !== null) {
        const enabled = enabledFilter === 'true';
        codexes = codexes.filter(c => c.enabled === enabled);
      }
      
      if (ownerFilter) {
        codexes = codexes.filter(c => c.owner === ownerFilter);
      }

      const listItems: CodexListItem[] = codexes.map(codexToListItem);

      return NextResponse.json<CodexRegistryResponse<CodexListItem[]>>({
        success: true,
        data: listItems
      });
    }

    // Otherwise fetch from database
    const supabase = createServerClient();
    
    let query = supabase
      .from('codex_configs')
      .select('*');

    if (enabledFilter !== null) {
      query = query.eq('enabled', enabledFilter === 'true');
    }

    if (ownerFilter) {
      query = query.eq('owner', ownerFilter);
    }

    const { data: configs, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching codexes:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Get tab counts for each codex
    const codexIds = configs?.map(c => c.id) || [];
    const { data: tabCounts } = await supabase
      .from('codex_tabs')
      .select('codex_id')
      .in('codex_id', codexIds);

    const tabCountMap = (tabCounts || []).reduce((acc, tab) => {
      acc[tab.codex_id] = (acc[tab.codex_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const listItems: CodexListItem[] = (configs || []).map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      enabled: c.enabled,
      owner: c.owner,
      metadata: c.metadata,
      tabCount: tabCountMap[c.id] || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    return NextResponse.json<CodexRegistryResponse<CodexListItem[]>>({
      success: true,
      data: listItems
    });

  } catch (error) {
    console.error('Error in GET /api/codex/registry:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/codex/registry
 * Create a new codex
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateCodexRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.slug || !body.owner) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Missing required fields: name, slug, owner'
      }, { status: 400 });
    }

    const supabase = createServerClient();

    // Generate codex ID
    const codexId = `${body.slug}-codex`;

    // Create codex config
    const codexConfig = {
      id: codexId,
      name: body.name,
      slug: body.slug,
      enabled: true,
      version: '1.0.0',
      owner: body.owner,
      metadata: body.metadata,
      permissions: body.permissions || {
        view: ['*'],
        edit: [body.owner],
        admin: [body.owner]
      },
      liquid_ui: body.liquidUI || null
    };

    const { data: newCodex, error: codexError } = await supabase
      .from('codex_configs')
      .insert(codexConfig)
      .select()
      .single();

    if (codexError) {
      console.error('Error creating codex:', codexError);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: codexError.message
      }, { status: 500 });
    }

    // Create tabs if provided
    if (body.tabs && body.tabs.length > 0) {
      const tabsToInsert = body.tabs.map((tab, index) => ({
        id: `${codexId}-tab-${tab.slug}`,
        codex_id: codexId,
        label: tab.label,
        slug: tab.slug,
        enabled: tab.enabled ?? true,
        order: tab.order ?? index,
        type: tab.type,
        config: tab.config,
        metadata: tab.metadata || null
      }));

      const { error: tabsError } = await supabase
        .from('codex_tabs')
        .insert(tabsToInsert);

      if (tabsError) {
        console.error('Error creating tabs:', tabsError);
        // Rollback codex creation
        await supabase.from('codex_configs').delete().eq('id', codexId);
        return NextResponse.json<CodexRegistryResponse>({
          success: false,
          error: `Failed to create tabs: ${tabsError.message}`
        }, { status: 500 });
      }
    }

    // Fetch complete codex with tabs
    const { data: tabs } = await supabase
      .from('codex_tabs')
      .select('*')
      .eq('codex_id', codexId)
      .order('order', { ascending: true });

    const completeCodex: CodexConfig = {
      id: newCodex.id,
      name: newCodex.name,
      slug: newCodex.slug,
      enabled: newCodex.enabled,
      version: newCodex.version,
      owner: newCodex.owner,
      metadata: newCodex.metadata,
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
      permissions: newCodex.permissions,
      liquidUI: newCodex.liquid_ui,
      createdAt: newCodex.created_at,
      updatedAt: newCodex.updated_at
    };

    return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
      success: true,
      data: completeCodex,
      message: 'Codex created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/codex/registry:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
