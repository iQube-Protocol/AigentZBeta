/**
 * API Route: Get Owned Codex Issues
 * GET /api/codex/owned?personaId=xxx
 *
 * Returns all codex issues + character cards the persona has rights to,
 * split into `available` (uploaded + accessible now) and `comingSoon`
 * (granted-by-SKU but not yet uploaded). The codex UI uses both arrays
 * to render real cards with "Owned" badges + placeholder cards with
 * "Owned · Coming Soon" badges.
 *
 * Phase B canonical taxonomy (2026-05-13):
 *   - GN is content_type='gn_still' with episode_number=-1 (its own slot)
 *   - Episodes are episode_number 0..12 across episode_still / motion / print
 *   - Characters are 0..12 in codex_media_assets asset_kind='character_poster'
 *
 * Backward compatibility: the legacy `issues` / `characters` / `episodeCount`
 * / `characterCount` fields are kept so older callers don't break.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { getOwnedAssetIds, type ExpectedSlot } from '@/services/rewards/assetOwnership';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

interface OwnedIssue {
  episodeNumber: number;
  owned: boolean;
  /** True when the persona has rights via SKU but no master_content_qubes row
   *  exists yet (e.g. content not uploaded). Renders as "Owned · Coming Soon". */
  comingSoon?: boolean;
}

interface OwnedCharacter {
  characterId: string;
  owned: boolean;
  /** When true, no real character_poster row exists yet for this slot; the UI
   *  renders a placeholder card for episode-number `episodeNumber`. */
  comingSoon?: boolean;
  episodeNumber?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const entitlementService = getEntitlementService();
    const entitlements = await entitlementService.getPersonaEntitlements(personaId);

    // ── SKU-expansion: enumerate everything the persona owns OR has
    //    rights to per their bundle SKUs. The new `expectedSlots` array
    //    gives us the full granted matrix (whether uploaded or not).
    let expanded = { direct: [] as string[], expandedIds: [] as string[], expectedSlots: [] as ExpectedSlot[] };
    try {
      const r = await getOwnedAssetIds(personaId, 'metaKnyts');
      expanded = { direct: r.direct, expandedIds: r.expanded, expectedSlots: r.expectedSlots };
    } catch (e) {
      console.error('[codex/owned] SKU expansion failed', e);
    }

    // ── Walk the canonical asset rows the persona's SKUs grant access to,
    //    so we can correlate `expectedSlots` to real rows + episode numbers.
    //    Pull every master_content_qubes row in scope (gn_still, episode_*)
    //    and every codex_media_assets character_poster row.
    const allOwnedIds = new Set<string>([...expanded.direct, ...expanded.expandedIds]);

    // Map of (category, episode_number) → master_content_qubes row id when uploaded.
    const uploadedSlotMap = new Map<string, { id: string; episodeNumber: number; contentType: string }>();
    if (allOwnedIds.size > 0) {
      const { data: masters } = await supabase
        .from('master_content_qubes')
        .select('id, content_type, episode_number')
        .eq('series', 'metaKnyts')
        .eq('status', 'active');
      for (const m of masters ?? []) {
        if (!allOwnedIds.has(m.id)) continue;
        const ct = m.content_type as string;
        const ep = m.episode_number as number;
        uploadedSlotMap.set(`${ct}::${ep}`, { id: m.id, episodeNumber: ep, contentType: ct });
      }
    }

    // Character posters: pull what's actually uploaded + correlate to slots.
    const uploadedCharacters: Array<{ id: string; episodeNumber: number | null; title: string | null }> = [];
    if (expanded.expectedSlots.some((s) => s.category === 'character_card')) {
      const { data: characters } = await supabase
        .from('codex_media_assets')
        .select('id, episode_number, title')
        .eq('series', 'metaKnyts')
        .eq('status', 'active')
        .eq('asset_kind', 'character_poster');
      for (const c of characters ?? []) {
        if (allOwnedIds.has(c.id)) {
          uploadedCharacters.push({
            id: c.id,
            episodeNumber: (c.episode_number ?? null) as number | null,
            title: (c.title ?? null) as string | null,
          });
        }
      }
    }

    // ── Build the `available` + `comingSoon` lists.
    //    Episodes: any slot whose (category, episode_number) is in uploadedSlotMap → available.
    //    Slots in expectedSlots that aren't in uploadedSlotMap → comingSoon.
    const episodeAvailable = new Map<number, { contentTypes: Set<string> }>();
    const episodeComingSoon = new Map<number, { contentTypes: Set<string> }>();

    let gnAvailable = false;
    let gnComingSoon = false;

