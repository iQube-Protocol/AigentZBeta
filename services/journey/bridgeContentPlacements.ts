/**
 * bridgeContentPlacements — QRP-BRIDGE-ADMIN A2 (2026-09-01). A typed asset
 * reference with a real draft/publish distinction for CI/KNYTS bridge media
 * slots (video/poster), sitting ALONGSIDE the existing
 * knytsBridgeEditorialConfig.ts copy/URL fields — not a replacement.
 *
 * `publishPlacement` is the ONLY writer that touches
 * knyts_bridge_editorial_config, and it does so through the EXISTING
 * `upsertKnytsBridgeEditorialSection` function, unchanged — every public
 * bridge reader keeps consuming that table exactly as before. This module
 * adds asset identity, a draft state that can be previewed before
 * publication, and a revision counter; it introduces no second reader path
 * and no second destination registry (`section` reuses the SAME string
 * vocabulary the editorial-config route's ALLOWED_SECTIONS already uses).
 *
 * Designed to be the ONE place A3's authorized-agent publish path calls
 * too (not a UI-coupled function) — `assignDraftAsset`/`publishPlacement`
 * take no browser-only inputs and can be called from an MCP tool handler
 * exactly as they are called from the new Bridges tab route below.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertKnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';

export type PlacementSlot = 'video' | 'poster' | 'infographic';

/**
 * Slots with a live `knyts_bridge_editorial_config` column to publish into
 * (via the existing `upsertKnytsBridgeEditorialSection`). 'infographic' has
 * no such column — no bridge surface renders one yet
 * (KnytsBridgeEditorialSection carries only headline/shortCopy/videoUrl/
 * posterUrl/campaignCta/rewardCopy). Its `publish` therefore updates ONLY
 * this table's bookkeeping (draft->published, revision bump) — real asset
 * placement/versioning is available for it today; live rendering is a
 * separate, not-yet-built surface gap (never conflated as if publishing an
 * infographic already makes it appear on a bridge page).
 */
const SLOTS_WITH_LIVE_CONFIG_COLUMN: ReadonlySet<PlacementSlot> = new Set(['video', 'poster']);

export interface BridgeContentPlacement {
  section: string;
  slot: PlacementSlot;
  draftAssetId: string | null;
  draftAssetUrl: string | null;
  publishedAssetId: string | null;
  publishedAssetUrl: string | null;
  revision: number;
  status: 'draft' | 'published';
  actor: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

function rowToPlacement(row: Record<string, unknown>): BridgeContentPlacement {
  return {
    section: row.section as string,
    slot: row.slot as PlacementSlot,
    draftAssetId: (row.draft_asset_id as string) ?? null,
    draftAssetUrl: (row.draft_asset_url as string) ?? null,
    publishedAssetId: (row.published_asset_id as string) ?? null,
    publishedAssetUrl: (row.published_asset_url as string) ?? null,
    revision: (row.revision as number) ?? 0,
    status: (row.status as 'draft' | 'published') ?? 'draft',
    actor: (row.actor as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    publishedAt: (row.published_at as string) ?? null,
  };
}

/** Same missing-table detection as financialProfileQube.ts/experienceQube.ts
 *  — a genuinely missing table degrades to "no placement yet", never a
 *  false uncertainty. */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  if (error.code === 'PGRST205') return true;
  if (typeof error.message === 'string' && /relation .* does not exist/i.test(error.message)) return true;
  return false;
}

/** Read the placement for one (section, slot). `null` when none has ever
 *  been assigned (or the migration hasn't landed yet) — never fabricated. */
export async function getPlacement(
  supabase: SupabaseClient,
  section: string,
  slot: PlacementSlot,
): Promise<BridgeContentPlacement | null> {
  const { data, error } = await supabase
    .from('bridge_content_placements')
    .select('*')
    .eq('section', section)
    .eq('slot', slot)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(`bridge_content_placements read failed: ${error.message}`);
  }
  return data ? rowToPlacement(data as Record<string, unknown>) : null;
}

/** All three slots for a section in one call — what the Bridges tab's
 *  Assets panel renders per section. */
export async function getPlacementsForSection(
  supabase: SupabaseClient,
  section: string,
): Promise<Record<PlacementSlot, BridgeContentPlacement | null>> {
  const { data, error } = await supabase.from('bridge_content_placements').select('*').eq('section', section);
  if (error) {
    if (isMissingTable(error)) return { video: null, poster: null, infographic: null };
    throw new Error(`bridge_content_placements read failed: ${error.message}`);
  }
  const rows = (data ?? []).map((r) => rowToPlacement(r as Record<string, unknown>));
  return {
    video: rows.find((r) => r.slot === 'video') ?? null,
    poster: rows.find((r) => r.slot === 'poster') ?? null,
    infographic: rows.find((r) => r.slot === 'infographic') ?? null,
  };
}

