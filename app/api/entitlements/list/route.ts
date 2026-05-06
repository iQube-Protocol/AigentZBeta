/**
 * API Route: List Entitlements
 * GET /api/entitlements/list?personaId=xxx
 * 
 * Gets all entitlements for a persona with enriched asset metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { createClient } from '@supabase/supabase-js';
import { BUNDLE_PRICING } from '@/types/knyt-store';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mirrors resolveThumb() in /api/knyt/thumbnails: prefers cover_thumb_url,
// falls back to auto_drive_cid when it is a plain https URL (Supabase-hosted),
// or treats it as a CID for the cover proxy otherwise.
function resolveAssetThumb(row: { cover_thumb_url?: string | null; auto_drive_cid?: string | null } | null | undefined): { coverUrl: string | undefined; coverCid: string | undefined } {
  const adCid = row?.auto_drive_cid ?? undefined;
  const coverUrl =
    row?.cover_thumb_url ||
    (adCid?.startsWith('http') ? adCid : undefined) ||
    undefined;
  const coverCid = !coverUrl && adCid && !adCid.startsWith('http') ? adCid : undefined;
  return { coverUrl, coverCid };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400,  });
    }

    // Resolve FIO handle (e.g. aigentz@aigent) to UUID — entitlements are stored by UUID
    let resolvedPersonaId = personaId;
    if (personaId.includes('@')) {
      const { data: personaRow } = await supabase
        .from('personas')
        .select('id')
        .eq('fio_handle', personaId)
        .single();
      if (personaRow?.id) resolvedPersonaId = personaRow.id;
    }

    const entitlementService = getEntitlementService();
    const entitlements = await entitlementService.getPersonaEntitlements(resolvedPersonaId);

    // Pre-fetch all metaKnyts cover/character thumbnails into a lookup map.
    // Mirrors /api/knyt/thumbnails exactly (same series + status + asset_kind
    // filters and same ordering) so the wallet/shelf show identical thumbs to
    // the store. Doing it once here also collapses the per-entitlement lookups
    // the episode branch used to do.
    const { data: thumbAssets } = await supabase
      .from('codex_media_assets')
      .select('episode_number, asset_kind, cover_thumb_url, auto_drive_cid, rarity_tier, title')
      .eq('series', 'metaKnyts')
      .eq('status', 'active')
      .in('asset_kind', ['cover_image', 'cover_pdf', 'character_poster'])
      .order('episode_number', { ascending: true })
      .order('asset_kind', { ascending: true })
      .order('created_at', { ascending: false });

    // dbEp -> first resolved cover (cover_image preferred over cover_pdf because
    // of the asset_kind ASC ordering above; newest upload wins per kind).
    const coverByDbEp = new Map<number, { cover_thumb_url: string | null; auto_drive_cid: string | null; rarity_tier: string | null }>();
    for (const a of thumbAssets ?? []) {
      const ak = a.asset_kind as string | null;
      if (ak !== 'cover_image' && ak !== 'cover_pdf') continue;
      const ep = a.episode_number as number | null;
      if (ep === null || ep === undefined) continue;
      if (!coverByDbEp.has(ep)) {
        coverByDbEp.set(ep, {
          cover_thumb_url: (a.cover_thumb_url as string | null) ?? null,
          auto_drive_cid:  (a.auto_drive_cid as string | null) ?? null,
          rarity_tier:     (a.rarity_tier as string | null) ?? null,
        });
      }
    }

    // Enrich entitlements with asset metadata
    const enrichedEntitlements = await Promise.all(
      entitlements.map(async (ent) => {
        const assetId = ent.assetId;
        let assetMeta: any = {};
        
        // Try to find asset in codex_media_assets
        if (assetId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId);

          // character-card-[UUID]-still / -motion (legacy/direct UUID writes)
          const charCardMatch = assetId.match(
            /^character-card-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-(still|motion))?$/i
          );
          // character-card-N-still / -motion / -bundle (cart purchase format — N is pricing ep number)
          const charCardEpMatch = !charCardMatch
            ? assetId.match(/^character-card-(\d+)(?:-(still|motion|bundle))?$/i)
            : null;

          // episode-N, episode-N-qripto-still, episode-N-digital-motion, mk_ep01, ep1, etc.
          // mk_ep format is db-convention (mk_ep1 = pricing ep 0); episode-/ep- is pricing-convention.
          const epMatch = !charCardMatch && !charCardEpMatch
            ? assetId.match(/(?:episode[_-]?|ep)(\d+)/i)
            : null;
          const epIsDbConvention = epMatch ? /^mk_ep/i.test(assetId) : false;

          // bundle-* public bundles and investor bundle SKUs
          const BUNDLE_REP_EPISODE: Record<string, number> = {
            'bundle-0-2': 0, 'bundle-3-7': 3, 'bundle-8-12': 8, 'bundle-full': 0,
          };
          const isBundleId = assetId.startsWith('bundle-') || assetId.endsWith('-investor') ||
            assetId.startsWith('knyt-') || assetId.startsWith('top-knyt') ||
            assetId.startsWith('first-knyt') || assetId.startsWith('zero-knyt') ||
            assetId.startsWith('satoshi-knyt') || assetId.startsWith('digital-knyt') ||
            assetId.startsWith('digital-first-knyt');

          // gn-investor-* SKUs: Graphic Novel investor bundles. Match before
          // the generic UUID/episode/bundle branches so AGN gets proper label
          // + cover. CID matches the AGN hero image used by the store/codex.
          const GN_INVESTOR_EDITIONS: Record<string, string> = {
            'gn-investor-qripto':    'Qripto Edition',
            'gn-investor-digital':   'Digital Edition',
            'gn-investor-paperback': 'Paperback Edition',
            'gn-investor-hardcover': 'Hardcover Edition',
          };

          if (GN_INVESTOR_EDITIONS[assetId]) {
            // No episodeNumber — keeps label fallback chain on meta.title
            // (otherwise wallet would render "Ep. -1" instead of the title).
            assetMeta = {
              title: `Agentic Graphic Novel — ${GN_INVESTOR_EDITIONS[assetId]}`,
              coverType: 'GN',
              coverCid: 'bafkr6ifnltnq2xidhizv7lkvrevsipvl4l7qx6weca42q5iacffmybuxzm',
            };
          } else if (isUuid || charCardMatch) {
            // Direct UUID lookup — bare UUID or extracted from character-card-[UUID]-still/motion
            const lookupId = charCardMatch ? charCardMatch[1] : assetId;
            const isMotion = charCardMatch ? charCardMatch[2]?.toLowerCase() === 'motion' : false;

            const { data: asset } = await supabase
              .from('codex_media_assets')
              .select('id, title, asset_kind, episode_number, auto_drive_cid, cover_thumb_url')
              .eq('id', lookupId)
              .single();

            if (asset) {
              let characterName = asset.title;
              characterName = characterName?.replace(/\s+(front|back)$/i, '').trim();
              const parenMatch = characterName?.match(/^([^(]+)/);
              if (parenMatch) characterName = parenMatch[1].trim();

              const { coverUrl: charCoverUrl, coverCid: charCoverCid } = resolveAssetThumb(asset);
              assetMeta = {
                title: asset.title,
                assetKind: asset.asset_kind,
                episodeNumber: asset.episode_number,
                autoDriveCid: asset.auto_drive_cid,
                coverUrl: charCoverUrl,
                coverCid: charCoverCid,
                characterName,
                coverType: 'CHARACTER',
                isMotion,
              };
            }
          } else if (charCardEpMatch) {
            // Numeric character card from cart: character-card-N-still / -motion / -bundle
            // N is the pricing-convention episode number; codex_media_assets stores
            // the character_poster at db convention (epN + 1). Query both candidates.
            const epNum = parseInt(charCardEpMatch[1], 10);
            const modality = charCardEpMatch[2]?.toLowerCase();
            const isMotion = modality === 'motion';

            const { data: charAssets } = await supabase
              .from('codex_media_assets')
              .select('id, title, asset_kind, episode_number, auto_drive_cid, cover_thumb_url')
              .eq('asset_kind', 'character_poster')
              .in('episode_number', [epNum, epNum + 1])
              .limit(4);

            const dbRow = (charAssets || []).find((a) => a.episode_number === epNum + 1);
            const pricingRow = (charAssets || []).find((a) => a.episode_number === epNum);
            const asset = dbRow || pricingRow;

            if (asset) {
              let characterName = asset.title?.replace(/\s+(front|back)$/i, '').trim();
              const parenMatch = characterName?.match(/^([^(]+)/);
              if (parenMatch) characterName = parenMatch[1].trim();

              const { coverUrl: charCoverUrl, coverCid: charCoverCid } = resolveAssetThumb(asset);
              assetMeta = {
                title: characterName || `Character #${epNum}`,
                assetKind: asset.asset_kind,
                episodeNumber: epNum,
                autoDriveCid: asset.auto_drive_cid,
                coverUrl: charCoverUrl,
                coverCid: charCoverCid,
                characterName,
                coverType: 'CHARACTER',
                isMotion,
              };
            } else {
              assetMeta = {
                title: `Character #${epNum}`,
                characterName: `Character #${epNum}`,
                coverType: 'CHARACTER',
                isMotion,
              };
            }
          } else if (epMatch) {
            // Episode asset. Two id conventions appear here:
            //   pricing convention (cart writes): episode-2-qripto-still → epNum=2 → db ep=3
            //   db convention (master_content_qubes): mk_ep02_print_common → epNum=2 → db ep=2
            // Look up both candidates in the pre-fetched thumbnail map so we
            // never miss a cover the store would have shown.
            const epNumExtracted = parseInt(epMatch[1], 10);
            const dbEp = epIsDbConvention ? epNumExtracted : epNumExtracted + 1;
            const altEp = epIsDbConvention ? epNumExtracted + 1 : epNumExtracted;
            const displayEp = epIsDbConvention ? epNumExtracted - 1 : epNumExtracted;
            const isMotion = assetId.toLowerCase().includes('motion');

            const cover = coverByDbEp.get(dbEp) || coverByDbEp.get(altEp);
            const { coverUrl, coverCid } = resolveAssetThumb(cover);
            const rarity = cover?.rarity_tier?.toUpperCase();
            const coverType = isMotion ? 'MOTION' : (rarity || 'RARE');

            assetMeta = {
              title: `Episode ${displayEp}`,
              episodeNumber: displayEp,
              coverType,
              coverUrl,
              coverCid,
              isMotion,
            };
          } else if (isBundleId) {
            // Bundle. Investor bundles (top-knyt-investor etc.) carry an
            // editorial label + multi-episode contents in BUNDLE_PRICING; use
            // that for the title and a representative cover. Public bundles
            // fall back to the legacy BUNDLE_REP_EPISODE lookup.
            const bundleSpec = BUNDLE_PRICING.find((b) => b.id === assetId);
            const isInvestor = bundleSpec?.isInvestorOnly === true;

            // Pick a representative episode (db convention) for the cover.
            // Investor bundles list episodes in pricing convention starting
            // at -1 (GN) — skip GN and grab the first real episode (db = ep+1).
            let repDbEp: number | null = null;
            if (bundleSpec) {
              const firstReal = (bundleSpec.episodes || []).find((e) => e >= 0);
              if (firstReal !== undefined) repDbEp = firstReal + 1;
            } else if (assetId in BUNDLE_REP_EPISODE) {
              repDbEp = BUNDLE_REP_EPISODE[assetId] + 1;
            }

            let bundleCoverUrl: string | undefined;
            let bundleCoverCid: string | undefined;
            if (repDbEp !== null) {
              const cover = coverByDbEp.get(repDbEp) || coverByDbEp.get(repDbEp - 1);
              const resolved = resolveAssetThumb(cover);
              bundleCoverUrl = resolved.coverUrl;
              bundleCoverCid = resolved.coverCid;
            }

            // Investor bundles all include some form of AGN — fall back to the
            // AGN hero CID so the wallet always renders something recognizable.
            if (!bundleCoverUrl && !bundleCoverCid && isInvestor) {
              bundleCoverCid = 'bafkr6ifnltnq2xidhizv7lkvrevsipvl4l7qx6weca42q5iacffmybuxzm';
            }

            const fallbackTitle = assetId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            assetMeta = {
              title: bundleSpec?.label || fallbackTitle,
              coverUrl: bundleCoverUrl,
              coverCid: bundleCoverCid,
              coverType: 'BUNDLE',
            };
          }
        }
        
        return {
          ...ent,
          assetMeta,
        };
      })
    );
    
    return NextResponse.json({
      personaId,
      entitlements: enrichedEntitlements,
      count: enrichedEntitlements.length,
    });
  } catch (error) {
    console.error('[API] Error listing entitlements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500,  });
  }
}

export async function OPTIONS() {
  return new Response(null);
}
