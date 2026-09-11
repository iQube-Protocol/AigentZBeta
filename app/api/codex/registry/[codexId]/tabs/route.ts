/**
 * Codex Tabs API - Tab Management for a Codex
 * 
 * GET /api/codex/registry/[codexId]/tabs - List tabs
 * POST /api/codex/registry/[codexId]/tabs - Add new tab
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

import { CodexTab, CreateTabRequest, CodexRegistryResponse } from '@/types/codex';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ codexId: string }>;
}

/**
 * GET /api/codex/registry/[codexId]/tabs
 * List all tabs for a codex
 */
export async function GET(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const { codexId } = params;
    const searchParams = request.nextUrl.searchParams;
    const enabledOnly = searchParams.get('enabled') === 'true';

    const supabase = createServerClient();

    let query = supabase
      .from('codex_tabs')
      .select('*')
      .eq('codex_id', codexId)
      .order('order', { ascending: true });

    if (enabledOnly) {
      query = query.eq('enabled', true);
    }

    const { data: tabs, error } = await query;

    if (error) {
      console.error('Error fetching tabs:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    const codexTabs: CodexTab[] = (tabs || []).map(t => ({
      id: t.id,
      label: t.label,
      slug: t.slug,
      enabled: t.enabled,
      order: t.order,
      type: t.type,
      config: t.config,
      metadata: t.metadata
    }));

    return NextResponse.json<CodexRegistryResponse<CodexTab[]>>({
      success: true,
      data: codexTabs
    });

  } catch (error) {
    console.error('Error in GET /api/codex/registry/[codexId]/tabs:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/codex/registry/[codexId]/tabs
 * Add a new tab to a codex
 */
export async function POST(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const { codexId } = params;
    const body: CreateTabRequest = await request.json();

    // Validate required fields
    if (!body.label || !body.slug || !body.type) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Missing required fields: label, slug, type'
      }, { status: 400 });
    }

    const supabase = createServerClient();

    // Check if codex exists
    const { data: codex, error: codexError } = await supabase
      .from('codex_configs')
      .select('id')
      .eq('id', codexId)
      .single();

    if (codexError || !codex) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'Codex not found'
      }, { status: 404 });
    }

    // Get current max order
    const { data: maxOrderTab } = await supabase
      .from('codex_tabs')
      .select('order')
      .eq('codex_id', codexId)
      .order('order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = body.order ?? ((maxOrderTab?.order ?? -1) + 1);

    // Create tab
    const tabId = `${codexId}-tab-${body.slug}`;
    const newTab = {
      id: tabId,
      codex_id: codexId,
      label: body.label,
      slug: body.slug,
      enabled: true,
      order: nextOrder,
      type: body.type,
      config: body.config,
      metadata: body.metadata || null
    };

    const { data, error } = await supabase
      .from('codex_tabs')
      .insert(newTab)
      .select()
      .single();

    if (error) {
      console.error('Error creating tab:', error);
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    const createdTab: CodexTab = {
      id: data.id,
      label: data.label,
      slug: data.slug,
      enabled: data.enabled,
      order: data.order,
      type: data.type,
      config: data.config,
      metadata: data.metadata
    };

    return NextResponse.json<CodexRegistryResponse<CodexTab>>({
      success: true,
      data: createdTab,
      message: 'Tab created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/codex/registry/[codexId]/tabs:', error);
    return NextResponse.json<CodexRegistryResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
