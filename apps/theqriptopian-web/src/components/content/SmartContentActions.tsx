import { Play, BookOpen, Headphones, ExternalLink, Image, Maximize2, Share2, Expand } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ContentModalities - Defines available content consumption modes
 * Each modality should only be present if the content actually supports it
 */
export interface ContentModalities {
  read?: { text?: string; available?: boolean; cid?: string; duration?: string };
  watch?: { video_url?: string; available?: boolean; cid?: string; duration?: string; thumbnail?: string; type?: string };
  listen?: { audio_url: string; duration?: string; cover_image?: string };
  link?: { url: string; allow_embed?: boolean };
  view?: { image_url?: string };
}

export type ActionType = 'read' | 'watch' | 'listen' | 'link' | 'view' | 'expand' | 'share';

/**
 * ContentContext - Determines which actions are contextually appropriate
 */
export type ContentContext = 'thumbnail' | 'hero' | 'card' | 'fullscreen' | 'drawer';

interface Props {
  modalities: ContentModalities | null;
  onAction: (action: ActionType) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  context?: ContentContext;
  showExpand?: boolean;
  showShare?: boolean;
}

const ICONS: Record<ActionType, typeof Play> = {
  watch: Play, 
  read: BookOpen, 
  listen: Headphones,
  link: ExternalLink, 
  view: Image, 
  expand: Maximize2, 
  share: Share2,
};

const ACTION_LABELS: Record<ActionType, string> = {
  watch: 'Watch video',
  read: 'Read article',
  listen: 'Listen to audio',
  link: 'Open link',
  view: 'View image',
  expand: 'Expand',
  share: 'Share',
};

/**
 * Determines which actions should be available based on modalities and context
 */
function getAvailableActions(
  modalities: ContentModalities | null, 
  context: ContentContext,
  showExpand: boolean,
  showShare: boolean
): ActionType[] {
  const actions: ActionType[] = [];
  
  // Only add modality actions if they have actual content
  if (modalities?.watch?.video_url || modalities?.watch?.available) actions.push('watch');
  if (modalities?.read?.text || modalities?.read?.available) actions.push('read');
  if (modalities?.listen?.audio_url) actions.push('listen');
  if (modalities?.link?.url) actions.push('link');
  if (modalities?.view?.image_url) actions.push('view');
  
  // Context-dependent actions
  if (showExpand && context === 'thumbnail') actions.push('expand');
  if (showShare) actions.push('share');
  
  return actions;
}

export function SmartContentActions({ 
  modalities, 
  onAction, 
  className, 
  size = 'md',
  context = 'card',
  showExpand = true,
  showShare = true
}: Props) {
  const actions = getAvailableActions(modalities, context, showExpand, showShare);
  
  // Don't render if no actions available
  if (actions.length === 0) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'p-1' : size === 'lg' ? 'p-2.5' : 'p-1.5';

  return (
    <div className={cn("flex gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1", className)}>
      {actions.map((action) => {
        const Icon = ICONS[action];
        return (
          <button
            key={action}
            onClick={(e) => { e.stopPropagation(); onAction(action); }}
            className={cn(
              buttonSize,
              "text-cyan-400 hover:text-cyan-300 hover:bg-white/10 rounded transition-colors"
            )}
            aria-label={ACTION_LABELS[action]}
            title={ACTION_LABELS[action]}
          >
            <Icon className={iconSize} />
          </button>
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
 * Helper to get the primary action for a content item
 */
export function getPrimaryAction(modalities: ContentModalities | null): ActionType | null {
  if (modalities?.watch?.video_url) return 'watch';
  if (modalities?.read?.text) return 'read';
  if (modalities?.listen?.audio_url) return 'listen';
  if (modalities?.link?.url) return 'link';
  return null;
}
