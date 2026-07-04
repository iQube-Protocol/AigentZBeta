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
import { getCodexById, getCodexBySlug } from '@/data/codex-configs';
import { getPackCodexById } from '../_lib/packRegistry';

/**
 * Resolve a codex by id, then by slug, then by pack-derived id.
 * Lets callers pass either id (e.g. "agentiq-os-cartridge") or slug
 * (e.g. "agentiq-os") and still find the canonical config.
 */
async function resolveCodex(codexId: string): Promise<CodexConfig | undefined> {
  return (
    getCodexById(codexId) ??
    getCodexBySlug(codexId) ??
    (await getPackCodexById(codexId))
  );
}

type RegistryTab = CodexConfig['tabs'][number];

/**
 * Union-merge static (CODEX_DEFINITIONS) tabs with DB (codex_tabs) rows.
 *
 * The hand-written configs are canonical — they carry static component tabs
 * (e.g. FactoryIntabeTab, AgentiqCartridgeTab, InvariantRegistryTab) that
 * packs and DB rows cannot express — so static is the source of truth for
 * structure/config; DB rows supply only the enabled-state override (matching
 * the KNYT branch's `enabled: enabledBySlug[...] ?? tab.enabled` pattern).
 * Genuinely DB-authored tabs (slug not present in the static set — e.g. tabs
 * added via the Codex Manager) are appended.
 *
 * This fixes the prior `dbTabs.length > 0 ? dbTabs : static` logic, which let
 * a stale DB tab set REPLACE the static set wholesale — so newly-added static
 * tabs never appeared once any codex_tabs row existed for the cartridge.
 * When there are no static tabs (a purely DB/pack cartridge) it returns the
 * DB tabs unchanged, so behaviour is a strict no-op in that case.
 */
function mergeStaticAndDbTabs(staticTabs: RegistryTab[], dbTabs: RegistryTab[]): RegistryTab[] {
  if (!staticTabs || staticTabs.length === 0) return dbTabs;
  const dbBySlug = new Map(dbTabs.map((t) => [t.slug, t]));
  const staticSlugs = new Set(staticTabs.map((t) => t.slug));
  const merged: RegistryTab[] = staticTabs.map((tab) => {
    const dbRow = dbBySlug.get(tab.slug);
    return dbRow ? { ...tab, enabled: dbRow.enabled } : tab;
  });
  for (const dbRow of dbTabs) {
    if (!staticSlugs.has(dbRow.slug)) merged.push(dbRow);
  }
  return merged;
}

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ codexId: string }>;
}

/**
 * Personal-cartridge isolation gate for the detail route.
 *
 * Mirrors the registry list route's owner_persona_id discriminator
 * (codexes/packs/agentiq/updates/2026-06-02_mycartridge-personal-system-isolation-fix.md).
 *
 * Returns true when the caller is allowed to see this row:
 *   - The row is a system cartridge (owner_persona_id IS NULL), OR
 *   - The caller is the owner persona of a personal cartridge, OR
 *   - The caller is a platform-tier admin (cartridgeFlags.isAdmin) OR
 *     has the cartridge in their adminCartridges grants, OR
 *   - The caller holds a non-owner role on the cartridge per
 *     cartridge_memberships (Phase 4b projection).
 *
 * Personal rows that fail the check produce a 404 (not 403) so the
 * detail route doesn't leak the existence of the row to enumeration.
 */
async function personalConfigVisibleToCaller(
  request: NextRequest,
  config: { owner_persona_id?: string | null; slug?: string },
): Promise<{ visible: boolean; callerPersonaId: string | null }> {
  if (!config.owner_persona_id) {
    // System row — caller does not need to be resolved for visibility.
    return { visible: true, callerPersonaId: null };
  }
  try {
    const { getActivePersona } = await import('@/services/identity/getActivePersona');
    const persona = await getActivePersona(request);
    if (!persona) return { visible: false, callerPersonaId: null };
    const callerPersonaId = persona.personaId;
    if (callerPersonaId === config.owner_persona_id) {
      return { visible: true, callerPersonaId };
    }
    const flags = persona.cartridgeFlags;
    if (flags.isAdmin) return { visible: true, callerPersonaId };
    if (config.slug && Array.isArray(flags.adminCartridges) && flags.adminCartridges.includes(config.slug)) {
      return { visible: true, callerPersonaId };
    }
    if (config.slug) {
      const role = flags.cartridgeMemberships?.[config.slug];
      if (role) return { visible: true, callerPersonaId };
    }
    return { visible: false, callerPersonaId };
  } catch {
    return { visible: false, callerPersonaId: null }; // fail-closed
  }
}

/**
 * Owner-field redaction. The legacy `codex_configs.owner` text column
 * stores the persona id for wizard-created rows (a T0 leak through the
 * legacy NOT NULL column). When emitting a list-item or full config to
 * the API boundary, replace this with a display token so the caller
 * never sees the underlying persona id of a personal cartridge they
 * don't own.
 *
 * System cartridges (owner_persona_id IS NULL) carry display strings
 * like "aigent-z" or "iqube-protocol" in `owner`; those pass through
 * unredacted.
 */
