/**
 * API Route: Get Owned Codex Issues
 * GET /api/codex/owned?personaId=xxx
 *
 * @deprecated Phase B canonicalization (2026-05-14) — new shelf / KnytTab /
 * ScrollsTab / CharactersTab surfaces consume `/api/registry/content-qube/
 * series-rights` instead. That endpoint is backed by the ContentQube
 * registry (v_content_qube_registry + evaluateAccess + SKU-rights
 * placeholders) and is the single source of truth for inventory + ownership.
 *
 * This route remains in service for legacy admin / store / bundle-wizard
 * paths (KnytStoreEpisodesTab, KnytStoreCardsTab) that haven't been migrated
 * yet. Removal is a follow-up sweep.
 *
 * Phase A (2026-05-14) note: `OwnedIssue.contentTypes` was added so the
 * remaining legacy variant-blind ownership checks (e.g. KnytTab's
 * isEpisodeLocked) can correctly distinguish still/motion/print without
 * fully migrating to the registry hook. Once all consumers are on the
 * registry hook, this whole route can be retired.
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
 *   - Characters are 0..13 in codex_media_assets asset_kind='character_poster' (ep 13 = display #12)
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
  /** Per-variant breakdown: which formats the persona has rights to for this
   *  episode. Values: 'episode_still' | 'episode_motion' | 'episode_print'.
   *  Phase A canonicalization (2026-05-14): consumers MUST gate variant-
   *  specific actions on this list, not on episodeNumber alone — the legacy
   *  variant-blind check produces false-positive "owned" results when the
   *  persona owns the print but clicks the motion variant. */
  contentTypes?: string[];
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

    // FIO handle resolution — entitlements are stored by persona UUID.
    // If the caller passes a FIO handle (contains '@'), resolve it to UUID
    // first. Strictly additive: no-op for UUIDs.
    let resolvedPersonaId = personaId;
    let fioResolutionFailed = false;
    if (personaId.includes('@')) {
      const { data: personaRow, error: personaErr } = await supabase
        .from('personas')
        .select('id')
        .eq('fio_handle', personaId)
        .single();
      if (personaRow?.id) {
        resolvedPersonaId = personaRow.id;
      } else {
        fioResolutionFailed = true;
        console.warn(
          `[codex/owned] FIO handle resolution FAILED for ${personaId} ` +
          `err=${personaErr?.message ?? 'no row'}`,
        );
      }
    }

    const entitlementService = getEntitlementService();
    const entitlements = await entitlementService.getPersonaEntitlements(resolvedPersonaId);
    console.log(
      `[codex/owned] personaId=${personaId} resolvedPersonaId=${resolvedPersonaId} ` +
      `fioResolutionFailed=${fioResolutionFailed} entitlementsCount=${entitlements.length} ` +
      `assetIds=[${entitlements.map((e) => e.assetId).join(',')}]`,
    );

    // ── SKU-expansion: enumerate everything the persona owns OR has
    //    rights to per their bundle SKUs. The new `expectedSlots` array
    //    gives us the full granted matrix (whether uploaded or not).
    let expanded = { direct: [] as string[], expandedIds: [] as string[], expectedSlots: [] as ExpectedSlot[] };
    let expansionError: string | null = null;
    try {
      const r = await getOwnedAssetIds(resolvedPersonaId, 'metaKnyts');
      expanded = { direct: r.direct, expandedIds: r.expanded, expectedSlots: r.expectedSlots };
    } catch (e) {
      expansionError = (e as Error)?.message || String(e);
      console.error('[codex/owned] SKU expansion failed', e);
    }

    // Debug-only — return raw chain diagnostics when ?debug=1.
    const wantDebug = searchParams.get('debug') === '1';

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

    // Characters: rights for episodes 0..13 → match uploaded characters by episode_number.
    const characterAvailable: OwnedCharacter[] = [];
    const characterComingSoon: OwnedCharacter[] = [];
    const expectedCharacterEps = new Set<number>();
    for (const slot of expanded.expectedSlots) {
      if (slot.category === 'character_card' && slot.episodeNumber != null) {
        expectedCharacterEps.add(slot.episodeNumber);
      }
    }
    if (expectedCharacterEps.size > 0) {
      // ── Convention bridge: characters use a DIFFERENT episode_number
      //    convention than episodes.
      //      master_content_qubes (episodes):   0-indexed — DB ep 0..12 = display #0..#12
      //      codex_media_assets   (characters): 1-indexed — DB ep 1..13 = display #0..#12
      //    expectedCharacterEps is in display convention (0..12). To look up
      //    the uploaded character row, translate: DB ep = display ep + 1.
      const uploadedByDbEp = new Map<number, { id: string; title: string | null }>();
      for (const c of uploadedCharacters) {
        if (c.episodeNumber != null) uploadedByDbEp.set(c.episodeNumber, { id: c.id, title: c.title });
      }
      for (const ep of Array.from(expectedCharacterEps).sort((a, b) => a - b)) {
        const hit = uploadedByDbEp.get(ep + 1);
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
    // Emit per-episode entries with the full variant breakdown (available +
    // coming-soon formats merged). Variant-aware callers (KnytTab lock check,
    // ScrollsTab, etc.) gate on `contentTypes`; legacy callers that only read
    // `episodeNumber` continue to work unchanged.
    const allEpisodeNumbers = new Set<number>([
      ...Array.from(episodeAvailable.keys()),
      ...Array.from(episodeComingSoon.keys()),
    ]);
    for (const ep of Array.from(allEpisodeNumbers).sort((a, b) => a - b)) {
      const availFormats = episodeAvailable.get(ep)?.contentTypes ?? new Set<string>();
      const csFormats = episodeComingSoon.get(ep)?.contentTypes ?? new Set<string>();
      const contentTypes = Array.from(new Set<string>([...availFormats, ...csFormats]));
      // If any format is available, the episode is "owned-available". If only
      // coming-soon formats exist, it's "owned-coming-soon". (A persona who
      // owns the motion-available variant but only has rights to a coming-soon
      // print still gets one "available" issue — they CAN read motion now.)
      const isAvailable = availFormats.size > 0;
      issues.push({
        episodeNumber: ep,
        owned: true,
        ...(isAvailable ? {} : { comingSoon: true }),
        contentTypes,
      });
    }

    const characters: OwnedCharacter[] = [...characterAvailable, ...characterComingSoon];

    console.log(
      `[codex/owned] RESULT personaId=${personaId} issueCount=${issues.length} ` +
      `epNums=[${issues.map((i) => i.episodeNumber).join(',')}] ` +
      `uploadedSlotKeysCount=${uploadedSlotMap.size} expectedSlotsCount=${expanded.expectedSlots.length}`,
    );

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
      // Temporary debug surface for tracing empty-ownership reports.
      // Append ?debug=1 to receive: raw entitlement count, direct/expanded
      // id lists, expectedSlots, uploadedSlotMap keys, and any expansion
      // error. Strip this block once the issue is root-caused.
      ...(wantDebug ? {
        _debug: {
          entitlementsCount: entitlements.length,
          entitlementAssetIds: entitlements.map((e) => e.assetId),
          expansionError,
          direct: expanded.direct,
          expandedIds: expanded.expandedIds,
          expectedSlotsCount: expanded.expectedSlots.length,
          expectedSlots: expanded.expectedSlots,
          uploadedSlotKeys: Array.from(uploadedSlotMap.keys()),
        },
      } : {}),
    });
  } catch (error) {
    console.error('[API] Error fetching owned issues:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
