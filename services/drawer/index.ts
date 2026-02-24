/**
 * Smart Drawer Services - Barrel Export
 * 
 * Exports all drawer-related services for the Smart Triad Framework.
 */

// =============================================================================
// DRAWER SERVICE
// =============================================================================

export {
  drawerService,
  getDrawerSet,
  getDrawerSetById,
  upsertDrawerSet,
  validateDrawerSet,
  type DrawerSetQuery,
  type DrawerValidationResult,
  type ApplySessionResult,
} from './drawerService';

// =============================================================================
// CARD VARIANT REGISTRY
// =============================================================================

export {
  cardVariantRegistry,
  getVariantById,
  findBestVariant,
  findClosestBase,
  listVariants,
  BUILTIN_CARD_VARIANTS,
} from './cardVariantRegistry';

// =============================================================================
// SLOT DATA RESOLVER
// =============================================================================

export {
  slotDataResolver,
  resolveSlot,
  resolveSlots,
  type ResolvedSlotData,
  type ResolvedItem,
  type ResolutionContext,
} from './slotDataResolver';

// =============================================================================
// VISIBILITY EVALUATOR
// =============================================================================

export {
  visibilityEvaluator,
  filterDrawerSet,
  getVisibleDrawers,
  getVisibleTabs,
  getVisibleSlots,
  isDrawerVisible,
  isTabVisible,
  type VisibilityContext,
  type FilteredDrawerSet,
  type FilteredDrawer,
  type FilteredTab,
} from './visibilityEvaluator';

// =============================================================================
// MODAL SELECTION SERVICE
// =============================================================================

export {
  modalSelectionService,
  selectModal,
  selectModalsBatch,
  inferUseCase,
  getRecommendedVariants,
  type ModalSelectionResult,
  type BatchSelectionRequest,
  type BatchSelectionResult,
} from './modalSelectionService';

// =============================================================================
// FIXTURES
// =============================================================================

export { drawerSetFixtures } from './fixtures/drawerSetFixtures';
export { aigentQubeFixtures, SEED_AGENTS, SEED_METAVATARS } from './fixtures/aigentQubeFixtures';
