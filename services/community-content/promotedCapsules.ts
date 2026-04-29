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
 */
import { createClient } from '@supabase/supabase-js';
import type { RuntimeCapsuleRecord } from '@/types/runtimeCapsules';

interface PromotedRow {
  id: string;
  skill: 'article' | 'story';
  title: string;
  prompt: string;
  image_url: string | null;
  qc_cost: number;
  runtime_promoted_at: string | null;
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
  options: { limit?: number } = {},
): Promise<RuntimeCapsuleRecord[]> {
  const db = getDb();
  if (!db) return [];

  const limit = options.limit ?? 30;
  const { data, error } = await db
    .from('community_generated_content')
    .select('id, skill, title, prompt, image_url, qc_cost, runtime_promoted_at')
    .eq('status', 'runtime_promoted')
    .order('runtime_promoted_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  const rows = data as PromotedRow[];

  return rows
    .filter((r) => Boolean(r.image_url))
    .map((r) => {
      const heroUri = r.image_url as string;
      const description = r.prompt.length > 0
        ? r.prompt.length > 140 ? `${r.prompt.slice(0, 137)}…` : r.prompt
        : `KNYT community ${r.skill}`;
      return {
        id: communityContentCapsuleId(r.id),
        sourceType: 'smart-content',
        title: r.title,
        description,
        heroAsset:      { uri: heroUri, kind: 'hero',      origin: 'smart-content' },
        thumbnailAsset: { uri: heroUri, kind: 'thumbnail', origin: 'smart-content' },
        assetStatus: 'resolved',
        metadata: {
          codexSlug: 'knyt',
          modalityHints: ['read'],
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
  const records = await listPromotedCommunityCapsuleRecords(options);
  return records.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    cartridgeSlug: 'knyt-codex',
  }));
}
