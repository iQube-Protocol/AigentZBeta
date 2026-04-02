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
import { getPackCodexById } from '../_lib/packRegistry';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { codexId: string };
}

function withKnytStaticTabs(codex: CodexConfig): CodexConfig {
  return {
    ...codex,
    tabs: codex.tabs.map((tab) => {
      // Preserve tabs that are already typed as 'static' — they have their own component.
      if (tab.type === 'static') return tab;
      return {
        ...tab,
        type: 'static',
        config: {
          component: 'KnytTab',
          props: {
            ...(tab.config?.props || {}),
            tabSlug: tab.slug,
          },
        },
      };
    }),
  };
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
    const allowOverrides = searchParams.get('allowOverrides') === 'true';
    const isKnytCodex = codexId === 'knyt-codex';

    // If defaults flag is set, prefer DB-backed config and fall back to defaults
    if (useDefaults) {
      if (isKnytCodex && !allowOverrides) {
        const knytDefaults = getCodexById(codexId);
        if (knytDefaults) {
          return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
            success: true,
            data: withKnytStaticTabs(knytDefaults),
          });
        }
      }

      try {
        const supabase = createServerClient();

        const { data: config } = await supabase
          .from('codex_configs')
          .select('*')
          .eq('id', codexId)
          .single();

        if (config) {
          const packCodex = await getPackCodexById(codexId);
          const fallbackCodex = packCodex ?? getCodexById(codexId);
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

          const dbTabs = (tabs || []).map(t => ({
            id: t.id,
            label: t.label,
            slug: t.slug,
            enabled: t.enabled,
            order: t.order,
            type: t.type,
            config: t.config,
            metadata: t.metadata
          }));

          const mergedTabs = dbTabs.length > 0 ? dbTabs : (fallbackCodex?.tabs ?? []);

          const codex: CodexConfig = {
            id: config.id,
            name: config.name,
            slug: config.slug,
            enabled: config.enabled,
            version: config.version,
            owner: config.owner,
            metadata: config.metadata,
            tabs: mergedTabs,
            permissions: config.permissions,
            liquidUI: config.liquid_ui,
            createdAt: config.created_at,
            updatedAt: config.updated_at
          };

          return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
            success: true,
            data: isKnytCodex ? withKnytStaticTabs(codex) : codex
          });
        }
      } catch {
        // Ignore DB errors in defaults mode and continue to static fallback
      }

      const packCodex = await getPackCodexById(codexId);
      const codex = packCodex ?? getCodexById(codexId);
      if (!codex) {
        return NextResponse.json<CodexRegistryResponse>({
          success: false,
          error: 'Codex not found'
        }, { status: 404 });
      }
      return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
        success: true,
        data: isKnytCodex ? withKnytStaticTabs(codex) : codex
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
      const packCodex = await getPackCodexById(codexId);
      const fallbackCodex = packCodex ?? getCodexById(codexId);
      if (fallbackCodex) {
        return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
          success: true,
          data: fallbackCodex,
        });
      }
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
      data: isKnytCodex ? withKnytStaticTabs(codex) : codex
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
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.permissions !== undefined) updates.permissions = body.permissions;
    if (body.liquidUI !== undefined) updates.liquid_ui = body.liquidUI;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<CodexRegistryResponse>({
        success: false,
        error: 'No updates provided'
      }, { status: 400 });
    }

    const { data: existingConfig } = await supabase
      .from('codex_configs')
      .select('*')
      .eq('id', codexId)
      .maybeSingle();

    let data: any = null;
    let error: { message: string } | null = null;

    if (existingConfig) {
      const updateResult = await supabase
        .from('codex_configs')
        .update(updates)
        .eq('id', codexId)
        .select()
        .single();

      data = updateResult.data;
      error = updateResult.error;
    } else {
      const packCodex = await getPackCodexById(codexId);
      const fallbackCodex = packCodex ?? getCodexById(codexId);

      if (!fallbackCodex) {
        return NextResponse.json<CodexRegistryResponse>({
          success: false,
          error: 'Codex not found'
        }, { status: 404 });
      }

      const insertPayload = {
        id: codexId,
        name: updates.name ?? fallbackCodex.name,
        slug: updates.slug ?? fallbackCodex.slug,
        enabled: updates.enabled ?? fallbackCodex.enabled,
        version: fallbackCodex.version,
        owner: fallbackCodex.owner,
        metadata: updates.metadata ?? fallbackCodex.metadata,
        permissions: updates.permissions ?? fallbackCodex.permissions,
        liquid_ui: updates.liquid_ui ?? fallbackCodex.liquidUI ?? null,
      };

      const insertResult = await supabase
        .from('codex_configs')
        .insert(insertPayload)
        .select()
        .single();

      data = insertResult.data;
      error = insertResult.error;
    }

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
