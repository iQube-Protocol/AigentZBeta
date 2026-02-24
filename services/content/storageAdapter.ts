/**
 * Storage Adapter for Smart Content Media Assets
 * 
 * Provides a unified interface for storing and retrieving media assets
 * with support for multiple storage backends:
 * - Supabase Storage (default)
 * - IPFS (future)
 * - Autonomys (future)
 * - External CDN (future)
 * 
 * Designed for extensibility without breaking existing integrations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { StorageProvider, MediaAsset } from '@/types/smartContent';

// =============================================================================
// STORAGE ADAPTER INTERFACE
// =============================================================================

export interface StorageUploadOptions {
  /** Content type (MIME) */
  contentType: string;
  
  /** Custom metadata */
  metadata?: Record<string, string>;
  
  /** Cache control header */
  cacheControl?: string;
  
  /** Upsert if exists */
  upsert?: boolean;
}

export interface StorageUploadResult {
  /** Storage URI */
  uri: string;
  
  /** Provider used */
  provider: StorageProvider;
  
  /** Public URL (if available) */
  publicUrl?: string;
  
  /** File size in bytes */
  sizeBytes: number;
  
  /** Content hash (for verification) */
  contentHash?: string;
}

export interface StorageDownloadResult {
  /** File data */
  data: Blob | ArrayBuffer;
  
  /** Content type */
  contentType: string;
  
  /** File size */
  sizeBytes: number;
}

export interface IStorageAdapter {
  /** Provider identifier */
  provider: StorageProvider;
  
  /** Upload a file */
  upload(
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult>;
  
  /** Download a file */
  download(bucket: string, path: string): Promise<StorageDownloadResult>;
  
  /** Get public URL */
  getPublicUrl(bucket: string, path: string): string;
  
  /** Delete a file */
  delete(bucket: string, path: string): Promise<boolean>;
  
  /** Check if file exists */
  exists(bucket: string, path: string): Promise<boolean>;
  
  /** List files in a path */
  list(bucket: string, path: string): Promise<string[]>;
}

// =============================================================================
// SUPABASE STORAGE ADAPTER
// =============================================================================

export class SupabaseStorageAdapter implements IStorageAdapter {
  provider: StorageProvider = 'supabase';
  private supabase: SupabaseClient;
  
  constructor(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and key are required for SupabaseStorageAdapter');
    }
    
    this.supabase = createClient(url, key);
  }
  
  async upload(
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: options?.contentType,
        cacheControl: options?.cacheControl || '3600',
        upsert: options?.upsert || false,
      });
    
    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
    
    const publicUrl = this.getPublicUrl(bucket, path);
    const sizeBytes = file instanceof Blob ? file.size : 
                      file instanceof ArrayBuffer ? file.byteLength : 0;
    
    return {
      uri: data.path,
      provider: 'supabase',
      publicUrl,
      sizeBytes,
    };
  }
  
  async download(bucket: string, path: string): Promise<StorageDownloadResult> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(path);
    
    if (error) {
      throw new Error(`Supabase download failed: ${error.message}`);
    }
    
    return {
      data,
      contentType: data.type,
      sizeBytes: data.size,
    };
  }
  
  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }
  
  async delete(bucket: string, path: string): Promise<boolean> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([path]);
    
    return !error;
  }
  
  async exists(bucket: string, path: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/'), {
          search: path.split('/').pop(),
        });
      
      if (error) return false;
      return data.length > 0;
    } catch {
      return false;
    }
  }
  
  async list(bucket: string, path: string): Promise<string[]> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(path);
    
    if (error) {
      throw new Error(`Supabase list failed: ${error.message}`);
    }
    
    return data.map(item => `${path}/${item.name}`);
  }
}

// =============================================================================
// IPFS STORAGE ADAPTER (Stub for future implementation)
// =============================================================================

export class IPFSStorageAdapter implements IStorageAdapter {
  provider: StorageProvider = 'ipfs';
  private gateway: string;
  private apiEndpoint: string;
  
  constructor(gateway?: string, apiEndpoint?: string) {
    this.gateway = gateway || process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs';
    this.apiEndpoint = apiEndpoint || process.env.IPFS_API_ENDPOINT || '';
  }
  
  async upload(
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    // TODO: Implement IPFS upload via Pinata, Infura, or local node
    // For now, throw not implemented
    throw new Error('IPFS storage adapter not yet implemented. Use Supabase for now.');
    
    // Future implementation:
    // 1. Upload to IPFS node/service
    // 2. Get CID
    // 3. Return CID as URI
  }
  
  async download(bucket: string, path: string): Promise<StorageDownloadResult> {
    // path is expected to be an IPFS CID
    const response = await fetch(`${this.gateway}/${path}`);
    
    if (!response.ok) {
      throw new Error(`IPFS download failed: ${response.statusText}`);
    }
    
    const data = await response.blob();
    
    return {
      data,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      sizeBytes: data.size,
    };
  }
  
