/**
 * getContentDescriptor — server-side builder for ContentAccessDescriptor.
 *
 * Phase 1.2 of the unified identity-content-access foundation plan.
 *
 * Reads `master_content_qubes` (TEXT id, e.g. mk_ep00_print_common) and
 * `codex_media_assets` (UUID id) and emits a single normalised
 * ContentAccessDescriptor that downstream consumers (evaluateAccess, the
 * delivery proxies, the SmartTriad spine) act on uniformly.
 *
 * Composition (additive):
 *   - services/rewards/contentGating.classifyContentGating  — gating kind
 *   - master_content_qubes / codex_media_assets row read    — envelope
 *
 * State derivation (best-effort against current schema):
 *   gating='free' AND no encryption_iv     -> A_open_unqubed
 *   gating='free' AND encryption_iv set    -> B_open_iqubed
 *   gating in (payment|credential)
 *     AND auto_drive_cid LIKE 'http%'      -> C_gated_wip       (Supabase-hosted)
 *     AND auto_drive_cid is a CID          -> D_gated_canonical_pool
 *   State E (sovereign per-holder) is never returned by this builder;
 *   Phase 4b lights it up via a per-holder envelope read keyed by the
 *   active persona.
 *
 * The descriptor is intentionally identity-agnostic — it describes the
 * asset, not the caller. The caller-aware decision is `evaluateAccess`.
 */

import { classifyContentGating, type GatingKind as ClassifierKind } from '@/services/rewards/contentGating';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  ContentAccessDescriptor,
  ContentClass,
  ContentIQubeEnvelope,
  ContentState,
  ContentStoragePointer,
  GatingKind,
} from '@/types/access';

// Timeout-guarded Supabase client (8s prod / 4s dev). When the DB is
// slow, queries fail in 8s instead of hanging to Lambda's 30s timeout
// and returning an empty 504. The canonical factory.
function db() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for getContentDescriptor');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Row shapes (loose; schema may have additional columns we ignore)
// ─────────────────────────────────────────────────────────────────────────

interface MasterQubeRow {
  id: string;
  content_type: string | null;
  episode_number: number | null;
  series: string | null;
  auto_drive_cid: string | null;
  pdf_lite_url: string | null;
  encryption_iv: string | null;
  encryption_auth_tag?: string | null;
  token_qube_id: string | null;
  meta_qube_id: string | null;
  blak_qube_id: string | null;
  gating_kind: ClassifierKind | null;
  gating_credential?: string | null;
  mint_status?: string | null;
}

