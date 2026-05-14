/**
 * GET /api/registry/content-qube/series-rights
 *
 * Persona-rights-aware ContentQube series resolver (Phase B canonicalization
 * of the operator's "ContentQube registry as single source of truth" intent).
 *
 * Returns the UNION of:
 *   1. Every real `content_qubes` row for the series, persona-aware
 *      (`manifest.persona_owns` resolved via evaluateAccess → userOwnsAsset).
 *   2. Synthesized rights-grant PLACEHOLDER entries for `(category, episode)`
 *      slots the persona has SKU rights to but for which no `content_qubes`
 *      row exists yet (e.g. ep1 motion / ep3 motion not yet produced).
 *      Placeholders carry `manifest.is_placeholder = true`,
 *      `manifest.lifecycle_state = 'draft'`, and `persona_owns = true`.
 *
 * This is the endpoint KnytShelfTab + KnytTab + ScrollsTab all consume so
 * the canonical inventory (13 still + 13 motion + 13 cards + 1 GN = 40
 * for arkagent@knyt) renders correctly regardless of master-table seed
 * coverage. Replaces the legacy /api/codex/owned for those surfaces.
 *
 * Query params:
 *   series       (required) — e.g. 'metaKnyts'
 *   personaId    (optional) — explicit forward; mirrors /series. When not
 *                supplied, getActivePersona(req) reads the session.
 *   contentKind  (optional) — server-side filter ('episode' | 'character' | …)
 *
 * Privacy:
 *   - persona_id (T0) never appears in the response.
 *   - Placeholder slots are an in-memory composition; no DB writes occur.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveIframePersona } from '@/services/identity/resolveIframePersona';
import { resolveContentQubesBySeries } from '@/services/content/resolveContentQube';
import { getOwnedAssetIds, type ExpectedSlot } from '@/services/rewards/assetOwnership';
import type {
  ContentQubeDisplayManifest,
  ContentQubeEditionSummary,
  ContentQubeKind,
  ContentQubeContentType,
} from '@/types/contentQube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SeriesRightsItem {
  manifest: ContentQubeDisplayManifest;
  editionSummary: ContentQubeEditionSummary;
  codexSlugs: string[];
}

// Map a SKU-expansion ExpectedSlot.category onto the manifest content_kind
// + content_type pair the consumer expects to see.
function slotToKindAndType(
  category: ExpectedSlot['category'],
): { kind: ContentQubeKind; contentType: ContentQubeContentType } | null {
  switch (category) {
    case 'gn':              return { kind: 'gn',        contentType: 'gn_still' };
    case 'episode_still':   return { kind: 'episode',   contentType: 'episode_still' };
    case 'episode_motion':  return { kind: 'episode',   contentType: 'episode_motion' };
    case 'episode_print':   return { kind: 'episode',   contentType: 'episode_print' };
    case 'character_card':  return { kind: 'character', contentType: 'character_poster' };
    case 'lore':            return null; // no per-slot placeholder
    default:                return null;
  }
}

function placeholderItem(
  series: string,
  slot: ExpectedSlot,
): SeriesRightsItem | null {
  const mapping = slotToKindAndType(slot.category);
  if (!mapping) return null;
  const placeholderId = `placeholder:${slot.category}:${slot.episodeNumber ?? 'none'}`;
  const manifest: ContentQubeDisplayManifest = {
    id: placeholderId,
    series,
    content_kind: mapping.kind,
    content_type: mapping.contentType,
    display_number: slot.episodeNumber,
    title: null,
    description: null,
    lifecycle_state: 'draft',
    gating_kind: 'owned',
    price_qc: null,
    storage_kinds: [],
    rarity_counts: null,
    persona_owns: true,
    is_placeholder: true,
  };
  const editionSummary: ContentQubeEditionSummary = {
    content_qube_id: placeholderId,
    total_editions: 0,
    issued_count: 0,
    available_count: 0,
    rarity_breakdown: {
      common:             { total: 0, issued: 0 },
      rare:               { total: 0, issued: 0 },
      epic:               { total: 0, issued: 0 },
      legendary:          { total: 0, issued: 0 },
      secret_black_rare:  { total: 0, issued: 0 },
    },
    chain_minted_count: 0,
  };
  return { manifest, editionSummary, codexSlugs: [] };
}

// Build a stable key from (content_type, display_number) so we can de-dupe
// real qubes against expectedSlots. Character-card display_number on the
// manifest is already in display convention (0..12) via Phase 6 bridge
// migration's `episode_number - 1` translation.
function slotKey(category: string, ep: number | null): string {
  return `${category}::${ep ?? 'null'}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const series = searchParams.get('series');
  if (!series) {
    return NextResponse.json({ ok: false, error: 'series param required' }, { status: 400 });
  }

  const contentKind = searchParams.get('contentKind') ?? undefined;

  // Spine first; URL `?personaId=` fallback for codex iframe contexts where
  // cookies/Authorization headers don't reach the route. Admin/partner flags
  // forced false in the fallback path (resolveIframePersona enforces this).
  const persona = await resolveIframePersona(req);

  // 1. Resolve real content_qubes rows with persona_owns set.
  const realResolved = await resolveContentQubesBySeries(series, persona, {
    contentKind,
  });

  const realItems: SeriesRightsItem[] = realResolved.map((r) => ({
    manifest: r.manifest,
    editionSummary: r.editionSummary,
    codexSlugs: r.codexSlugs,
  }));

  // 2. If we have a persona, compose rights-grant placeholders for slots
  //    that don't have a real row yet.
  let placeholderItems: SeriesRightsItem[] = [];
  if (persona) {
    try {
      const { expectedSlots } = await getOwnedAssetIds(persona.personaId, series);

      // Build the set of (content_type, display_number) keys already covered
      // by real qubes — these don't need placeholders.
      const realKeys = new Set<string>();
      for (const item of realItems) {
        realKeys.add(slotKey(item.manifest.content_type, item.manifest.display_number));
      }

      // Apply the optional contentKind filter to placeholders too, so the
      // caller doesn't get character placeholders when asking for episodes.
      const wantedKinds: Set<ContentQubeKind> | null = contentKind
        ? new Set<ContentQubeKind>([contentKind as ContentQubeKind])
        : null;

      for (const slot of expectedSlots) {
        const mapping = slotToKindAndType(slot.category);
        if (!mapping) continue;
        if (wantedKinds && !wantedKinds.has(mapping.kind)) continue;
        const key = slotKey(mapping.contentType, slot.episodeNumber);
        if (realKeys.has(key)) continue;
        const placeholder = placeholderItem(series, slot);
        if (placeholder) {
          placeholderItems.push(placeholder);
          realKeys.add(key); // guard against duplicate placeholders
        }
      }
    } catch (err) {
      // Rights expansion failure is non-fatal — fall back to real-only.
      console.warn(
        `[/series-rights] rights-expansion failed series=${series} ` +
        `personaId=<redacted> err=${(err as Error)?.message ?? err}`,
      );
    }
  }

  // Combine. Sort by content_type then display_number so the response order
  // is stable across calls (UI groupings rely on it).
  const qubes = [...realItems, ...placeholderItems].sort((a, b) => {
    const ctCmp = String(a.manifest.content_type).localeCompare(String(b.manifest.content_type));
    if (ctCmp !== 0) return ctCmp;
    const an = a.manifest.display_number ?? Number.POSITIVE_INFINITY;
    const bn = b.manifest.display_number ?? Number.POSITIVE_INFINITY;
    return an - bn;
  });

  return NextResponse.json({
    ok: true,
    data: { qubes },
  });
}
