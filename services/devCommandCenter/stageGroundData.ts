/**
 * Stage Ground Data — server-side live inventories for the ICE loop.
 *
 * The context_assembly and gap_analysis stages must propose from REAL
 * platform state, not LLM memory. This module assembles, per stage:
 *   - the cartridge/tab inventory from data/codex-configs.ts
 *   - the API route map from a filesystem walk of app/api/
 *   - the published registry asset list (Supabase) for reuse/extend/create
 *     classification under the golden rule
 *
 * Server-only (fs + Supabase) — consumed by app/api/codex/chat/route.ts
 * alongside buildAigentZPlatformKnowledge. Best-effort: failures degrade
 * to notes, never throw into the chat turn.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CODEX_DEFINITIONS } from '@/data/codex-configs';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { DevLoopStage } from '@/types/devCommandCenter';

// ─── Cartridge inventory ────────────────────────────────────────────────────

function buildCartridgeInventory(): string {
  const lines: string[] = ['### Cartridge inventory (data/codex-configs.ts — live)'];
  try {
    for (const codex of CODEX_DEFINITIONS) {
      const tabs = (codex.tabs ?? [])
        .filter((t) => t.enabled !== false)
        .map((t) => t.slug)
        .slice(0, 24);
      lines.push(`- **${codex.name}** (id: ${codex.id}, slug: ${codex.slug}) — tabs: ${tabs.join(', ') || 'none'}`);
    }
  } catch (err) {
    lines.push(`- Inventory failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return lines.join('\n');
}

// ─── API route map ──────────────────────────────────────────────────────────

const API_ROOT = path.join(process.cwd(), 'app/api');

/** Recursively collect route.ts dirs relative to app/api, capped. */
function collectRouteDirs(dir: string, rel: string, out: string[], cap: number): void {
  if (out.length >= cap) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some((e) => e.isFile() && e.name === 'route.ts')) {
    out.push(rel || '/');
  }
  for (const e of entries) {
    if (out.length >= cap) return;
    if (e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.')) {
      collectRouteDirs(path.join(dir, e.name), `${rel}/${e.name}`, out, cap);
    }
  }
}

function buildApiRouteMap(): string {
  const lines: string[] = ['### API route map (app/api — live filesystem walk)'];
  try {
    const routes: string[] = [];
    collectRouteDirs(API_ROOT, '', routes, 600);

    // Group by top-level segment for a compact map
    const groups = new Map<string, string[]>();
    for (const r of routes) {
      const seg = r.split('/').filter(Boolean)[0] ?? '(root)';
      const list = groups.get(seg) ?? [];
      list.push(r);
      groups.set(seg, list);
    }

    for (const [seg, list] of Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)) {
      const sample = list.slice(0, 8).map((r) => `/api${r}`).join(', ');
      lines.push(`- **/api/${seg}** (${list.length} routes): ${sample}${list.length > 8 ? ', …' : ''}`);
    }
  } catch (err) {
    lines.push(`- Route walk failed (likely untraced in Lambda): ${err instanceof Error ? err.message : String(err)}`);
  }
  return lines.join('\n');
}

// ─── Registry assets (full list with descriptions, for gap analysis) ────────

async function buildRegistryAssetList(): Promise<string> {
  const lines: string[] = ['### Published registry assets (Supabase registry_assets — live)'];
  const supabase = getSupabaseServer();
  if (!supabase) {
    lines.push('- Unavailable — Supabase server client not configured.');
    return lines.join('\n');
  }
  try {
    const { data, error } = await supabase
      .from('registry_assets')
      .select('asset_id,name,asset_class,trust_band,publication_status,description')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      lines.push('- No published assets yet.');
    } else {
      for (const a of data as Array<{ asset_id: string; name: string; asset_class: string; trust_band: string; publication_status: string; description: string | null }>) {
        lines.push(`- **${a.name}** [${a.asset_class}] ${a.trust_band} (${a.publication_status}, id: ${a.asset_id})${a.description ? ` — ${a.description.slice(0, 160)}` : ''}`);
      }
    }
  } catch (err) {
    lines.push(`- Asset list failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return lines.join('\n');
}

// ─── Stage-keyed assembly ───────────────────────────────────────────────────

/**
 * Build the live ground-data block for the given dev loop stage.
 * Returns '' for stages that don't need live inventories.
 */
export async function buildStageGroundData(stage: DevLoopStage | string | undefined): Promise<string> {
  if (stage === 'context_assembly') {
    const registry = await buildRegistryAssetList();
    return [
      '\n\n## Live platform inventories — assemble the context pack from THESE, never invent paths',
      buildCartridgeInventory(),
      buildApiRouteMap(),
      registry,
    ].join('\n\n');
  }

  if (stage === 'gap_analysis') {
    const registry = await buildRegistryAssetList();
    return [
      '\n\n## Live capability inventory — classify against THESE under the golden rule (Reuse > Extend > Create)',
      registry,
      buildCartridgeInventory(),
    ].join('\n\n');
  }

  return '';
}
