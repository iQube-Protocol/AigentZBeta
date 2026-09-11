/**
 * codexAssetUploadHandler — the shared core of `POST /api/admin/codex/upload-asset`
 * (2026-09-02 authorization repair). Extracted so TWO callers with two
 * different authorization models can both reach it safely:
 *
 *   1. The browser route (`app/api/admin/codex/upload-asset/route.ts`) — now
 *      gated by `requireAdminPersona` BEFORE calling this function.
 *   2. The Threshold executor (`services/threshold/uploadContentAsset.ts`)
 *      — calls this function DIRECTLY, in-process, after its OWN Threshold
 *      bearer/session authorization has already succeeded upstream (its own
 *      header comment: "Authority is established before entry"). It no
 *      longer makes an unauthenticated internal HTTP hop to the admin route
 *      to reach this logic — that hop was the actual defect (an admin-only
 *      operation reachable with zero authorization from either caller,
 *      since the route itself never enforced anything and the hop carried
 *      no credential to enforce against even if it had).
 *
 * This function itself performs NO authorization check — it trusts that
 * whichever caller invoked it already established authority through its own
 * correct mechanism. Never call this from a new, unaudited entry point
 * without adding an authorization check at THAT entry point first.
 */

import {
  uploadCodexMediaAsset,
  CodexAssetKind,
  validateFileType,
} from '@/server/services/autonomysContentService';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';

type DisplayMode = 'pdf' | 'image' | 'video' | 'text_extract';

export interface CodexAssetUploadMetadata {
  title: string;
  assetKind: CodexAssetKind;
  episodeNumber?: number;
  series?: string;
  priceAmount?: number;
  paymentType?: 'one-time' | 'subscription';
  paymentSurface?: 'overlay' | 'embedded' | 'liquid';
  variantName?: string;
  rarityTier?: 'legendary' | 'epic' | 'rare' | 'common';
  editionMax?: number;
  randomWeight?: number;
  isShareable?: boolean;
  recommendedTask?: string;
  displayMode?: DisplayMode;
}

export interface CodexAssetUploadResult {
  success: true;
  id: string;
  cid: string;
  kbDocumentId?: string;
  data: {
    id: string;
    cid: string;
    metaQubeId?: string;
    blakQubeId?: string;
    tokenQubeId?: string;
    assetKind: CodexAssetKind;
    episodeNumber?: number;
    priceAmount?: number;
    paymentType?: string;
    paymentSurface?: string;
    kbDocumentId?: string;
  };
}

export class CodexAssetUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const VALID_ASSET_KINDS: CodexAssetKind[] = [
  'character_poster',
  'powers_sheet',
  'background_lore_doc',
  'game_concept_doc',
  'game_still',
  'game_video',
  'twenty_one_sats_concept',
  'social_campaign_video',
  'social_campaign_image',
  'cover_pdf',
  'cover_image',
  'cover_motion',
  'ra_badge',
  'bundle_pack',
];

function metadataFromFormData(formData: FormData): CodexAssetUploadMetadata {
  const metadataStr = formData.get('metadata') as string | null;
  if (metadataStr) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(metadataStr);
    } catch {
      throw new CodexAssetUploadError('Invalid metadata JSON', 400);
    }
    return parsed as CodexAssetUploadMetadata;
  }

  const title = formData.get('title') as string | null;
  const assetKind = formData.get('assetKind') as string | null;
  if (!title || !assetKind) {
    throw new CodexAssetUploadError('Missing required fields: title, assetKind', 400);
  }
  const episodeNumber = formData.get('episodeNumber') as string | null;
  const series = formData.get('series') as string | null;
  const variantName = formData.get('variantName') as string | null;
  const rarityTier = formData.get('rarityTier') as string | null;
  const editionMax = formData.get('editionMax') as string | null;
  const priceAmount = formData.get('priceAmount') as string | null;
  const paymentType = formData.get('paymentType') as string | null;
  const paymentSurface = formData.get('paymentSurface') as string | null;
  const isShareable = formData.get('isShareable') as string | null;
  const displayMode = formData.get('displayMode') as string | null;

  const parsedPriceAmount = priceAmount !== null && priceAmount.trim() !== '' ? Number(priceAmount) : undefined;
  if (parsedPriceAmount !== undefined && (!Number.isFinite(parsedPriceAmount) || parsedPriceAmount < 0)) {
    throw new CodexAssetUploadError('Invalid priceAmount. Must be a non-negative number.', 400);
  }

  return {
    title,
    assetKind: assetKind as CodexAssetKind,
    episodeNumber: episodeNumber ? parseInt(episodeNumber, 10) : undefined,
    series: series || 'metaKnyts',
    priceAmount: parsedPriceAmount,
    paymentType: paymentType === 'subscription' ? 'subscription' : paymentType === 'one-time' ? 'one-time' : undefined,
    paymentSurface:
      paymentSurface === 'embedded' || paymentSurface === 'liquid' || paymentSurface === 'overlay'
        ? paymentSurface
        : undefined,
    variantName: variantName || undefined,
    rarityTier: rarityTier as CodexAssetUploadMetadata['rarityTier'],
    editionMax: editionMax ? parseInt(editionMax, 10) : undefined,
    displayMode: displayMode as DisplayMode | undefined,
    isShareable: isShareable === 'true' ? true : undefined,
  };
}

