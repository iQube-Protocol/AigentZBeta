/**
 * Promoted community-content → RuntimeCapsuleRecord projection.
 *
 * Surfaces rows from `community_generated_content` with
 * `status = 'runtime_promoted'` as runtime capsules so they can:
 *   - be returned by /api/runtime/capsules and rendered in the carousel
 *   - appear in /api/runtime/takeover/infer's catalog so the LLM can
 *     pin them in the takeover manifest
 *
 * Both surfaces emit the same `community-<row.id>` ID so the manifest
 * matches against the rendered capsule by ID (existing path in
 * MetaMeRuntimeClient.applyTakeoverPriority).
 *
 * IMPORTANT: both exported functions return [] on any error — they must
 * never throw. Callers in /api/runtime/* use Promise.allSettled so a
 * failure here cannot poison the main capsule/takeover response.
 */
import { createClient } from '@supabase/supabase-js';
import type { RuntimeCapsuleRecord } from '@/types/runtimeCapsules';

interface PromotedRow {
  id: string;
  skill: 'article' | 'story' | 'note';
  title: string;
  prompt: string;
  image_url: string | null;
  qc_cost: number;
  runtime_promoted_at: string | null;
  cartridge: string | null;
  runtime_menu: string | null;
  runtime_submenu: string | null;
}

/** Runtime top-level menu → the menu word the runtime prompt carries, used as a
 *  capsule tag so scoreContent boosts the row when that menu is engaged. */
const RUNTIME_MENUS = new Set(['be', 'make', 'play', 'earn', 'share']);

/** Map a row's cartridge to the codexSlug the runtime capsule filter scopes by. */
function codexSlugForCartridge(cartridge: string | null): string {
  if (cartridge === 'metame-runtime') return 'metame';
  if (cartridge === 'qripto') return 'qripto';
  return 'knyt';
}

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function communityContentCapsuleId(rowId: string): string {
  return `community-${rowId}`;
}

export async function listPromotedCommunityCapsuleRecords(
  options: { limit?: number; cartridge?: string } = {},
): Promise<RuntimeCapsuleRecord[]> {
  try {
    const db = getDb();
    if (!db) return [];

    const limit = options.limit ?? 30;
    let query = db
      .from('community_generated_content')
      .select('id, skill, title, prompt, image_url, qc_cost, runtime_promoted_at, cartridge, runtime_menu, runtime_submenu')
      .eq('status', 'runtime_promoted')
      .order('runtime_promoted_at', { ascending: false })
      .limit(limit);
    // Optional cartridge scope. Omitted by default — the runtime capsules route
    // returns every cartridge's promoted rows and scopes by codexSlug downstream.
    if (options.cartridge) query = query.eq('cartridge', options.cartridge);

    const { data, error } = await query;
    if (error || !data) return [];
    const rows = data as PromotedRow[];

    return rows
      .filter((r) => Boolean(r.image_url))
      .map((r) => {
        const heroUri = r.image_url as string;
        const codexSlug = codexSlugForCartridge(r.cartridge);
        const description = r.prompt.length > 0
          ? r.prompt.length > 140 ? `${r.prompt.slice(0, 137)}…` : r.prompt
          : `${codexSlug} community ${r.skill}`;

        // metaMe Pulse: an admin assigns each promoted row a runtime menu
        // (be|make|play|earn|share) + submenu at promote time. Surface them as
        // the capsule's surfaceIntent + modalityHints so the existing
        // scoreContent pipeline maps the row into that runtime menu. KNYT /
        // Qriptopian rows keep the default 'read' hint.
        const menu = r.runtime_menu && RUNTIME_MENUS.has(r.runtime_menu) ? r.runtime_menu : null;
        const isMetameLane = r.cartridge === 'metame-runtime';
        const modalityHints = isMetameLane
          ? [menu, r.runtime_submenu].filter((v): v is string => Boolean(v))
          : ['read'];

        return {
          id: communityContentCapsuleId(r.id),
          sourceType: 'smart-content',
          title: r.title,
          description,
          heroAsset:      { uri: heroUri, kind: 'hero',      origin: 'smart-content' },
          thumbnailAsset: { uri: heroUri, kind: 'thumbnail', origin: 'smart-content' },
          assetStatus: 'resolved',
          metadata: {
            codexSlug,
            ...(isMetameLane && menu ? { surfaceIntent: menu } : {}),
            modalityHints,
            durationMinutes: null,
            priceLabel: r.qc_cost === 0 ? 'Free' : null,
            status: 'runtime_promoted',
            contentKind: 'article',
            previewMediaUri: null,
          },
          launchTarget: {
            type: 'content',
            href: `/community-content/${r.id}`,
          },
        } satisfies RuntimeCapsuleRecord;
      });
  } catch {
    return [];
  }
}

export interface PromotedCatalogEntry {
  id: string;
  title: string;
  description: string;
  cartridgeSlug: string;
}

export async function listPromotedCommunityCatalogEntries(
  options: { limit?: number } = {},
): Promise<PromotedCatalogEntry[]> {
  try {
    const records = await listPromotedCommunityCapsuleRecords(options);
    return records.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      cartridgeSlug: 'knyt-codex',
    }));
  } catch {
    return [];
  }
}
