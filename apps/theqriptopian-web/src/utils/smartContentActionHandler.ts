/**
 * SmartContent Action Handler Utility
 * 
 * ARCHITECTURAL RULE: Every component using SmartContentActions MUST handle ALL actions.
 * 
 * This utility provides a standardized way to handle SmartContentActions
 * across all components. Use this to ensure consistent action handling
 * and prevent incomplete implementations.
 * 
 * REQUIRED PATTERN FOR ALL COMPONENTS:
 * 1. Import VideoModal from @agentiq/smarttriad
 * 2. Import ArticleReader, theQriptopianStyleGuide from @agentiq/article-reader
 * 3. Import ArticleQube type from @agentiq/codex
 * 4. Add state: videoModalOpen, videoModalIndex, readArticle
 * 5. Implement ALL action handlers: watch, read, listen, link, share
 * 6. Render VideoModal and ArticleReader components
 * 
 * USAGE:
 * import { createActionHandler, type ActionHandlerConfig } from '@/utils/smartContentActionHandler';
 * 
 * <SmartContentActions
 *   modalities={item.modalities}
 *   onAction={createActionHandler({
 *     item,
 *     onWatch: (item) => { setVideoModalOpen(true); },
 *     onRead: (article) => { setReadArticle(article); },
 *   })}
 * />
 * 
 * CHECKLIST FOR NEW COMPONENTS:
 * □ watch action → opens VideoModal
 * □ read action → opens ArticleReader with ArticleQube
 * □ listen action → opens audio player (TODO: implement)
 * □ link action → window.open(url, '_blank')
 * □ share action → navigator.share with clipboard fallback
 * □ expand action → selects item in carousel/viewer
 */

import type { ArticleQube } from "@agentiq/codex";

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  modalities?: {
    watch?: { video_url?: string; duration?: string };
    read?: { text?: string; duration?: string };
    listen?: { audio_url?: string; duration?: string };
    link?: { url?: string; label?: string };
    view?: { image_url?: string };
  } | null;
}

export interface ActionHandlerConfig {
  /** The content item being acted upon */
  item: ContentItem;
  /** Called when watch action is triggered - receives the item */
  onWatch?: (item: ContentItem) => void;
  /** Called when read action is triggered - receives an ArticleQube */
  onRead?: (article: ArticleQube) => void;
  /** Called when listen action is triggered - receives the item */
  onListen?: (item: ContentItem) => void;
  /** Called when link action is triggered - if not provided, opens in new tab */
  onLink?: (url: string, item: ContentItem) => void;
  /** Called when expand action is triggered - receives the item */
  onExpand?: (item: ContentItem) => void;
  /** Called when share action is triggered - if not provided, uses navigator.share */
  onShare?: (item: ContentItem) => void;
}

export type ActionType = 'watch' | 'read' | 'listen' | 'link' | 'expand' | 'share';

/**
 * Creates a standardized action handler for SmartContentActions.
 * 
 * This ensures all actions are handled consistently across the application.
 * If a handler is not provided for an action, sensible defaults are used:
 * - link: opens URL in new tab
 * - share: uses navigator.share or clipboard fallback
 * 
 * @example
 * const handleAction = createActionHandler({
 *   item: currentItem,
 *   onWatch: (item) => {
 *     setVideoModalIndex(items.findIndex(i => i.id === item.id));
 *     setVideoModalOpen(true);
 *   },
 *   onRead: (article) => setReadArticle(article),
 * });
 */
export function createActionHandler(config: ActionHandlerConfig) {
  const { item, onWatch, onRead, onListen, onLink, onExpand, onShare } = config;

  return (action: ActionType) => {
    switch (action) {
      case 'watch':
        if (item.modalities?.watch?.video_url) {
          if (onWatch) {
            onWatch(item);
          } else {
            console.warn('[SmartContentActions] watch action triggered but no onWatch handler provided');
          }
        }
        break;

      case 'read':
        if (item.modalities?.read?.text) {
          const article: ArticleQube = {
            contentId: item.id,
            title: item.title,
            excerpt: item.description || item.excerpt || '',
            body: item.modalities.read.text,
            media: item.image ? { thumbnail: item.image } : undefined,
          };
          if (onRead) {
            onRead(article);
          } else {
            console.warn('[SmartContentActions] read action triggered but no onRead handler provided');
          }
        }
        break;

      case 'listen':
        if (item.modalities?.listen?.audio_url) {
          if (onListen) {
            onListen(item);
          } else {
            // TODO: Implement default audio player
            console.warn('[SmartContentActions] listen action triggered but no onListen handler provided');
          }
        }
        break;

      case 'link':
        if (item.modalities?.link?.url) {
          if (onLink) {
            onLink(item.modalities.link.url, item);
          } else {
            // Default: open in new tab
            window.open(item.modalities.link.url, '_blank');
          }
        }
        break;

      case 'expand':
        if (onExpand) {
          onExpand(item);
        }
        break;

      case 'share':
        if (onShare) {
          onShare(item);
        } else {
          // Default: use navigator.share or clipboard fallback
          if (navigator.share) {
            navigator.share({ title: item.title, url: window.location.href });
          } else {
            navigator.clipboard.writeText(window.location.href);
          }
        }
        break;
    }
  };
}

/**
 * Helper to check if an item has any playable content (watch modality)
 */
export function hasWatchContent(item: ContentItem): boolean {
  return !!item.modalities?.watch?.video_url;
}

/**
 * Helper to check if an item has readable content
 */
export function hasReadContent(item: ContentItem): boolean {
  return !!item.modalities?.read?.text;
}

/**
 * Helper to check if an item has audio content
 */
export function hasListenContent(item: ContentItem): boolean {
  return !!item.modalities?.listen?.audio_url;
}

/**
 * Helper to check if an item has a link
 */
export function hasLinkContent(item: ContentItem): boolean {
  return !!item.modalities?.link?.url;
}