  getPublicUrl(bucket: string, path: string): string {
    return `${this.gateway}/${path}`;
  }
  
  async delete(bucket: string, path: string): Promise<boolean> {
    // IPFS content is immutable - can only unpin
    // TODO: Implement unpinning via Pinata/Infura API
    console.warn('IPFS content cannot be deleted, only unpinned');
    return false;
  }
  
  async exists(bucket: string, path: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.gateway}/${path}`, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async list(bucket: string, path: string): Promise<string[]> {
    // IPFS doesn't have traditional directory listing
    // Would need to use IPNS or maintain an index
    throw new Error('IPFS list not supported');
  }
}

// =============================================================================
// AUTONOMYS STORAGE ADAPTER (Stub for future implementation)
// =============================================================================

export class AutonomysStorageAdapter implements IStorageAdapter {
  provider: StorageProvider = 'autonomys';
  
  constructor() {
    // TODO: Initialize Autonomys client
  }
  
  async upload(
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    throw new Error('Autonomys storage adapter not yet implemented. Use Supabase for now.');
  }
  
  async download(bucket: string, path: string): Promise<StorageDownloadResult> {
    throw new Error('Autonomys storage adapter not yet implemented');
  }
  
  getPublicUrl(bucket: string, path: string): string {
    throw new Error('Autonomys storage adapter not yet implemented');
  }
  
  async delete(bucket: string, path: string): Promise<boolean> {
    throw new Error('Autonomys storage adapter not yet implemented');
  }
  
  async exists(bucket: string, path: string): Promise<boolean> {
    throw new Error('Autonomys storage adapter not yet implemented');
  }
  
  async list(bucket: string, path: string): Promise<string[]> {
    throw new Error('Autonomys storage adapter not yet implemented');
  }
}

// =============================================================================
// STORAGE ADAPTER FACTORY
// =============================================================================

export class StorageAdapterFactory {
  private static adapters: Map<StorageProvider, IStorageAdapter> = new Map();
  
  /**
   * Get or create a storage adapter for the specified provider
   */
  static getAdapter(provider: StorageProvider = 'supabase'): IStorageAdapter {
    if (this.adapters.has(provider)) {
      return this.adapters.get(provider)!;
    }
    
    let adapter: IStorageAdapter;
    
    switch (provider) {
      case 'supabase':
        adapter = new SupabaseStorageAdapter();
        break;
      case 'ipfs':
        adapter = new IPFSStorageAdapter();
        break;
      case 'autonomys':
        adapter = new AutonomysStorageAdapter();
        break;
      default:
        // Default to Supabase
        adapter = new SupabaseStorageAdapter();
    }
    
    this.adapters.set(provider, adapter);
    return adapter;
  }
  
  /**
   * Register a custom adapter
   */
  static registerAdapter(provider: StorageProvider, adapter: IStorageAdapter): void {
    this.adapters.set(provider, adapter);
  }
}

// =============================================================================
// MEDIA ASSET HELPER FUNCTIONS
// =============================================================================

/**
 * Upload a media asset and create the MediaAsset record
 */
export async function uploadMediaAsset(
  file: File,
  options: {
    tenantId: string;
    creatorRootDid?: string;
    provider?: StorageProvider;
    bucket?: string;
    altText?: string;
  }
): Promise<Partial<MediaAsset>> {
  const provider = options.provider || 'supabase';
  const bucket = options.bucket || 'content-assets';
  const adapter = StorageAdapterFactory.getAdapter(provider);
  
  // Generate unique path
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${options.tenantId}/${timestamp}_${safeName}`;
  
  // Upload file
  const result = await adapter.upload(bucket, path, file, {
    contentType: file.type,
    upsert: false,
  });
  
  // Determine asset type from MIME
  const assetType = getAssetTypeFromMime(file.type);
  
  // Build MediaAsset record
  const mediaAsset: Partial<MediaAsset> = {
    type: assetType,
    mimeType: file.type,
    storageProvider: provider,
    storageUri: result.uri,
    sizeBytes: result.sizeBytes,
    altText: options.altText,
  };
  
  // Add dimensions for images/video (would need actual processing)
  // TODO: Extract dimensions using sharp or similar
  
  return mediaAsset;
}

/**
 * Get asset type from MIME type
 */
function getAssetTypeFromMime(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('markdown')) return 'markdown';
  return 'other';
}

/**
 * Get public URL for a media asset
 */
export function getMediaAssetUrl(asset: MediaAsset, bucket: string = 'content-assets'): string {
  const adapter = StorageAdapterFactory.getAdapter(asset.storageProvider);
  return adapter.getPublicUrl(bucket, asset.storageUri);
}
