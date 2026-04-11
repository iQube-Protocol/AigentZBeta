/**
 * SmartContentActions - SmartTriad Content Actions Component
 * 
 * PORTED FROM NETLIFY DEPLOYMENT with agentiQ adaptations
 * Provides content interaction buttons based on available modalities.
 * 
 * ENHANCED FEATURES:
 * - Context-aware action filtering
 * - Helper functions for content checking
 * - Advanced action availability logic
 */

import { Play, BookOpen, Headphones, ExternalLink, Image, Maximize2, Share2, ShoppingCart } from "lucide-react";
import type { ContentModalities, ActionType, ContentContext, SmartContentItem } from "@/packages/smarttriad/src/types";
export type { ContentModalities, ActionType, ContentContext, SmartContentItem } from "@/packages/smarttriad/src/types";

/**
 * Utility function for className merging
 */
function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

/**
 * ContentModalities - Defines available content consumption modes
 * Each modality should only be present if the content actually supports it
 */
export interface ContentModalitiesExtended extends ContentModalities {
  read?: { text?: string; available?: boolean; cid?: string; duration?: string; html?: string };
  watch?: { video_url?: string; available?: boolean; cid?: string; duration?: string; thumbnail?: string; type?: string };
  listen?: { audio_url: string; duration?: string; cover_image?: string };
  link?: { url: string; allow_embed?: boolean };
  view?: { image_url?: string };
}

const ICONS: Record<ActionType, typeof Play> = {
  watch: Play, 
  read: BookOpen, 
  listen: Headphones,
  link: ExternalLink, 
  view: Image, 
  expand: Maximize2, 
  share: Share2,
  buy: ShoppingCart,
};

const ACTION_LABELS: Record<ActionType, string> = {
  watch: 'Watch video',
  read: 'Read article',
  listen: 'Listen to audio',
  link: 'Open link',
  view: 'View image',
  expand: 'Expand',
  share: 'Share',
  buy: 'Buy for Q¢',
};

interface Props {
  modalities: ContentModalities | null;
  onAction: (action: ActionType) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  context?: ContentContext;
  showExpand?: boolean;
  showShare?: boolean;
  item?: SmartContentItem; // Add item for price detection
}

/**
 * Determines which actions should be available based on modalities, context, and pricing
 * PORTED FROM NETLIFY - Enhanced logic for intelligent action filtering with payment support
 */
function getAvailableActions(
  modalities: ContentModalities | null, 
  context: ContentContext,
  showExpand: boolean,
  showShare: boolean,
  item?: SmartContentItem
): ActionType[] {
  const actions: ActionType[] = [];
  
  // Only add modality actions if they have actual content
  if (modalities?.watch?.video_url || modalities?.watch?.available) actions.push('watch');
  if (modalities?.read?.text || modalities?.read?.available) actions.push('read');
  if (modalities?.listen?.audio_url) actions.push('listen');
  if (modalities?.link?.url) actions.push('link');
  
  // Disabled: view and expand actions are redundant and not working
  // if (modalities?.view?.image_url) actions.push('view');
  // if (showExpand && context === 'thumbnail') actions.push('expand');
  
  // Share is always available — SmartTriad renders the modal at root level.
  actions.push('share');

  // Add buy action if item has a price
  if (item?.price?.amount && item.price.amount > 0) {
    actions.push('buy');
  }
  
  return actions;
}

export function SmartContentActions({ 
  modalities, 
  onAction, 
  className, 
  size = 'md',
  context = 'card',
  showExpand = true,
  showShare = true,
  item
}: Props) {
  const actions = getAvailableActions(modalities, context, showExpand, showShare, item);
  
  // Don't render if no actions available
  if (actions.length === 0) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'p-1' : size === 'lg' ? 'p-2.5' : 'p-1.5';

  return (
    <div className={cn("flex gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1", className)}>
      {actions.map((action) => {
        const Icon = ICONS[action];
        const isBuyAction = action === 'buy' && item?.price;
        
        return (
          <div key={action} className="flex items-center gap-1">
            {isBuyAction && (
              <span className="text-xs font-bold text-amber-400 whitespace-nowrap">
                {formatPrice(item.price!.amount)} Q¢
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAction(action); }}
              className={cn(
                buttonSize,
                isBuyAction 
                  ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors"
                  : "text-cyan-400 hover:text-cyan-300 hover:bg-white/10 rounded transition-colors"
              )}
              aria-label={ACTION_LABELS[action]}
              title={isBuyAction 
                ? `Buy for ${formatPrice(item.price!.amount)} Q¢`
                : ACTION_LABELS[action]
              }
            >
              <Icon className={iconSize} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Helper to check if a content item has any playable modality
 */
export function hasPlayableContent(modalities: ContentModalities | null): boolean {
  return !!(modalities?.watch?.video_url || modalities?.listen?.audio_url);
}

/**
 * Helper to check if a content item has readable content
 */
export function hasReadableContent(modalities: ContentModalities | null): boolean {
  return !!(modalities?.read?.text || modalities?.read?.available);
}

/**
 * Helper to check if a content item has a price
 */
export function hasPrice(item?: SmartContentItem): boolean {
  return !!(item?.price?.amount && item.price.amount > 0);
}

/**
 * Helper to get the primary action for a content item
 */
export function getPrimaryAction(modalities: ContentModalities | null, item?: SmartContentItem): ActionType | null {
  // Buy action takes priority if item has a price
  if (hasPrice(item)) return 'buy';
  
  if (modalities?.watch?.video_url) return 'watch';
  if (modalities?.read?.text) return 'read';
  if (modalities?.listen?.audio_url) return 'listen';
  if (modalities?.link?.url) return 'link';
  return null;
}

/**
 * Helper to format price for display
 */
export function formatPrice(amount: number): string {
  if (amount >= 100) {
    return `${(amount / 100).toFixed(2)}`;
  }
  return `${amount}`;
}
