/**
 * @agentiq/smarttriad
 * Smart menu, drawers, and layout system for AgentiQ franchises
 * Domain-driven navigation primitives
 */

export { IconBar } from './IconBar';
export type { IconBarProps } from './IconBar';

export { DrawerLayer } from './DrawerLayer';
export type { DrawerLayerProps } from './DrawerLayer';

export { VideoModal } from './VideoModal';
export type { VideoModalProps, VideoItem } from './VideoModal';

export { SmartThumbnail } from './SmartThumbnail';
export type { SmartThumbnailProps } from './SmartThumbnail';

export { SmartContentActions, shareArticle, getCurrentPersonaId } from './SmartContentActions';
export type { 
  ContentModalities, 
  ActionType, 
  ContentContext, 
  SmartContentItem 
} from './SmartContentActions';

export type {
  Domain,
  DrawerTab,
  DrawerColumns,
  IconBarConfig,
  DrawerLayerConfig,
} from './types';
