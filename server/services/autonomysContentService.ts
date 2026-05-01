/**
 * Autonomys Content Service
 * 
 * Handles encrypted file uploads to Autonomys Auto-Drive and
 * creates corresponding iQube registry entries.
 * 
 * Flow:
 * 1. Generate symmetric key + IV
 * 2. Encrypt file with AES-256-GCM
 * 3. Upload ciphertext to Autonomys → get CID
 * 4. Wrap key with project master key
 * 5. Create tokenQube, blakQube, metaQube entries
 * 6. Create master_content_qubes or codex_media_assets row
 */

import { createAutoDriveApi } from '@autonomys/auto-drive';
import {
  generateContentKey,
  encryptContent,
  wrapKeyWithMasterKey,
  computeChecksum,
  ENCRYPTION_ALGORITHM,
} from './encryptionService';
import {
  createMetaQube,
  createBlakQube,
  createTokenQube,
} from './iqRegistryService';
import { getSupabaseServer } from '../../app/api/_lib/supabaseServer';

// Helper to get Supabase client with null check
function getSupabase() {
  const client = getSupabaseServer();
  if (!client) {
    throw new Error('Supabase client not available');
  }
  return client;
}

// Types
export type MasterContentType = 'episode_still' | 'episode_motion' | 'episode_print';

export type EditionTier = 'rare' | 'epic' | 'legendary' | 'common';

export type CodexAssetKind =
  | 'character_poster'
  | 'powers_sheet'
  | 'background_lore_doc'
  | 'game_concept_doc'
  | 'game_still'
  | 'game_video'
  | 'twenty_one_sats_concept'
  | 'social_campaign_video'
  | 'social_campaign_image'
  | 'cover_pdf'
  | 'cover_image'
  | 'cover_motion'
  | 'ra_badge';

export interface MasterUploadParams {
  file: Buffer;
  mimeType: string;
  title: string;
  episodeNumber: number;
  contentType: MasterContentType;
  series?: string;
  // For episode_print content type
  editionTier?: EditionTier;
  priceAmount?: number;
  paymentType?: 'one-time' | 'subscription';
  paymentSurface?: 'overlay' | 'embedded' | 'liquid';
}

export type DisplayMode = 'pdf' | 'image' | 'video' | 'text_extract';

export interface CodexAssetUploadParams {
  file: Buffer;
  mimeType: string;
  title: string;
  assetKind: CodexAssetKind;
  episodeNumber?: number;
  series?: string;
  priceAmount?: number;
  paymentType?: 'one-time' | 'subscription';
  paymentSurface?: 'overlay' | 'embedded' | 'liquid';
  // Cover-specific
  variantName?: string;
  rarityTier?: 'legendary' | 'epic' | 'rare' | 'common';
  editionMax?: number;
  randomWeight?: number;
  // Social-specific
  isShareable?: boolean;
  recommendedTask?: string;
  // Lore-specific
  displayMode?: DisplayMode;
}

export interface UploadResult {
  id: string;
  cid: string;
  metaQubeId: string;
  blakQubeId: string;
  tokenQubeId: string;
}

// Initialize Autonomys Auto-Drive API
function getAutoDriveApi() {
  const apiKey = process.env.AUTONOMYS_API_KEY;
  if (!apiKey) {
    throw new Error('AUTONOMYS_API_KEY environment variable not set');
  }

  console.log('[AutonomysContent] Initializing Auto-Drive API with mainnet network');
  
  return createAutoDriveApi({
    apiKey,
    network: 'mainnet', // Use mainnet for production storage
  });
}

// Test Autonomys API connectivity
export async function testAutonomysConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'AUTONOMYS_API_KEY not set' };
    }
    
    // Try to create the API client
    const api = getAutoDriveApi();
    console.log('[AutonomysContent] API client created successfully');
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AutonomysContent] Connection test failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Upload and encrypt a master content file (episode still or motion comic)
 */