    for (const slot of expanded.expectedSlots) {
      if (slot.category === 'gn') {
        const key = `gn_still::${slot.episodeNumber ?? -1}`;
        if (uploadedSlotMap.has(key)) gnAvailable = true;
        else gnComingSoon = true;
        continue;
      }
      if (slot.category === 'episode_still' || slot.category === 'episode_motion' || slot.category === 'episode_print') {
        const ep = slot.episodeNumber;
        if (ep == null) continue;
        const key = `${slot.category}::${ep}`;
        const target = uploadedSlotMap.has(key) ? episodeAvailable : episodeComingSoon;
        let bucket = target.get(ep);
        if (!bucket) { bucket = { contentTypes: new Set() }; target.set(ep, bucket); }
        bucket.contentTypes.add(slot.category);
      }
      // character_card slots handled below
    }

    // Characters: rights for episodes 0..12 → match uploaded characters by episode_number.
    const characterAvailable: OwnedCharacter[] = [];
    const characterComingSoon: OwnedCharacter[] = [];
    const expectedCharacterEps = new Set<number>();
    for (const slot of expanded.expectedSlots) {
      if (slot.category === 'character_card' && slot.episodeNumber != null) {
        expectedCharacterEps.add(slot.episodeNumber);
      }
    }
    if (expectedCharacterEps.size > 0) {
      // Index uploaded characters by episode_number (when set).
      const uploadedByEp = new Map<number, { id: string; title: string | null }>();
      for (const c of uploadedCharacters) {
        if (c.episodeNumber != null) uploadedByEp.set(c.episodeNumber, { id: c.id, title: c.title });
      }
      for (const ep of Array.from(expectedCharacterEps).sort((a, b) => a - b)) {
        const hit = uploadedByEp.get(ep);
        if (hit) {
          characterAvailable.push({ characterId: hit.id, owned: true, episodeNumber: ep });
        } else {
          characterComingSoon.push({ characterId: `placeholder:character:ep${ep}`, owned: true, comingSoon: true, episodeNumber: ep });
        }
      }
      // Characters uploaded but with no episode_number set (legacy / unknown ep) still
      // surface as available so the user sees them.
      for (const c of uploadedCharacters) {
        if (c.episodeNumber == null) {
          characterAvailable.push({ characterId: c.id, owned: true });
        }
      }
    }

    // ── Compose response. Keep the legacy issues[] / characters[] keys.
    const issues: OwnedIssue[] = [];
    // GN sits at episode_number = -1 by canonical taxonomy. Surface it
    // under that key so the UI can render a dedicated GN tile.
    if (gnAvailable) issues.push({ episodeNumber: -1, owned: true });
    else if (gnComingSoon) issues.push({ episodeNumber: -1, owned: true, comingSoon: true });
    for (const ep of Array.from(episodeAvailable.keys()).sort((a, b) => a - b)) {
      issues.push({ episodeNumber: ep, owned: true });
    }
    for (const ep of Array.from(episodeComingSoon.keys()).sort((a, b) => a - b)) {
      // If the same ep is ALSO in available (e.g. user owns the motion but
      // not the still for ep 5), surface a single "available" entry (the
      // user has access to at least one format). The granular per-format
      // breakdown is surfaced separately under the formats[] field for
      // surfaces that want to render it.
      if (episodeAvailable.has(ep)) continue;
      issues.push({ episodeNumber: ep, owned: true, comingSoon: true });
    }

    const characters: OwnedCharacter[] = [...characterAvailable, ...characterComingSoon];

    return NextResponse.json({
      personaId,
      // Legacy shape — issues[]/characters[]/counts kept for older callers
      issues,
      characters,
      episodeCount: issues.length,
      characterCount: characterAvailable.length,
      // Phase B detail — surfaces split availability + per-format breakdown
      detail: {
        gn: { available: gnAvailable, comingSoon: gnComingSoon },
        episodes: {
          available: Array.from(episodeAvailable.entries()).map(([ep, b]) => ({
            episodeNumber: ep,
            formats: Array.from(b.contentTypes),
          })).sort((a, b) => a.episodeNumber - b.episodeNumber),
          comingSoon: Array.from(episodeComingSoon.entries()).map(([ep, b]) => ({
            episodeNumber: ep,
            formats: Array.from(b.contentTypes),
          })).sort((a, b) => a.episodeNumber - b.episodeNumber),
        },
        characters: {
          available: characterAvailable,
          comingSoon: characterComingSoon,
        },
      },
      // Surface the canonical 40-piece foundational total + how many are
      // currently in hand. The UI can render "14 of 40 in your library —
      // 26 coming soon" without re-computing.
      summary: {
        totalGranted: issues.length + characters.length,
        availableCount: (gnAvailable ? 1 : 0) + episodeAvailable.size + characterAvailable.length,
        comingSoonCount: (gnComingSoon ? 1 : 0) + episodeComingSoon.size + characterComingSoon.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching owned issues:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
