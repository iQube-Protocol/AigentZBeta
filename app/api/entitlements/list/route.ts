/**
 * API Route: List Entitlements
 * GET /api/entitlements/list?personaId=xxx
 * 
 * Gets all entitlements for a persona with enriched asset metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntitlementService } from '@/services/rewards/entitlementService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    
    // Enrich entitlements with asset metadata
    const enrichedEntitlements = await Promise.all(
      entitlements.map(async (ent) => {
        const assetId = ent.assetId;
        let assetMeta: any = {};
        
        // Try to find asset in codex_media_assets
        if (assetId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId);

          // character-card-[UUID]-still or character-card-[UUID]-motion (cart purchase format)
          const charCardMatch = assetId.match(
            /^character-card-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-(still|motion))?$/i
          );

          // episode-N, episode-N-qripto-still, episode-N-digital-motion, mk_ep01, ep1, etc.
          const epMatch = assetId.match(/(?:episode[_-]?|ep)(\d+)/i);

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

              assetMeta = {
                title: asset.title,
                assetKind: asset.asset_kind,
                episodeNumber: asset.episode_number,
                autoDriveCid: asset.auto_drive_cid,
                coverUrl: asset.cover_thumb_url || undefined,
                coverCid: !asset.cover_thumb_url ? (asset.auto_drive_cid || undefined) : undefined,
                characterName,
                coverType: 'CHARACTER',
                isMotion,
              };
            }
          } else if (epMatch) {
            // Episode asset: episode-1, episode-1-qripto-still, mk_ep01, ep01_motion, etc.
            // Cart purchase ids carry the pricing-convention episode number
            // (E0 → 0, E1 → 1, …). codex_media_assets stores the autodrive
            // episode_number which is the db convention = pricingEp + 1
            // (mk_ep1 → pricingEp 0, mk_ep2 → pricingEp 1, …). Query both
            // candidates and prefer the db-convention row when present so
            // wallet thumbnails resolve for purchases written in pricing
            // convention. Falls back to pricingEp for any legacy rows that
            // happened to be seeded under the pricing number.
            const epNum = parseInt(epMatch[1], 10);
            const isMotion = assetId.toLowerCase().includes('motion');

            const { data: epAssets } = await supabase
              .from('codex_media_assets')
              .select('id, title, asset_kind, rarity, auto_drive_cid, cover_thumb_url, episode_number')
              .in('episode_number', [epNum, epNum + 1])
              .in('asset_kind', ['motion_master', 'print_rare', 'print_epic', 'print_legendary', 'cover_image'])
              .limit(10);

            const preferDbEp = epNum + 1;
            const dbConventionRows = (epAssets || []).filter((a) => a.episode_number === preferDbEp);
            const pricingConventionRows = (epAssets || []).filter((a) => a.episode_number === epNum);
            const chosenAssets = dbConventionRows.length > 0 ? dbConventionRows : pricingConventionRows;

            const printAsset = chosenAssets.find((a) => a.asset_kind?.startsWith('print_'));
            const coverType = printAsset
              ? printAsset.asset_kind?.replace('print_', '').toUpperCase()
              : (isMotion ? 'MOTION' : 'RARE');
            const motionAsset = chosenAssets.find((a) => a.asset_kind === 'motion_master');
            const coverAsset = chosenAssets.find((a) => a.asset_kind === 'cover_image');
            const bestAsset = coverAsset || printAsset;
            const coverUrl = bestAsset?.cover_thumb_url || undefined;
            const coverCid = !coverUrl ? (bestAsset?.auto_drive_cid || undefined) : undefined;

            assetMeta = {
              title: `Episode ${epNum}`,
              episodeNumber: epNum,
              coverType: isMotion ? 'MOTION' : coverType,
              autoDriveCid: motionAsset?.auto_drive_cid,
              coverUrl,
              coverCid,
              isMotion,
            };
          } else if (isBundleId) {
            // Bundle — use cover of the representative episode
            const repEp = BUNDLE_REP_EPISODE[assetId] ?? 1;
            const { data: epAssets } = await supabase
              .from('codex_media_assets')
              .select('id, asset_kind, auto_drive_cid, cover_thumb_url')
              .eq('episode_number', repEp)
              .in('asset_kind', ['cover_image', 'print_rare', 'print_epic', 'print_legendary'])
              .limit(3);

            const coverAsset = (epAssets || []).find(a => a.asset_kind === 'cover_image')
              || (epAssets || [])[0];
            assetMeta = {
              title: assetId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              coverUrl: coverAsset?.cover_thumb_url || undefined,
              coverCid: !coverAsset?.cover_thumb_url ? (coverAsset?.auto_drive_cid || undefined) : undefined,
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
