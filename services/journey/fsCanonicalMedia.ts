/**
 * fsCanonicalMedia — resolves the CFS Bridge Content Pack's real, already-
 * produced infographic assets (verified live in `codex_media_assets`,
 * 2026-09-03: all 8 rows `status='active'`, `is_shareable=true`, titled
 * `CFS-<ref>-...-v1.png`) into their public delivery URL via the existing
 * canonical media resolver route (`app/api/content/media/[id]/route.ts`,
 * the same one KNYT/Qriptopian canonical plates already use — no new
 * delivery mechanism). A relative path, so it resolves correctly in every
 * environment (dev/staging/prod) rather than hardcoding a host.
 *
 * These assetRefs are the SAME ones `services/journey/financialSovereigntyContent.ts`
 * already carries as `FsStageAsset.assetRef` / `FS_LEARN_PLATES[i].assetRef`
 * — this module only adds the id → URL half, never duplicates the
 * title/caption/alt metadata that module already owns.
 *
 * An admin-published `infographicUrl` (knyts_bridge_editorial_config, via
 * fsBridgeSectionKey) still overrides these at render time — this is only
 * the fallback used while that field is empty. All 8 real assets exist
 * today; there is no "genuinely missing" asset to placeholder for.
 */

export const FS_CANONICAL_INFOGRAPHIC_ASSET_IDS: Record<string, string> = {
  'D-I01': '39c405cb-5bb1-43cd-8189-df0ebf8e6e0c',
  'L-I01': '4914fb87-ca43-4d7f-ab39-4fff3abe6153',
  'L-I02': '49462553-b46b-4578-96da-c1ba01389c23',
  'L-I03': '19597079-12a6-432f-a0b2-f660349eea78',
  'E-I01': '185f42c6-bbb6-4d7c-88e7-367226a4ac29',
  'P-I01': 'a77443a8-41f7-41ae-bb45-b2e550ed36f9',
  'O-I01': '7d5e3468-687a-4a6c-9238-cebab874018a',
  'C-I01': '9f85cc64-4a5d-4347-b705-06401d534ccc',
};

/** Returns the real, resolvable public URL for a CFS pack asset ref (e.g.
 *  'D-I01'), or null if the ref isn't one of the 8 known canonical assets
 *  (never fabricates a URL for an unknown ref). */
export function resolveFsCanonicalInfographicUrl(assetRef: string): string | null {
  const id = FS_CANONICAL_INFOGRAPHIC_ASSET_IDS[assetRef];
  return id ? `/api/content/media/${id}` : null;
}