interface MediaAssetRow {
  id: string;
  asset_kind: string | null;
  episode_number: number | null;
  series: string | null;
  auto_drive_cid: string | null;
  encryption_iv: string | null;
  encryption_auth_tag?: string | null;
  token_qube_id: string | null;
  meta_qube_id: string | null;
  blak_qube_id: string | null;
  gating_kind: ClassifierKind | null;
  gating_credential?: string | null;
  mint_status?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────

function mapContentTypeToClass(value: string | null, episodeNumber: number | null): ContentClass {
  // Canonical convention: GN sits at episode_number = -1 (with
  // content_type='gn_still'); 0..12 are the 13 displayed episodes.
  if (episodeNumber === -1) return 'gn';
  switch (value) {
    case 'episode_still':  return 'episode_still';
    case 'episode_motion': return 'episode_motion';
    case 'episode_print':  return 'episode_print';
    default:               return 'other';
  }
}

function mapAssetKindToClass(value: string | null): ContentClass {
  switch (value) {
    case 'character_poster':        return 'character_card';
    case 'background_lore_doc':     return 'lore';
    case 'powers_sheet':            return 'lore';
    case 'twenty_one_sats_concept': return 'lore';
    default:                        return 'other';
  }
}

function isHttpPointer(p: string | null | undefined): boolean {
  return typeof p === 'string' && /^https?:\/\//i.test(p);
}

function deriveContentState(
  gatingKind: GatingKind,
  hasEncryption: boolean,
  storagePointer: string | null,
): ContentState {
  if (gatingKind === 'free') {
    return hasEncryption ? 'B_open_iqubed' : 'A_open_unqubed';
  }
  // Gated (payment | credential)
  if (isHttpPointer(storagePointer)) return 'C_gated_wip';
  return 'D_gated_canonical_pool';
}

function derivePreferredPointer(
  autoDriveCid: string | null,
  pdfLiteUrl: string | null,
): { backend: ContentStoragePointer['backend']; pointer: string } | null {
  // Prefer pdf_lite_url for state-A/B PDFs (Supabase direct-read works there).
  // Otherwise fall back to auto_drive_cid which holds either a CID or a
  // Supabase URL (legacy overload retired in Phase 2 schema disambiguation).
  if (pdfLiteUrl && isHttpPointer(pdfLiteUrl)) {
    return { backend: 'supabase', pointer: pdfLiteUrl };
  }
  if (autoDriveCid) {
    return isHttpPointer(autoDriveCid)
      ? { backend: 'supabase', pointer: autoDriveCid }
      : { backend: 'autodrive', pointer: autoDriveCid };
  }
  return null;
}

function buildEnvelope(
  iv: string | null,
  authTag: string | null | undefined,
  storage: ContentStoragePointer,
  ids: { metaQubeId: string | null; blakQubeId: string | null; tokenQubeId: string | null },
): ContentIQubeEnvelope | undefined {
  if (!ids.metaQubeId && !ids.blakQubeId && !ids.tokenQubeId && !iv) {
    return undefined; // pure state A
  }
  const envelope: ContentIQubeEnvelope = {
    metaQubeId: ids.metaQubeId ?? '',
    blakQubeId: ids.blakQubeId ?? '',
    storage,
  };
  if (ids.tokenQubeId) envelope.tokenQubeId = ids.tokenQubeId;
  if (iv) {
    envelope.encryption = {
      alg: 'AES-256-GCM',
      iv,
      // Auth tag may not yet be present on legacy rows — the Phase 2
      // encryption migration backfills it. Empty string is a known sentinel.
      authTag: authTag ?? '',
    };
  }
  return envelope;
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export async function getContentDescriptor(
  assetId: string,
): Promise<ContentAccessDescriptor | null> {
  if (!assetId || typeof assetId !== 'string') return null;

  // 1) master_content_qubes (TEXT pk, e.g. mk_ep00_print_common)
  //
  // Use select('*') so the query succeeds regardless of which optional
  // columns (gating_kind, gating_credential, mint_status, pdf_lite_url)
  // exist on the deployed schema. PostgREST silently returns data:null
  // when ANY referenced column is missing — so a strict explicit select
  // becomes a brittle dependency on migration order. Reading optional
  // fields defensively from the row is the resilient path.
  const { data: masterRaw, error: masterErr } = await db()
    .from('master_content_qubes')
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (masterErr) {
    // Don't silently null — operator needs to see transient errors so
    // 'descriptor not found' on a known-good asset is distinguishable
    // from 'rate-limited' / 'cold-start timeout' / 'transient supabase'.
    console.warn(
      `[getContentDescriptor] master_content_qubes error assetId=${assetId} ` +
      `code=${masterErr.code ?? '?'} message=${masterErr.message ?? '?'}`,
    );
  }
  const master = masterRaw as MasterQubeRow | null;

  if (master) {
    const contentClass = mapContentTypeToClass(master.content_type, master.episode_number);
    const gating = classifyContentGating({
      gating_kind: master.gating_kind,
      gating_credential: master.gating_credential ?? null,
      contentType: master.content_type,
    });

    // NOTE 2026-05-06 — operator clarification: the GN (episode 0) is
    // NOT a free asset. An earlier handover doc referred to a "GN free-
    // preview short-circuit" which was aspirational, not implemented,
    // and not the operator's intent. The GN must remain gated like any
    // other paid episode. Real preview affordances (first N pages of
    // print / first 30–60s of motion) are a backlog feature; see
    // codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md
    // §11.f for the proper-preview backlog row.
    //
    // The classifier's category-default (episode_print → payment) is
    // therefore the correct answer for ep=0 and ep>0 alike. Row-level
    // gating_kind overrides still take precedence (operator can flip
    // any individual row to free explicitly via the column).
    const pointer = derivePreferredPointer(master.auto_drive_cid, master.pdf_lite_url);
    const hasEncryption = !!master.encryption_iv;
    const storagePointer = pointer
      ? pointer.pointer
      : (master.auto_drive_cid ?? master.pdf_lite_url ?? null);
    const state = deriveContentState(gating.kind, hasEncryption, storagePointer);

    const storage: ContentStoragePointer | null = pointer
      ? { backend: pointer.backend, pointer: pointer.pointer }
      : null;

    return {
      assetId: master.id,
      contentClass,
      state,
      gating: {
        kind: gating.kind,
        credential: gating.credential,
        priceUsd: gating.priceUsd,
        reason: gating.reason,
      },
      iqube: storage
        ? buildEnvelope(
            master.encryption_iv,
            master.encryption_auth_tag,
            storage,
            {
              metaQubeId: master.meta_qube_id,
              blakQubeId: master.blak_qube_id,
              tokenQubeId: master.token_qube_id,
            },
          )
        : undefined,
      // State C/D delivery is receipt-eligible (audit per-read access).
      // State A/B is not; reading free content does not anchor a receipt.
      receiptEligible: state === 'C_gated_wip' || state === 'D_gated_canonical_pool',
    };
  }

  // 2) codex_media_assets (UUID pk) — same select('*') resilience
  const { data: assetRaw, error: assetErr } = await db()
    .from('codex_media_assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (assetErr) {
    console.warn(
      `[getContentDescriptor] codex_media_assets error assetId=${assetId} ` +
      `code=${assetErr.code ?? '?'} message=${assetErr.message ?? '?'}`,
    );
  }
  const asset = assetRaw as MediaAssetRow | null;
  if (!asset) return null;

  const contentClass = mapAssetKindToClass(asset.asset_kind);
  const gating = classifyContentGating({
    gating_kind: asset.gating_kind,
    gating_credential: asset.gating_credential ?? null,
    assetKind: asset.asset_kind,
  });
  const pointer = derivePreferredPointer(asset.auto_drive_cid, null);
  const hasEncryption = !!asset.encryption_iv;
  const state = deriveContentState(gating.kind, hasEncryption, asset.auto_drive_cid);
  const storage: ContentStoragePointer | null = pointer
    ? { backend: pointer.backend, pointer: pointer.pointer }
    : null;

  return {
    assetId: asset.id,
    contentClass,
    state,
    gating: {
      kind: gating.kind,
      credential: gating.credential,
      priceUsd: gating.priceUsd,
      reason: gating.reason,
    },
    iqube: storage
      ? buildEnvelope(
          asset.encryption_iv,
          asset.encryption_auth_tag,
          storage,
          {
            metaQubeId: asset.meta_qube_id,
            blakQubeId: asset.blak_qube_id,
            tokenQubeId: asset.token_qube_id,
          },
        )
      : undefined,
    receiptEligible: state === 'C_gated_wip' || state === 'D_gated_canonical_pool',
  };
}

/**
 * Convenience: resolve a descriptor by Autonomys CID (or Supabase URL when
 * the legacy auto_drive_cid overload still applies). Used by delivery
 * proxies that key off the CID rather than the canonical assetId.
 *
 * Lookup order:
 *   1. master_content_qubes.auto_drive_cid OR master_content_qubes.pdf_lite_url
 *   2. codex_media_assets.auto_drive_cid
 *   3. iq_blak_qubes.cid -> back-resolve to the master/asset row that
 *      references that blak_qube_id (covers cases where the canonical
 *      payload CID lives on the BlakQube row, not duplicated on the master)
 *
 * Falls through to `getContentDescriptor(assetId)` once the row's
 * canonical id is found, so the descriptor shape is identical regardless
 * of input.
 */
export async function getContentDescriptorByCid(
  cid: string,
): Promise<ContentAccessDescriptor | null> {
  if (!cid) return null;

  // 1) master_content_qubes — pdf_lite_url and auto_drive_cid both candidates
  const { data: masterRaw, error: masterErr } = await db()
    .from('master_content_qubes')
    .select('id')
    .or(`auto_drive_cid.eq.${cid},pdf_lite_url.eq.${cid}`)
    .maybeSingle();
  if (masterErr) {
    console.warn(
      `[getContentDescriptorByCid] master_content_qubes lookup error cid=${cid.slice(0, 16)} ` +
      `code=${masterErr.code ?? '?'} message=${masterErr.message ?? '?'}`,
    );
  }
  const masterId = (masterRaw as { id?: string } | null)?.id;
  if (masterId) return getContentDescriptor(masterId);

  // 2) codex_media_assets — auto_drive_cid only
  const { data: assetRaw, error: assetErr } = await db()
    .from('codex_media_assets')
    .select('id')
    .eq('auto_drive_cid', cid)
    .maybeSingle();
  if (assetErr) {
    console.warn(
      `[getContentDescriptorByCid] codex_media_assets lookup error cid=${cid.slice(0, 16)} ` +
      `code=${assetErr.code ?? '?'} message=${assetErr.message ?? '?'}`,
    );
  }
  const assetId = (assetRaw as { id?: string } | null)?.id;
  if (assetId) return getContentDescriptor(assetId);

  // 3) iq_blak_qubes.cid — payload CID may live on the BlakQube row only.
  //    Find the blak_qube_id, then back-resolve to whichever master /
  //    codex_media_asset references it.
  const { data: blakRaw } = await db()
    .from('iq_blak_qubes')
    .select('id')
    .eq('cid', cid)
    .maybeSingle();
  const blakQubeId = (blakRaw as { id?: string } | null)?.id;
  if (blakQubeId) {
    const { data: masterByBlak } = await db()
      .from('master_content_qubes')
      .select('id')
      .eq('blak_qube_id', blakQubeId)
      .maybeSingle();
    const masterIdByBlak = (masterByBlak as { id?: string } | null)?.id;
    if (masterIdByBlak) return getContentDescriptor(masterIdByBlak);

    const { data: assetByBlak } = await db()
      .from('codex_media_assets')
      .select('id')
      .eq('blak_qube_id', blakQubeId)
      .maybeSingle();
    const assetIdByBlak = (assetByBlak as { id?: string } | null)?.id;
    if (assetIdByBlak) return getContentDescriptor(assetIdByBlak);
  }

  return null;
}