function redactOwnerField(
  rawOwner: string | null | undefined,
  ownerPersonaId: string | null | undefined,
  callerPersonaId: string | null,
): string {
  if (!ownerPersonaId) return rawOwner ?? ''; // system row
  if (callerPersonaId && callerPersonaId === ownerPersonaId) {
    return rawOwner ?? ''; // owner sees their own — fine
  }
  // Visible to a non-owner (admin / member). Surface a short display
  // token, not the canonical persona id.
  return `persona-${String(ownerPersonaId).slice(0, 8)}`;
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
export async function GET(request: NextRequest, props: RouteContext) {
  const params = await props.params;
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
          // Merge DB tab enabled states so Codex Manager visibility toggles are respected.
          // Falls back to the static default if the DB is unavailable or has no tab rows.
          try {
            const supabase = createServerClient();
            const { data: dbTabs } = await supabase
              .from('codex_tabs')
              .select('slug, enabled')
              .eq('codex_id', codexId);

            if (dbTabs && dbTabs.length > 0) {
              const enabledBySlug = Object.fromEntries(dbTabs.map((t) => [t.slug, t.enabled]));
              const mergedCodex: CodexConfig = {
                ...knytDefaults,
                tabs: knytDefaults.tabs.map((tab) => ({
                  ...tab,
                  enabled: tab.slug in enabledBySlug ? enabledBySlug[tab.slug] : tab.enabled,
                })),
              };
              return NextResponse.json<CodexRegistryResponse<CodexConfig>>({
                success: true,
                data: withKnytStaticTabs(mergedCodex),
              });
            }
          } catch {
            // DB unavailable — fall through to static defaults below
          }

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
          // Personal-cartridge isolation gate (2026-06-02). If this row is
          // a personal cartridge and the caller is neither the owner nor an
          // admin/member, return 404 rather than leaking the config or its
          // existence.
          const visibility = await personalConfigVisibleToCaller(request, config);
          if (!visibility.visible) {
            return NextResponse.json<CodexRegistryResponse>(
              { success: false, error: 'Codex not found' },
              { status: 404 },
            );
          }
          const redactedOwnerDefaults = redactOwnerField(
            config.owner,
            config.owner_persona_id,
            visibility.callerPersonaId,
          );
          // CODEX_DEFINITIONS takes priority over auto-generated pack configs — hand-written
          // configs are canonical and include static component tabs that packs can't express.
          const fallbackCodex = await resolveCodex(codexId);
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

          const mergedTabs = mergeStaticAndDbTabs(fallbackCodex?.tabs ?? [], dbTabs);

          const codex: CodexConfig = {
            id: config.id,
            name: config.name,
            slug: config.slug,
            enabled: config.enabled,
            version: config.version,
            owner: redactedOwnerDefaults,
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

      const codex = await resolveCodex(codexId);
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

    // Personal-cartridge isolation gate (2026-06-02) — same as the
    // defaults path above. Personal rows resolve via the spine; only
    // owners + admins + members see them. Otherwise 404 (don't leak
    // existence).
    const visibilityDirect = config
      ? await personalConfigVisibleToCaller(request, config)
      : { visible: true, callerPersonaId: null as string | null };
    if (config && !visibilityDirect.visible) {
      return NextResponse.json<CodexRegistryResponse>(
        { success: false, error: 'Codex not found' },
        { status: 404 },
      );
    }

    if (configError || !config) {
      const fallbackCodex = await resolveCodex(codexId);
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

    const dbTabsDirect: RegistryTab[] = (tabs || []).map(t => ({
      id: t.id,
      label: t.label,
      slug: t.slug,
      enabled: t.enabled,
      order: t.order,
      type: t.type,
      config: t.config,
      metadata: t.metadata
    }));
    // Static CODEX_DEFINITIONS tabs are canonical (carry component configs the
    // DB can't express); DB rows override enabled-state + append DB-only tabs.
    const fallbackDirect = await resolveCodex(codexId);
    const mergedTabsDirect = mergeStaticAndDbTabs(fallbackDirect?.tabs ?? [], dbTabsDirect);

    const codex: CodexConfig = {
      id: config.id,
      name: config.name,
      slug: config.slug,
      enabled: config.enabled,
      version: config.version,
      owner: redactOwnerField(
        config.owner,
        config.owner_persona_id,
        visibilityDirect.callerPersonaId,
      ),
      metadata: config.metadata,
      tabs: mergedTabsDirect,
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
export async function PUT(request: NextRequest, props: RouteContext) {
  const params = await props.params;
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
      const fallbackCodex = await resolveCodex(codexId);

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
export async function PATCH(request: NextRequest, props: RouteContext) {
  const params = await props.params;
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
export async function DELETE(request: NextRequest, props: RouteContext) {
  const params = await props.params;
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
