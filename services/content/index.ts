/**
 * Smart Content Services
 * 
 * Unified exports for all smart content related services:
 * - SmartContentService: CRUD for SmartContentQubes
 * - LibraryService: User library management
 * - StorageAdapter: Media asset storage abstraction
 * - X402TemplateGenerator: Dynamic payment template generation
 * - SmartMenuIntegration: Content-driven menu configuration
 */

// Core service
export {
  SmartContentService,
  getSmartContentService,
  type SmartContentServiceConfig,
} from './smartContentService';

// Library service
export {
  LibraryService,
  getLibraryService,
  DEFAULT_SHELVES,
  type LibraryItem,
  type UserShelf,
  type LibraryStats,
  type DiscoveryResult,
} from './libraryService';

// Storage adapters
export {
  StorageAdapterFactory,
  SupabaseStorageAdapter,
  IPFSStorageAdapter,
  AutonomysStorageAdapter,
  uploadMediaAsset,
  getMediaAssetUrl,
  type IStorageAdapter,
  type StorageUploadOptions,
  type StorageUploadResult,
  type StorageDownloadResult,
} from './storageAdapter';

// x402 payment templates
export {
  X402TemplateGenerator,
  getX402TemplateGenerator,
  getCachedTemplate,
  invalidateTemplateCache,
  type X402PaymentTemplate,
  type X402PaymentInstructions,
  type X402ChainConfig,
} from './x402TemplateGenerator';

// Smart menu integration
export {
  SmartMenuIntegrationService,
  getSmartMenuIntegrationService,
  configureSmartMenuForContentAction,
  smartMenuContentActions,
  type SmartMenuManifest,
  type DrawerConfig,
  type LayoutConfig,
  type MenuAction,
} from './smartMenuIntegration';
