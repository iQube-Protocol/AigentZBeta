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
    const allowOverrides = searchParams.get('allowOverrides') === 'true';
    // Personal-cartridge surfacing modes (2026-06-02 isolation fix):
    //
    //   default              — system cartridges only. Hand-curated +
    //                          pack-loaded + DB rows where
    //                          owner_persona_id IS NULL (i.e. created
    //                          via /admin/codex or seeded). Wizard-
    //                          created personal cartridges are HIDDEN
    //                          from this view per the operator's
    //                          system-isolation rule: admin status
    //                          confers only the right to create multi-
    //                          cartridge personas, NOT to elevate any
    //                          personal cartridge to platform tier.
    //
    //   ?includePersonal=true — system + the caller's own personal
    //                          cartridges (rows where owner_persona_id
    //                          equals the caller's resolved persona).
    //                          For a future "everything I can see"
    //                          unified picker.
    //
    //   ?personalOnly=true    — only the caller's own personal
    //                          cartridges. Equivalent to
    //                          /api/cartridge/list-mine for the picker
    //                          surface.
    const includePersonal = searchParams.get('includePersonal') === 'true';
    const personalOnly = searchParams.get('personalOnly') === 'true';

    // When the caller needs personal cartridges resolved, we look them up via
    // the spine. Failure to resolve is non-fatal — the request degrades to
    // the system-only view.
    let callerPersonaId: string | null = null;
    if (includePersonal || personalOnly) {
      try {
        const { getActivePersona } = await import('@/services/identity/getActivePersona');
        const persona = await getActivePersona(request);
        callerPersonaId = persona?.personaId ?? null;
      } catch {
        callerPersonaId = null;
      }
    }

    // If defaults flag is set, return defaults with DB overrides when available
    if (useDefaults) {
      let packCodexes = await loadPackCodexes();
      if (!allowOverrides) {
        packCodexes = packCodexes.filter((codex) => codex.id !== 'knyt-codex');
      }
      // CODEX_DEFINITIONS takes priority over pack-loaded codexes for tab structure.
      // Pack-loaded codexes fill in any ids not explicitly defined.
      const definedIds = new Set(CODEX_DEFINITIONS.map(c => c.id));
      let codexes = [...CODEX_DEFINITIONS, ...packCodexes.filter(c => !definedIds.has(c.id))];
      
      if (enabledFilter !== null) {
        const enabled = enabledFilter === 'true';
        codexes = codexes.filter(c => c.enabled === enabled);
      }
      
      if (ownerFilter) {
        codexes = codexes.filter(c => c.owner === ownerFilter);
      }

      const listItems: CodexListItem[] = codexes.map(codexToListItem);
      const mergedById = new Map(listItems.map((item) => [item.id, item]));

      try {
        const supabase = createServerClient();
        let dbQuery = supabase
          .from('codex_configs')
          .select('*');

        if (enabledFilter !== null) {
          dbQuery = dbQuery.eq('enabled', enabledFilter === 'true');
        }

        if (ownerFilter) {
          dbQuery = dbQuery.eq('owner', ownerFilter);
        }

        // Personal/system isolation filter (2026-06-02 fix). Wizard-created
        // cartridges populate owner_persona_id; system cartridges leave it
        // NULL. Defaults mode is the platform picker — show system only by
        // default; only surface personal rows when explicitly asked AND the
        // caller is authenticated.
        if (personalOnly) {
          if (!callerPersonaId) {
            // No persona resolved — return empty rather than the system list,
            // since the caller asked specifically for personal.
            dbQuery = dbQuery.eq('owner_persona_id', '__unresolved__');
          } else {
            dbQuery = dbQuery.eq('owner_persona_id', callerPersonaId);
          }
        } else if (!includePersonal) {
          dbQuery = dbQuery.is('owner_persona_id', null);
        }
        // includePersonal=true + authenticated → no filter; the caller sees
        // every row they can access. Today this returns everything because
        // RLS on codex_configs is "authenticated users can view all";
        // tightening that policy to "owner_persona_id IS NULL OR
        // owner_persona_id = current persona" is a separate operator
        // decision (would require service_role bypass for the registry route).

        const { data: dbConfigs } = await dbQuery.order('created_at', { ascending: false });

        const dbCodexIds = dbConfigs?.map((c) => c.id) || [];
        const { data: tabCounts } = dbCodexIds.length
          ? await supabase
              .from('codex_tabs')
              .select('codex_id')
              .in('codex_id', dbCodexIds)
          : { data: [] as Array<{ codex_id: string }> };

        const tabCountMap = (tabCounts || []).reduce((acc, tab) => {
          acc[tab.codex_id] = (acc[tab.codex_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        (dbConfigs || []).forEach((c) => {
          if (!allowOverrides && c.id === 'knyt-codex') {
            return;
          }
          // Owner redaction (2026-06-02). The legacy `owner` text column
          // carries the persona id for wizard-created rows — never echo
          // that to a non-owner. System rows (owner_persona_id IS NULL)
          // carry display strings ("aigent-z" etc.) and pass through.
          const ownerOut = c.owner_persona_id
            ? (callerPersonaId && callerPersonaId === c.owner_persona_id
                ? (c.owner ?? '')
                : `persona-${String(c.owner_persona_id).slice(0, 8)}`)
            : (c.owner ?? '');
          mergedById.set(c.id, {
            id: c.id,
            name: c.name,
            slug: c.slug,
            enabled: c.enabled,
            owner: ownerOut,
            metadata: c.metadata,
            tabCount: tabCountMap[c.id] || 0,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          });
        });
      } catch {
        // Ignore DB errors in defaults mode and return static defaults
      }

      return NextResponse.json<CodexRegistryResponse<CodexListItem[]>>({
        success: true,
        data: Array.from(mergedById.values())
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

    // Same isolation filter as the defaults path — without this,
    // wizard-created personal cartridges show up in the platform-wide
    // picker. See the comment block above the searchParams parse.
    if (personalOnly) {
      if (!callerPersonaId) {
        query = query.eq('owner_persona_id', '__unresolved__');
      } else {
        query = query.eq('owner_persona_id', callerPersonaId);
      }
    } else if (!includePersonal) {
      query = query.is('owner_persona_id', null);
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
      // Owner redaction — same posture as the defaults path.
      owner: c.owner_persona_id
        ? (callerPersonaId && callerPersonaId === c.owner_persona_id
            ? (c.owner ?? '')
            : `persona-${String(c.owner_persona_id).slice(0, 8)}`)
        : (c.owner ?? ''),
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