export interface AssignDraftAssetInput {
  assetId: string | null;
  assetUrl: string;
}

/**
 * Assigns a draft asset to a (section, slot) — does NOT touch the live
 * knyts_bridge_editorial_config row. Safe to call repeatedly; the previous
 * draft is simply replaced. An existing PUBLISHED asset for this slot (if
 * any) is untouched until `publishPlacement` is explicitly called.
 */
export async function assignDraftAsset(
  supabase: SupabaseClient,
  section: string,
  slot: PlacementSlot,
  input: AssignDraftAssetInput,
  actor: string,
): Promise<BridgeContentPlacement> {
  const { data, error } = await supabase
    .from('bridge_content_placements')
    .upsert(
      {
        section,
        slot,
        draft_asset_id: input.assetId,
        draft_asset_url: input.assetUrl,
        actor,
      },
      { onConflict: 'section,slot' },
    )
    .select('*')
    .single();
  if (error) {
    if (isMissingTable(error)) throw new Error('bridge-placements-table-missing');
    throw new Error(`bridge_content_placements assign failed: ${error.message}`);
  }
  return rowToPlacement(data as Record<string, unknown>);
}

export interface PublishPlacementResult {
  placement: BridgeContentPlacement;
}

/** Thrown when the placement row changed (a concurrent publish/re-assign)
 *  between the read that started this publish and the write that would
 *  have recorded it — never silently overwritten. See publishPlacement's
 *  own header for why the live config write still lands even when this
 *  bookkeeping step conflicts. */
export class PlacementConflictError extends Error {
  constructor(section: string, slot: PlacementSlot) {
    super(`bridge_content_placements: concurrent edit detected for ${section}/${slot} — re-read and retry`);
  }
}

/**
 * Publishes the current draft: writes the resolved URL into the EXISTING
 * knyts_bridge_editorial_config row via upsertKnytsBridgeEditorialSection
 * (the same function the copy/URL text-field path already uses) FIRST,
 * then records the publish (copies draft -> published fields, bumps
 * revision) in bridge_content_placements — so every public reader sees the
 * new asset with zero reader-side changes.
 *
 * Ordering is deliberate (A2 hardening, 2026-09-02): the live config write
 * happens BEFORE the placement bookkeeping update, because the config row
 * is what the public reader actually consumes. If the bookkeeping update
 * fails or loses a concurrency race afterward, the live site is still
 * correct — only the audit/draft-state bookkeeping is stale, recoverable
 * by re-publishing the same draft (idempotent: same asset, same target
 * fields). The reverse ordering would risk the opposite failure — the
 * placement row claiming "published" while the live config was never
 * actually written — which is the failure this hardening pass closes.
 *
 * Refuses (throws a named error, never a silent no-op) when there is no
 * draft to publish — an empty publish would otherwise silently blank the
 * live video/poster URL. Refuses with PlacementConflictError (never a
 * silent overwrite) when the placement row changed between the read that
 * started this publish and the bookkeeping write — a concurrent
 * assign/publish on the same slot.
 */
export async function publishPlacement(
  supabase: SupabaseClient,
  section: string,
  slot: PlacementSlot,
  actor: string,
): Promise<PublishPlacementResult> {
  const existing = await getPlacement(supabase, section, slot);
  if (!existing || !existing.draftAssetUrl) {
    throw new Error('no-draft-to-publish');
  }

  // See SLOTS_WITH_LIVE_CONFIG_COLUMN's own comment — 'infographic' has no
  // live config column to write into yet, so this step is skipped for it,
  // never silently pointed at the wrong field.
  if (slot === 'video' || slot === 'poster') {
    await upsertKnytsBridgeEditorialSection(
      supabase,
      section,
      slot === 'video' ? { videoUrl: existing.draftAssetUrl } : { posterUrl: existing.draftAssetUrl },
      actor,
    );
  }

  const { data, error } = await supabase
    .from('bridge_content_placements')
    .update({
      published_asset_id: existing.draftAssetId,
      published_asset_url: existing.draftAssetUrl,
      revision: existing.revision + 1,
      status: 'published',
      actor,
      published_at: new Date().toISOString(),
    })
    .eq('section', section)
    .eq('slot', slot)
    .eq('revision', existing.revision) // optimistic concurrency guard
    .select('*');
  if (error) throw new Error(`bridge_content_placements publish failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new PlacementConflictError(section, slot);
  }

  return { placement: rowToPlacement(data[0] as Record<string, unknown>) };
}