/**
 * Uploads a codex media asset from a FormData payload (the same shape both
 * `CodexUploadModal.tsx` and the Threshold executor's `uploadForm` already
 * build). Performs the SAME validation, upload, and PDF-knowledge-base
 * extraction the route always did — behavior is unchanged from the caller's
 * point of view, only WHERE authorization is checked has moved.
 */
export async function handleCodexAssetUpload(formData: FormData): Promise<CodexAssetUploadResult> {
  const file = formData.get('file') as File | null;
  if (!file) {
    throw new CodexAssetUploadError('No file provided', 400);
  }

  const metadata = metadataFromFormData(formData);
  if (!metadata.title || !metadata.assetKind) {
    throw new CodexAssetUploadError('Missing required fields: title, assetKind', 400);
  }
  if (!VALID_ASSET_KINDS.includes(metadata.assetKind)) {
    throw new CodexAssetUploadError(`Invalid assetKind. Must be one of: ${VALID_ASSET_KINDS.join(', ')}`, 400);
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!validateFileType(mimeType, metadata.assetKind)) {
    throw new CodexAssetUploadError(`Invalid file type ${mimeType} for ${metadata.assetKind}`, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await uploadCodexMediaAsset({
    file: buffer,
    mimeType,
    title: metadata.title,
    assetKind: metadata.assetKind,
    episodeNumber: metadata.episodeNumber,
    series: metadata.series || 'metaKnyts',
    priceAmount: metadata.priceAmount,
    paymentType: metadata.paymentType,
    paymentSurface: metadata.paymentSurface,
    variantName: metadata.variantName,
    rarityTier: metadata.rarityTier,
    editionMax: metadata.editionMax,
    randomWeight: metadata.randomWeight,
    isShareable: metadata.isShareable,
    recommendedTask: metadata.recommendedTask,
    displayMode: metadata.displayMode,
  });

  let kbDocumentId: string | undefined;
  const isPdfAsset =
    mimeType === 'application/pdf' ||
    metadata.assetKind === 'cover_pdf' ||
    metadata.assetKind === 'background_lore_doc' ||
    metadata.assetKind === 'game_concept_doc' ||
    metadata.assetKind === 'twenty_one_sats_concept';

  if (isPdfAsset && result.cid) {
    try {
      const kbService = getKnowledgeBaseService();
      let contentCategory = 'general';
      if (metadata.assetKind === 'background_lore_doc') contentCategory = 'world_building';
      else if (metadata.assetKind === 'game_concept_doc') contentCategory = 'technical';
      else if (metadata.assetKind === 'twenty_one_sats_concept') contentCategory = 'lore';
      else if (metadata.assetKind === 'cover_pdf') contentCategory = 'episode_content';

      const kbResult = await kbService.processPdfFromBuffer(buffer, {
        title: metadata.title,
        domain: 'metaKnyts',
        series: metadata.series || 'metaKnyts',
        episodeNumber: metadata.episodeNumber,
        contentCategory,
        sourceCid: result.cid,
        sourceId: result.id,
        tags: [metadata.assetKind],
      });
      if (kbResult.success) kbDocumentId = kbResult.documentId;
    } catch {
      // Non-fatal — the asset upload itself already succeeded (unchanged
      // from the route's own prior behavior).
    }
  }

  return {
    success: true,
    id: result.id,
    cid: result.cid,
    kbDocumentId,
    data: {
      id: result.id,
      cid: result.cid,
      metaQubeId: result.metaQubeId,
      blakQubeId: result.blakQubeId,
      tokenQubeId: result.tokenQubeId,
      assetKind: metadata.assetKind,
      episodeNumber: metadata.episodeNumber,
      priceAmount: metadata.priceAmount,
      paymentType: metadata.paymentType,
      paymentSurface: metadata.paymentSurface,
      kbDocumentId,
    },
  };
}
