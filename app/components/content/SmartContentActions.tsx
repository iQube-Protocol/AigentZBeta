/**
 * SmartContentActions - SmartTriad Content Actions Component
 * 
 * Ported from SmartTriad package to avoid import issues
 * Provides content interaction buttons based on available modalities.
 */

import { Play, BookOpen, Headphones, ExternalLink, Image, Maximize2, Share2, Expand } from "lucide-react";

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

export interface SmartContentItem {
  id: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  modalities?: ContentModalities | null;
  section?: string;
  // PDF support
  pdf_cid?: string;
  pdf_lite_url?: string;
}

interface Props {
  modalities: ContentModalities | null;
  onAction: (action: ActionType) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  context?: ContentContext;
  showExpand?: boolean;
  showShare?: boolean;
}

export function SmartContentActions({
  modalities,
  onAction,
  className,
  size = 'md',
  context = 'card',
  showExpand = true,
  showShare = true,
}: Props) {
  if (!modalities) return null;

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  };

  const buttonClasses = cn(
    'rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all',
    sizeClasses[size],
    className
  );

  const availableActions: { type: ActionType; icon: React.ComponentType<{ className?: string }>; label: string; available: boolean }[] = [
    { type: 'read', icon: BookOpen, label: 'Read', available: !!modalities.read?.available },
    { type: 'watch', icon: Play, label: 'Watch', available: !!modalities.watch?.available },
    { type: 'listen', icon: Headphones, label: 'Listen', available: !!modalities.listen?.audio_url },
    { type: 'link', icon: ExternalLink, label: 'Open', available: !!modalities.link?.url },
    { type: 'view', icon: Image, label: 'View', available: !!modalities.view?.image_url },
  ];

  const contextualActions: { type: ActionType; icon: React.ComponentType<{ className?: string }>; label: string; show: boolean }[] = [
    { type: 'expand', icon: Maximize2, label: 'Expand', show: showExpand },
    { type: 'share', icon: Share2, label: 'Share', show: showShare },
  ];

  return (
    <div className="flex gap-1">
      {availableActions
        .filter(action => action.available)
        .map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.type}
              className={buttonClasses}
              title={action.label}
              onClick={() => onAction(action.type)}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      
      {contextualActions
        .filter(action => action.show)
        .map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.type}
              className={buttonClasses}
              title={action.label}
              onClick={() => onAction(action.type)}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
    </div>
  );
}
