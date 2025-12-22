/**
 * SmartThumbnail - Reusable thumbnail component for SmartTriad content
 * Provides consistent thumbnail rendering with optional action overlay
 */

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export interface SmartThumbnailProps {
  /** Unique identifier */
  id: string;
  /** Thumbnail image URL */
  image: string;
  /** Alt text for image */
  title: string;
  /** Optional badge text */
  badge?: string;
  /** Badge color class (default: cyan) */
  badgeColor?: string;
  /** Aspect ratio class (default: aspect-video) */
  aspectRatio?: string;
  /** Whether this thumbnail is selected/active */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional actions overlay (render prop for SmartContentActions) */
  actions?: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class names */
  className?: string;
  /** Show title overlay */
  showTitle?: boolean;
}

export function SmartThumbnail({
  id,
  image,
  title,
  badge,
  badgeColor = 'bg-cyan-500/80',
  aspectRatio = 'aspect-video',
  isSelected = false,
  onClick,
  actions,
  size = 'md',
  className,
  showTitle = true,
}: SmartThumbnailProps) {
  const sizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const badgeSizeClasses = {
    sm: 'px-1.5 py-0.5 text-[8px]',
    md: 'px-2 py-0.5 text-[10px]',
    lg: 'px-2.5 py-1 text-xs',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative w-full overflow-hidden rounded-lg bg-black cursor-pointer transition-all',
        aspectRatio,
        isSelected ? 'ring-2 ring-cyan-400' : 'opacity-80 hover:opacity-100',
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Image */}
      <img
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      
      {/* Badge */}
      {badge && (
        <div className="absolute top-2 left-2 z-10">
          <span className={clsx(
            'backdrop-blur-sm text-white font-bold rounded',
            badgeColor,
            badgeSizeClasses[size]
          )}>
            {badge}
          </span>
        </div>
      )}

      {/* Actions overlay - appears on hover */}
      {actions && (
        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {actions}
        </div>
      )}

      {/* Title */}
      {showTitle && (
        <div className="absolute bottom-2 left-2 right-2 z-[5]">
          <p className={clsx(
            'text-white font-medium line-clamp-2',
            sizeClasses[size],
            actions ? 'pr-8' : '' // Leave space for actions
          )}>
            {title}
          </p>
        </div>
      )}
    </div>
  );
}