export async function uploadMasterContent(
  params: MasterUploadParams
): Promise<UploadResult> {
  const {
    file,
    mimeType,
    title,
    episodeNumber,
    contentType,
    series = 'metaKnyts',
    editionTier,
    priceAmount,
    paymentType,
    paymentSurface,
  } = params;

  // Validate editionTier for print editions
  if (contentType === 'episode_print' && !editionTier) {
    throw new Error('editionTier is required for episode_print content type');
  }

  const tierLabel = editionTier ? ` [${editionTier}]` : '';
  console.log(`[AutonomysContent] Uploading master content: ${title} (Episode ${episodeNumber}, ${contentType}${tierLabel})`);

  // 1. Generate encryption key and encrypt content
  const contentKey = generateContentKey();
  const encrypted = encryptContent(file, contentKey);
  const checksum = computeChecksum(file);

  console.log(`[AutonomysContent] Encrypted ${file.length} bytes → ${encrypted.ciphertext.length} bytes`);

  // 2. Upload to Autonomys
  const api = getAutoDriveApi();
  const cid = await uploadToAutonomys(api, encrypted.ciphertext, `${title}.enc`);

  console.log(`[AutonomysContent] Uploaded to Autonomys, CID: ${cid}`);

  // 3. Wrap key with master key
  const wrappedKey = wrapKeyWithMasterKey(contentKey);

  // 4. Create iQube registry entries
  // For print editions, include the tier in the slug
  const tierSuffix = editionTier ? `-${editionTier}` : '';
  const slug = `mk-ep${String(episodeNumber).padStart(2, '0')}-${contentType.replace('episode_', '')}${tierSuffix}`;

  // Build description based on content type
  let description: string;
  if (contentType === 'episode_print') {
    description = `${editionTier!.charAt(0).toUpperCase() + editionTier!.slice(1)} print edition for Episode ${episodeNumber}`;
  } else if (contentType === 'episode_motion') {
    description = `Motion comic for Episode ${episodeNumber}`;
  } else {
    description = `Still master content for Episode ${episodeNumber}`;
  }

  const tags = ['metaknyts', 'episode', contentType];
  if (editionTier) {
    tags.push(editionTier);
  }

  const metaQubeId = await createMetaQube({
    name: title,
    slug,
    qubeType: 'master_content',
    series,
    episodeNumber,
    tags,
    description,
    metadata: {
      ...(typeof priceAmount === 'number'
        ? {
            pricing: {
              amount: priceAmount,
              currency: 'Q¢',
              paymentType: paymentType || 'one-time',
              paymentSurface: paymentSurface || 'overlay',
            },
          }
        : {}),
    },
  });

  const blakQubeId = await createBlakQube({
    cid,
    payloadType: mimeType,
    provider: 'autonomys',
    encryptionAlg: ENCRYPTION_ALGORITHM,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    size: file.length,
    checksum,
  });

  const tokenQubeId = await createTokenQube({
    keyCiphertext: wrappedKey.keyCiphertext,
    wrappingAlg: wrappedKey.wrappingAlgorithm,
    keyType: 'AES-256',
  });

  // 5. Create master_content_qubes row
  const supabase = getSupabase();
  // For print editions, include tier in the ID: mk_ep01_print_rare
  const tierIdSuffix = editionTier ? `_${editionTier}` : '';
  const id = `mk_ep${String(episodeNumber).padStart(2, '0')}_${contentType.replace('episode_', '')}${tierIdSuffix}`;

  const { error } = await supabase
    .from('master_content_qubes')
    .upsert({
      id,
      title,                  // Auto-Drive label (locked at upload)
      supabase_title: title,  // editable display title (defaults to upload-time title)
      episode_number: episodeNumber,
      content_type: contentType,
      series,
      edition_tier: editionTier || null, // Only set for print editions
      auto_drive_cid: cid,
      mime_type: mimeType,
      file_size: file.length,
      encryption_alg: ENCRYPTION_ALGORITHM,
      encryption_iv: encrypted.iv,
      encryption_auth_tag: encrypted.authTag,
      token_qube_id: tokenQubeId,
      meta_qube_id: metaQubeId,
      blak_qube_id: blakQubeId,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('[AutonomysContent] Failed to create master_content_qubes row:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log(`[AutonomysContent] Created master content: ${id}`);

  return {
    id,
    cid,
    metaQubeId,
    blakQubeId,
    tokenQubeId,
  };
}

/**
 * Upload and encrypt a codex media asset (cover, character, lore, game, social)
 */
export async function uploadCodexMediaAsset(
  params: CodexAssetUploadParams
): Promise<UploadResult> {
  const {
    file,
    mimeType,
    title,
    assetKind,
    episodeNumber,
    series = 'metaKnyts',
    priceAmount,
    paymentType,
    paymentSurface,
    variantName,
    rarityTier,
    editionMax,
    randomWeight = 1,
    isShareable = false,
    recommendedTask,
    displayMode,
  } = params;

  console.log(`[AutonomysContent] Uploading media asset: ${title} (${assetKind})`);

  // 1. Generate encryption key and encrypt content
  const contentKey = generateContentKey();
  const encrypted = encryptContent(file, contentKey);
  const checksum = computeChecksum(file);

  console.log(`[AutonomysContent] Encrypted ${file.length} bytes → ${encrypted.ciphertext.length} bytes`);

  // 2. Upload to Autonomys
  const api = getAutoDriveApi();
  const cid = await uploadToAutonomys(api, encrypted.ciphertext, `${title}.enc`);

  console.log(`[AutonomysContent] Uploaded to Autonomys, CID: ${cid}`);

  // 3. Wrap key with master key
  const wrappedKey = wrapKeyWithMasterKey(contentKey);

  // 4. Create iQube registry entries
  const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = episodeNumber 
    ? `mk-ep${String(episodeNumber).padStart(2, '0')}-${slugBase}`
    : `mk-${slugBase}`;

  const metaQubeId = await createMetaQube({
    name: title,
    slug,
    qubeType: 'media_asset',
    series,
    episodeNumber,
    tags: ['metaknyts', assetKind, ...(rarityTier ? [rarityTier] : [])],
    description: `${assetKind.replace(/_/g, ' ')} asset${episodeNumber ? ` for Episode ${episodeNumber}` : ''}`,
    metadata: {
      ...(typeof priceAmount === 'number'
        ? {
            pricing: {
              amount: priceAmount,
              currency: 'Q¢',
              paymentType: paymentType || 'one-time',
              paymentSurface: paymentSurface || 'overlay',
            },
          }
        : {}),
    },
  });

  const blakQubeId = await createBlakQube({
    cid,
    payloadType: mimeType,
    provider: 'autonomys',
    encryptionAlg: ENCRYPTION_ALGORITHM,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    size: file.length,
    checksum,
  });

  const tokenQubeId = await createTokenQube({
    keyCiphertext: wrappedKey.keyCiphertext,
    wrappingAlg: wrappedKey.wrappingAlgorithm,
    keyType: 'AES-256',
  });

  // 5. Create codex_media_assets row
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('codex_media_assets')
    .insert({
      title,                  // Auto-Drive label (locked at upload)
      supabase_title: title,  // editable display title (defaults to upload-time title)
      episode_number: episodeNumber,
      asset_kind: assetKind,
      series,
      auto_drive_cid: cid,
      mime_type: mimeType,
      file_size: file.length,
      encryption_alg: ENCRYPTION_ALGORITHM,
      encryption_iv: encrypted.iv,
      encryption_auth_tag: encrypted.authTag,
      token_qube_id: tokenQubeId,
      meta_qube_id: metaQubeId,
      blak_qube_id: blakQubeId,
      is_shareable: isShareable,
      recommended_task: recommendedTask,
      variant_name: variantName,
      rarity_tier: rarityTier,
      edition_max: editionMax,
      edition_minted: 0,
      random_weight: randomWeight,
      display_mode: displayMode || 'pdf',
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[AutonomysContent] Failed to create codex_media_assets row:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log(`[AutonomysContent] Created media asset: ${data.id}`);

  return {
    id: data.id,
    cid,
    metaQubeId,
    blakQubeId,
    tokenQubeId,
  };
}

/**
 * Upload encrypted content to Autonomys Auto-Drive with retry logic
 * Uses chunked uploads for large files (>5MB) to avoid timeout issues
 */
async function uploadToAutonomys(
  api: ReturnType<typeof createAutoDriveApi>,
  content: Buffer,
  filename: string,
  maxRetries: number = 5
): Promise<string> {
  let lastError: Error | null = null;
  
  // Use smaller chunk size for large files to avoid timeouts
  // Reduced from 512KB to 256KB for better reliability on slow connections
  const CHUNK_SIZE = 256 * 1024; // 256KB chunks
  const isLargeFile = content.length > 5 * 1024 * 1024; // >5MB
  const isVeryLargeFile = content.length > 50 * 1024 * 1024; // >50MB
  
  if (isVeryLargeFile) {
    console.log(`[AutonomysContent] WARNING: Very large file (${(content.length / (1024 * 1024)).toFixed(2)}MB) - upload may take several minutes`);
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sizeInMB = (content.length / (1024 * 1024)).toFixed(2);
      console.log(`[AutonomysContent] Upload attempt ${attempt}/${maxRetries} for ${filename} (${sizeInMB}MB)${isLargeFile ? ' [chunked]' : ''}`);
      
      // Use the SDK's uploadFileFromBuffer method with chunked upload for large files
      const uploadOptions: { compression: boolean; uploadChunkSize?: number; onProgress?: (progress: number) => void } = {
        compression: false, // Already encrypted, no need to compress
      };
      
      if (isLargeFile) {
        uploadOptions.uploadChunkSize = CHUNK_SIZE;
        uploadOptions.onProgress = (progress: number) => {
          if (progress % 10 === 0 || progress === 100) {
            console.log(`[AutonomysContent] Upload progress: ${progress}%`);
          }
        };
      }
      
      const cid = await api.uploadFileFromBuffer(content, filename, uploadOptions);

      if (!cid) {
        throw new Error('Upload succeeded but no CID returned');
      }

      console.log(`[AutonomysContent] Upload successful on attempt ${attempt}: ${cid}`);
      return cid;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[AutonomysContent] Upload attempt ${attempt} failed:`, lastError.message);
      
      // Log more details for debugging
      if (lastError.cause) {
        console.error(`[AutonomysContent] Cause:`, lastError.cause);
      }
      if ((error as any)?.code) {
        console.error(`[AutonomysContent] Error code:`, (error as any).code);
      }
      
      // Log stack trace for fetch failures
      if (lastError.message.includes('fetch failed') || lastError.message.includes('ECONNREFUSED')) {
        console.error(`[AutonomysContent] Network error - check internet connectivity and Autonomys API status`);
        console.error(`[AutonomysContent] Stack:`, lastError.stack);
      }
      
      // Don't retry on certain errors
      if (lastError.message.includes('Invalid API key') || 
          lastError.message.includes('Unauthorized') ||
          lastError.message.includes('Invalid file') ||
          lastError.message.includes('insufficient credits')) {
        break;
      }
      
      // Wait before retrying (exponential backoff with longer delays for large files)
      if (attempt < maxRetries) {
        const baseDelay = isLargeFile ? 3000 : 1000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
        console.log(`[AutonomysContent] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Autonomys upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Get the default rarity weights for cover selection
 */
export function getRarityWeights(): Record<string, number> {
  return {
    legendary: 1,
    rare: 3,
    common: 10,
  };
}

/**
 * Validate file type for upload
 */
export function validateFileType(
  mimeType: string,
  assetKind: CodexAssetKind | MasterContentType
): boolean {
  const allowedTypes: Record<string, string[]> = {
    episode_still: ['application/pdf', 'application/x-cbz', 'application/zip'],
    episode_motion: ['video/mp4', 'video/webm', 'video/quicktime'],
    episode_print: ['application/pdf'], // Complete print edition PDFs
    character_poster: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    powers_sheet: ['application/pdf', 'image/png', 'image/jpeg'],
    background_lore_doc: ['application/pdf', 'text/plain', 'text/markdown'],
    game_concept_doc: ['application/pdf', 'text/plain', 'text/markdown'],
    game_still: ['image/png', 'image/jpeg', 'image/webp'],
    game_video: ['video/mp4', 'video/webm'],
    twenty_one_sats_concept: ['application/pdf', 'text/plain', 'text/markdown'],
    social_campaign_video: ['video/mp4', 'video/webm'],
    social_campaign_image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    cover_pdf: ['application/pdf'],
    cover_image: ['image/png', 'image/jpeg', 'image/webp'],
    cover_motion: ['video/mp4', 'video/webm', 'video/quicktime'],
    ra_badge: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  };

  const allowed = allowedTypes[assetKind];
  if (!allowed) {
    return false;
  }

  return allowed.includes(mimeType);
}
