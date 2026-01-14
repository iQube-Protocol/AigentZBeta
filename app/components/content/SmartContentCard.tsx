"use client";

import React from "react";
import { BookOpen, Play, Headphones, MessageSquare } from "lucide-react";
import type { SmartContentQube, ContentModality } from "@/types/smartContent";
import { ContentActionIcons } from "./ContentActionIcons";
import type { IconStyle } from "./ContentActionIcons";

const MODALITY_ICONS: Record<ContentModality, { icon: React.ReactNode; label: string }> = {
  read: { icon: <BookOpen className="w-4 h-4" />, label: "Read" },
  watch: { icon: <Play className="w-4 h-4" />, label: "Watch" },
  listen: { icon: <Headphones className="w-4 h-4" />, label: "Listen" },
  interact: { icon: <MessageSquare className="w-4 h-4" />, label: "Interact" },
};

type CardVariant = 
  | "compact"       // List row - library style
  | "standard"      // Grid card - 3-4 per row
  | "featured"      // Large card with details
  | "hero"          // Full-width splash (66vh or 100vh)
  | "carousel4"     // 4 per row - narrow thumbnails (SS1 bottom)
  | "carousel3"     // 3.25 per row - with description (SS2)
  | "thumbnail6"    // 6+ per row - small squares, icons only (SS3 bottom)
  | "thumbnailRect" // 6+ per row - short rectangles (2/3 height)
  | "poster2"       // 2 per row - large posters with overlay (SS3 top)
  | "poster3"       // 3 per row - tall portrait, full-bleed (SS5)
  | "compound"      // Multi-section with links (SS4) - full width
  | "compound2"     // Compound 2-column width
  | "compound1"     // Compound 1-column width
  | "iframe"        // Iframe embed for D-id avatars etc
  | "contentWide"   // 2-column width content container (cinematic comics etc)
  // Mobile variants
  | "mobileHero"    // Mobile hero - full width portrait with overlay (SS2)
  | "mobileFeatured" // Mobile featured - title overlay on tall image
  | "mobileSplit"   // Mobile split - iframe top + article card below
  | "mobileCard"    // Mobile card - large thumb + modality icons + description (SS5)
  | "mobileThumb";  // Mobile thumbnail - 2.25 visible carousel thumbs (SS6)

interface CompoundLink {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: string;
}

type IframeWidth = "full" | "col2" | "col1";
type IframeHeight = "short" | "full"; // short = 66vh, full = 100%

interface SmartContentCardProps {
  content: SmartContentQube;
  variant?: CardVariant;
  /** Hero height: 'short' = 66vh, 'full' = 100vh (only applies to hero variant) */
  heroHeight?: "short" | "full";
  /** Iframe dimensions (for iframe variant) */
  iframeWidth?: IframeWidth;
  iframeHeight?: IframeHeight;
  /** Iframe source URL (for iframe variant) */
  iframeSrc?: string;
  /** Show limited/exclusive badge */
  isLimited?: boolean;
  /** Compound card links (for compound variant) */
  compoundLinks?: CompoundLink[];
  /** Code snippet to display (for compound variant) */
  codeSnippet?: string;
  showProgress?: boolean;
  progressPercentage?: number;
  onSelect?: (content: SmartContentQube) => void;
  onPurchase?: (content: SmartContentQube) => void;
  onAddToLibrary?: (content: SmartContentQube) => void;
  isOwned?: boolean;
  isInLibrary?: boolean;
  /** Icon style for modality icons - defaults to "lucide" */
  iconStyle?: IconStyle;
}

const MODALITY_EMOJI: Record<ContentModality, string> = {
  read: "📖", watch: "🎬", listen: "🎧", interact: "💬",
};

const MODALITY_LABELS: Record<ContentModality, string> = {
  read: "Read", watch: "Watch", listen: "Listen", interact: "Interact",
};

const LUCIDE_ICONS: Record<ContentModality, React.FC<{ className?: string }>> = {
  read: BookOpen, watch: Play, listen: Headphones, interact: MessageSquare,
};

const APP_COLORS: Record<string, string> = {
  metaKnyts: "from-purple-500/20 to-fuchsia-500/20 ring-purple-500/30",
  Qriptopian: "from-cyan-500/20 to-blue-500/20 ring-cyan-500/30",
  AgentiQ: "from-emerald-500/20 to-teal-500/20 ring-emerald-500/30",
};

export default function SmartContentCard({
  content,
  variant = "standard",
  heroHeight = "short",
  iframeWidth = "full",
  iframeHeight = "short",
  iframeSrc,
  isLimited = false,
  compoundLinks = [],
  codeSnippet,
  showProgress = false,
  progressPercentage = 0,
  onSelect,
  onPurchase,
  onAddToLibrary,
  isOwned = false,
  isInLibrary = false,
  iconStyle = "lucide",
}: SmartContentCardProps) {
  // Helper to render modality icon based on iconStyle
  const renderModalityIcon = (mod: ContentModality, className: string = "text-base") => {
    if (iconStyle === "emoji") {
      return <span className={className}>{MODALITY_EMOJI[mod]}</span>;
    }
    const Icon = LUCIDE_ICONS[mod];
    return <Icon className={className.includes("w-") ? className : "w-4 h-4 text-white"} />;
  };
  // Get active modalities (handle empty/undefined modalities)
  const activeModalities = content.modalities 
    ? Object.entries(content.modalities)
        .filter(([_, mod]) => mod?.enabled)
        .map(([key]) => key as ContentModality)
    : [];
  const modalityState = {
    read: Boolean(content.modalities?.read?.enabled),
    watch: Boolean(content.modalities?.watch?.enabled),
    listen: Boolean(content.modalities?.listen?.enabled),
    interact: Boolean(content.modalities?.interact?.enabled),
  };

  // Get primary pricing tier (handle missing pricingModel)
  const primaryTier = content.pricingModel?.tiers?.[0];
  const isFree = primaryTier?.kind === "free" || !primaryTier;

  // Get structure info
  const structureLabel = content.structure?.kind
    ? `${content.structure.kind.charAt(0).toUpperCase()}${content.structure.kind.slice(1)}`
    : null;

  const appColor = APP_COLORS[content.app] || APP_COLORS.AgentiQ;

  // Hero variant - full width, 66vh or 100vh height
  if (variant === "hero") {
    const heightClass = heroHeight === "full" ? "h-screen" : "h-[66vh]";
    
    return (
      <div
        className={`relative w-full ${heightClass} bg-gradient-to-br ${appColor} ring-1 ring-white/10 overflow-hidden`}
      >
        {/* Background Image */}
        {content.coverImageUri && (
          <div className="absolute inset-0">
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
          </div>
        )}

        {/* Content Overlay */}
        <div className="relative h-full flex flex-col justify-end p-6 md:p-10 lg:p-16">
          {/* Top badges */}
          <div className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/90 ring-1 ring-white/20">
              {content.app}
            </span>
            {structureLabel && (
              <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/90 ring-1 ring-white/20">
                {structureLabel}
              </span>
            )}
            {isOwned && (
              <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/80 text-white">
                Owned
              </span>
            )}
          </div>

          {/* Main content area */}
          <div className="max-w-3xl space-y-4 md:space-y-6">
            {/* Title */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              {content.title}
            </h1>

            {/* Description */}
            <p className="text-base md:text-lg text-slate-200 line-clamp-3 max-w-2xl">
              {content.description}
            </p>

            {/* Modalities */}
            <div className="flex items-center gap-3 flex-wrap">
              {activeModalities.map((mod) => (
                <span
                  key={mod}
                  className="text-sm px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 text-white flex items-center gap-2"
                >
                  <span className="text-base">{MODALITY_ICONS[mod].icon}</span>
                  {MODALITY_ICONS[mod].label}
                </span>
              ))}
            </div>

            {/* Progress bar (if applicable) */}
            {showProgress && progressPercentage > 0 && (
              <div className="max-w-md">
                <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                  <span>Progress</span>
                  <span>{progressPercentage}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 pt-2">
              {isOwned ? (
                <button
                  onClick={() => onSelect?.(content)}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-lg font-semibold hover:from-fuchsia-400 hover:to-purple-400 transition-colors shadow-lg shadow-fuchsia-500/25"
                >
                  Continue Reading
                </button>
              ) : (
                <button
                  onClick={() => (isFree ? onSelect?.(content) : onPurchase?.(content))}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-lg font-semibold hover:from-fuchsia-400 hover:to-purple-400 transition-colors shadow-lg shadow-fuchsia-500/25"
                >
                  {isFree ? "Start Reading" : `Purchase for ${primaryTier?.amount} ${primaryTier?.currency}`}
                </button>
              )}

              {!isInLibrary && (
                <button
                  onClick={() => onAddToLibrary?.(content)}
                  className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 text-white text-lg font-medium hover:bg-white/20 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Add to Library
                  </span>
                </button>
              )}

              {isInLibrary && (
                <span className="px-4 py-2 text-sm text-emerald-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  In Library
                </span>
              )}
            </div>

            {/* Pricing info */}
            {!isOwned && !isFree && primaryTier && (
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span>Starting at</span>
                <span className="text-white font-semibold">
                  {primaryTier.amount} {primaryTier.currency}
                </span>
                {content.pricingModel.tiers.length > 1 && (
                  <span className="text-slate-500">
                    · {content.pricingModel.tiers.length} pricing options
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className={`w-full text-left rounded-xl bg-gradient-to-br ${appColor} ring-1 ring-white/10 p-3 hover:ring-white/20 transition-all group`}
      >
        <div className="flex items-start gap-3">
          {content.coverImageUri && (
            <div className="w-12 h-12 rounded-lg bg-black/30 overflow-hidden flex-shrink-0">
              <img
                src={content.coverImageUri}
                alt={content.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-slate-100 truncate group-hover:text-white">
              {content.title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              {activeModalities.slice(0, 2).map((mod) => (
                <span key={mod} className="text-xs">
                  {MODALITY_ICONS[mod].icon}
                </span>
              ))}
              {!isFree && primaryTier && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300">
                  {primaryTier.amount} {primaryTier.currency}
                </span>
              )}
              {isFree && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Free
                </span>
              )}
            </div>
          </div>
        </div>
        {showProgress && progressPercentage > 0 && (
          <div className="mt-2 h-1 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </button>
    );
  }

  // Carousel4 - 4 per row, narrow thumbnails with title below (SS1 bottom)
  if (variant === "carousel4") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        <div className="aspect-[16/10] rounded-lg bg-black/30 overflow-hidden ring-1 ring-white/10 group-hover:ring-cyan-500/50 transition-all">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>
        <div className="mt-2">
          <h4 className="text-sm font-medium text-slate-100 truncate group-hover:text-white">
            {content.title}
          </h4>
          {content.description && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{content.description}</p>
          )}
        </div>
      </button>
    );
  }

  // Carousel3 - 3.25 per row, with modality icons and description (SS2)
  if (variant === "carousel3") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        <div className="aspect-square rounded-lg bg-black/30 overflow-hidden ring-2 ring-cyan-500/30 group-hover:ring-cyan-500/60 transition-all relative">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          )}
          {/* Top-left app badge */}
          <div className="absolute top-2 left-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-cyan-300 ring-1 ring-cyan-500/30">
              {content.app}
            </span>
          </div>
          {/* Top-right modality icons */}
          <div className="absolute top-2 right-2 flex gap-1">
            {activeModalities.slice(0, 2).map((mod) => (
              <span
                key={mod}
                className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-xs ring-1 ring-white/20"
              >
                {MODALITY_ICONS[mod].icon}
              </span>
            ))}
          </div>
        </div>
        {/* Modality icons row below image */}
        <div className="mt-3 flex items-center gap-2">
          {activeModalities.map((mod) => (
            <span
              key={mod}
              className="w-7 h-7 rounded-full bg-cyan-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center text-sm"
            >
              {MODALITY_ICONS[mod].icon}
            </span>
          ))}
        </div>
        <h4 className="mt-2 text-sm font-semibold text-white line-clamp-1">{content.title}</h4>
        <p className="mt-1 text-xs text-slate-400 line-clamp-2">{content.description}</p>
      </button>
    );
  }

  // Thumbnail6 - 6+ per row, small squares with icons overlay only (SS3 bottom)
  if (variant === "thumbnail6") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group aspect-square rounded-md bg-black/30 overflow-hidden ring-2 ring-cyan-500/40 hover:ring-cyan-400 transition-all relative"
      >
        {content.coverImageUri && (
          <img
            src={content.coverImageUri}
            alt={content.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        )}
        {/* Modality icons overlay */}
        <div className="absolute bottom-1 left-1 flex gap-0.5">
          {activeModalities.slice(0, 2).map((mod) => (
            <span
              key={mod}
              className="w-5 h-5 rounded bg-black/70 backdrop-blur-sm flex items-center justify-center text-[10px]"
            >
              {MODALITY_ICONS[mod].icon}
            </span>
          ))}
        </div>
      </button>
    );
  }

  // ThumbnailRect - 6+ per row, short rectangles (2/3 height of thumbnail6)
  if (variant === "thumbnailRect") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group aspect-[3/2] rounded-md bg-black/30 overflow-hidden ring-2 ring-cyan-500/40 hover:ring-cyan-400 transition-all relative"
      >
        {content.coverImageUri && (
          <img
            src={content.coverImageUri}
            alt={content.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        )}
        {/* Modality icons overlay */}
        <div className="absolute bottom-1 left-1 flex gap-0.5">
          {activeModalities.slice(0, 2).map((mod) => (
            <span
              key={mod}
              className="w-4 h-4 rounded bg-black/70 backdrop-blur-sm flex items-center justify-center text-[9px]"
            >
              {MODALITY_ICONS[mod].icon}
            </span>
          ))}
        </div>
      </button>
    );
  }

  // Poster2 - 2 per row, large posters with overlay icons (SS3 top)
  // Updated to 2:3 aspect ratio for taller cards that show full content
  if (variant === "poster2") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        <div className="aspect-[2/3] rounded-xl bg-black/30 overflow-hidden ring-1 ring-white/10 group-hover:ring-cyan-500/50 transition-all relative flex items-center justify-center">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {/* Top-right modality icons */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            {activeModalities.map((mod) => (
              <span
                key={mod}
                className="w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-base ring-1 ring-white/20"
              >
                {MODALITY_ICONS[mod].icon}
              </span>
            ))}
          </div>
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
        </div>
        <h4 className="mt-3 text-base font-semibold text-cyan-300 group-hover:text-cyan-200">
          {content.title}
        </h4>
      </button>
    );
  }

  // Poster3 - 3 per row, tall portrait cards with full-bleed image (SS5)
  if (variant === "poster3") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        <div className="aspect-[3/4] rounded-xl bg-black/30 overflow-hidden ring-1 ring-white/10 group-hover:ring-fuchsia-500/50 transition-all relative">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          )}
          {/* Limited badge */}
          {isLimited && (
            <div className="absolute top-3 left-3">
              <span className="text-xs px-2 py-1 rounded-full bg-fuchsia-500/80 text-white flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Limited
              </span>
            </div>
          )}
          {/* Play button overlay for video content */}
          {activeModalities.includes("watch") && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-cyan-500/80 flex items-center justify-center group-hover:bg-cyan-400 transition-colors">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          )}
          {/* Bottom gradient with title */}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
            <h4 className="text-base font-semibold text-white">{content.title}</h4>
            <p className="text-xs text-slate-400 mt-1">{structureLabel || content.app}</p>
            {/* Progress bar */}
            {showProgress && progressPercentage > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </span>
              </div>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Compound card content renderer (shared by compound, compound1, compound2)
  const renderCompoundContent = (cols: 1 | 2) => (
    <div className="rounded-xl bg-slate-900/80 ring-1 ring-white/10 overflow-hidden">
      {/* Top section with image and code */}
      <div className={`grid ${cols === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} gap-0`}>
        {/* Left: Image */}
        <button
          onClick={() => onSelect?.(content)}
          className="aspect-video relative group"
        >
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h4 className="text-lg font-semibold text-cyan-300">{content.title}</h4>
          </div>
        </button>

        {/* Right: Code snippet or content list */}
        <div className="p-4 bg-black/40 flex flex-col">
          {codeSnippet ? (
            <pre className="text-xs text-slate-300 font-mono overflow-x-auto flex-1">
              <code>{codeSnippet}</code>
            </pre>
          ) : (
            <div className="space-y-2 flex-1">
              <h5 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <span className="text-cyan-400">{"</>"}</span> Core Concepts
              </h5>
              <ul className="space-y-1 text-sm text-slate-300">
                {content.libraryMetadata?.tags?.slice(0, 4).map((tag, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-cyan-400">›</span>
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Links section */}
      {compoundLinks.length > 0 && (
        <div className={`grid ${cols === 2 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"} gap-px bg-white/5`}>
          {compoundLinks.map((link, i) => (
            <button
              key={i}
              onClick={link.onClick}
              className="p-3 bg-slate-900/80 hover:bg-slate-800/80 transition-colors text-left"
            >
              <div className="text-sm font-medium text-white">{link.label}</div>
              {link.icon && <div className="text-xs text-slate-400 mt-0.5">{link.icon}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Compound - multi-section card with links and optional code (SS4) - full width
  if (variant === "compound") {
    return renderCompoundContent(2);
  }

  // Compound2 - 2-column width version
  if (variant === "compound2") {
    return renderCompoundContent(2);
  }

  // Compound1 - 1-column width version (stacked layout)
  if (variant === "compound1") {
    return renderCompoundContent(1);
  }

  // Iframe - embed for D-id avatars, videos, etc.
  if (variant === "iframe") {
    const widthClass = {
      full: "w-full",
      col2: "w-full max-w-2xl",
      col1: "w-full max-w-md",
    }[iframeWidth];
    
    const heightClass = iframeHeight === "full" ? "h-full min-h-[400px]" : "h-[66vh]";
    
    return (
      <div className={`${widthClass} ${heightClass} rounded-xl bg-slate-900/80 ring-1 ring-white/10 overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-black/40 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h4 className="text-sm font-medium text-white truncate">{content.title}</h4>
          </div>
          <div className="flex items-center gap-1">
            {activeModalities.map((mod) => (
              <span
                key={mod}
                className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs"
                title={MODALITY_ICONS[mod].label}
              >
                {MODALITY_ICONS[mod].icon}
              </span>
            ))}
          </div>
        </div>
        
        {/* Iframe container */}
        <div className="flex-1 relative bg-black">
          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              className="absolute inset-0 w-full h-full border-0"
              allow="camera; microphone; autoplay"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {content.coverImageUri ? (
                <img
                  src={content.coverImageUri}
                  alt={content.title}
                  className="w-full h-full object-cover opacity-50"
                />
              ) : null}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <div className="w-20 h-20 rounded-full bg-cyan-500/20 ring-2 ring-cyan-500/40 flex items-center justify-center mb-4">
                  <span className="text-4xl">🤖</span>
                </div>
                <p className="text-sm text-slate-400">Aigent avatar will appear here</p>
                <button
                  onClick={() => onSelect?.(content)}
                  className="mt-4 px-4 py-2 rounded-lg bg-cyan-500/20 ring-1 ring-cyan-500/40 text-cyan-300 text-sm hover:bg-cyan-500/30 transition-colors"
                >
                  Start Conversation
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer controls */}
        <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
          <button className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ==================== MOBILE VARIANTS ====================

  // MobileHero - Full-width portrait hero with modality icons and title overlay (SS2)
  if (variant === "mobileHero") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        <div className="aspect-[3/4] rounded-xl bg-black/30 overflow-hidden ring-1 ring-white/10 relative">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          )}
          {/* Version badge top-left */}
          <div className="absolute top-4 left-4">
            <span className="text-xs px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-slate-300 ring-1 ring-white/20">
              1.0
            </span>
          </div>
          {/* Bottom overlay with modality icons and title */}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
            {/* Modality icons row */}
            <div className="flex items-center gap-2 mb-3">
              {activeModalities.map((mod) => (
                <span
                  key={mod}
                  className="w-10 h-10 rounded-full bg-slate-800/80 ring-1 ring-white/20 flex items-center justify-center text-lg"
                >
                  {MODALITY_ICONS[mod].icon}
                </span>
              ))}
            </div>
            <h3 className="text-xl font-bold text-cyan-400">{content.title}</h3>
            <p className="text-sm text-slate-400 mt-1">{structureLabel || content.description}</p>
          </div>
        </div>
      </button>
    );
  }

  // MobileFeatured - Tall card with title overlay on image (SS3 corrected)
  if (variant === "mobileFeatured") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        <div className="aspect-[3/4] rounded-xl bg-black/30 overflow-hidden ring-1 ring-white/10 relative">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          )}
          {/* Carousel dots overlay */}
          <div className="absolute bottom-16 left-3 flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-6 h-1.5 rounded-full bg-cyan-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
            </div>
            <span className="w-6 h-6 rounded bg-cyan-500/30 flex items-center justify-center text-xs">
              {activeModalities[0] ? MODALITY_ICONS[activeModalities[0]].icon : "📖"}
            </span>
          </div>
          {/* Title overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
            <h3 className="text-lg font-bold text-amber-400">{content.title}</h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{content.description}</p>
          </div>
        </div>
      </button>
    );
  }

  // MobileSplit - Iframe avatar top + article card below (per screenshot)
  if (variant === "mobileSplit") {
    return (
      <div className="w-full space-y-0">
        {/* Top: Avatar iframe area */}
        <div className="aspect-[4/3] bg-black rounded-t-xl overflow-hidden relative">
          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              className="absolute inset-0 w-full h-full border-0"
              allow="camera; microphone; autoplay"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {content.coverImageUri && (
                <img
                  src={content.coverImageUri}
                  alt={content.title}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
                <button
                  onClick={() => onSelect?.(content)}
                  className="px-4 py-2 rounded-full bg-white/90 text-slate-900 text-sm font-medium flex items-center gap-2 hover:bg-white transition-colors"
                >
                  <span className="text-base">🎙</span>
                  Start conversation
                </button>
              </div>
            </div>
          )}
          {/* Name label */}
          <div className="absolute bottom-2 left-3">
            <span className="text-sm font-medium text-white">{content.title}</span>
          </div>
        </div>
        {/* Bottom: Article card */}
        <button
          onClick={() => onSelect?.(content)}
          className="w-full text-left"
        >
          <div className="aspect-[4/3] rounded-b-xl bg-black/30 overflow-hidden ring-1 ring-white/10 relative">
            {content.coverImageUri && (
              <img
                src={content.coverImageUri}
                alt={content.title}
                className="w-full h-full object-cover"
              />
            )}
            {/* Title overlay at bottom */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
              <h4 className="text-sm font-semibold text-cyan-400">{content.title}</h4>
            </div>
          </div>
        </button>
      </div>
    );
  }

  // MobileCard - Large thumbnail with modality icons row + title + description (SS5)
  if (variant === "mobileCard") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left rounded-xl bg-slate-900/60 ring-1 ring-cyan-500/30 overflow-hidden"
      >
        {/* Image */}
        <div className="aspect-[16/10] relative">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          )}
          {/* App logo overlay */}
          <div className="absolute top-2 left-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white">
              {content.app}
            </span>
          </div>
        </div>
        {/* Content below */}
        <div className="p-3 space-y-2">
          {/* Modality icons row */}
          <div className="flex items-center gap-1.5">
            {activeModalities.map((mod) => (
              <span
                key={mod}
                className="w-7 h-7 rounded-full bg-slate-800 ring-1 ring-white/20 flex items-center justify-center text-sm"
              >
                {MODALITY_ICONS[mod].icon}
              </span>
            ))}
          </div>
          <h4 className="text-sm font-bold text-cyan-400">{content.title}</h4>
          <p className="text-xs text-slate-400 line-clamp-2">{content.description}</p>
        </div>
      </button>
    );
  }

  // MobileThumb - Small carousel thumbnail (2.25 visible, 2/3 height) (SS6)
  if (variant === "mobileThumb") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        {/* 2/3 height = aspect-[3/2] instead of square */}
        <div className="aspect-[3/2] rounded-lg bg-black/30 overflow-hidden ring-1 ring-white/10 relative">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
          {/* Play icon for video content */}
          {activeModalities.includes("watch") && (
            <div className="absolute bottom-1.5 right-1.5">
              <span className="w-5 h-5 rounded-full bg-cyan-500/80 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </span>
            </div>
          )}
        </div>
        <h4 className="mt-1.5 text-[10px] font-medium text-white truncate">{content.title}</h4>
      </button>
    );
  }

  // ContentWide - 2-column width content container for cinematic comics etc
  if (variant === "contentWide") {
    return (
      <button
        onClick={() => onSelect?.(content)}
        className="group w-full text-left"
      >
        <div className="aspect-[21/9] rounded-xl bg-black/30 overflow-hidden ring-1 ring-white/10 relative">
          {content.coverImageUri && (
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {/* Content overlay */}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex items-center gap-2 mb-2">
              {activeModalities.map((mod) => (
                <span
                  key={mod}
                  className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/20 flex items-center justify-center text-sm"
                >
                  {MODALITY_ICONS[mod].icon}
                </span>
              ))}
            </div>
            <h3 className="text-xl font-bold text-white">{content.title}</h3>
            <p className="text-sm text-slate-300 mt-1 line-clamp-1">{content.description}</p>
          </div>
        </div>
      </button>
    );
  }

  if (variant === "featured") {
    return (
      <div
        className={`rounded-xl bg-gradient-to-br ${appColor} ring-1 ring-white/10 overflow-hidden`}
      >
        {content.coverImageUri && (
          <div className="aspect-video bg-black/30 relative">
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-slate-300">
                  {content.app}
                </span>
                {structureLabel && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-slate-300">
                    {structureLabel}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">{content.title}</h3>
            </div>
          </div>
        )}
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-300 line-clamp-2">{content.description}</p>

          <ContentActionIcons
            modalities={modalityState}
            size="sm"
            className="flex-wrap gap-2"
          />

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div>
              {!isFree && primaryTier ? (
                <div className="text-lg font-semibold text-white">
                  {primaryTier.amount}{" "}
                  <span className="text-sm text-slate-400">{primaryTier.currency}</span>
                </div>
              ) : (
                <div className="text-lg font-semibold text-emerald-400">Free</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isInLibrary && (
                <button
                  onClick={() => onAddToLibrary?.(content)}
                  className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  title="Add to Library"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              )}
              {isOwned ? (
                <button
                  onClick={() => onSelect?.(content)}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-medium hover:from-fuchsia-400 hover:to-purple-400 transition-colors"
                >
                  Open
                </button>
              ) : (
                <button
                  onClick={() => (isFree ? onSelect?.(content) : onPurchase?.(content))}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-sm font-medium hover:from-fuchsia-400 hover:to-purple-400 transition-colors"
                >
                  {isFree ? "Read Now" : "Purchase"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard variant
  return (
    <div
      className={`rounded-xl bg-gradient-to-br ${appColor} ring-1 ring-white/10 overflow-hidden hover:ring-white/20 transition-all`}
    >
      <button
        onClick={() => onSelect?.(content)}
        className="w-full text-left"
      >
        {content.coverImageUri && (
          <div className="aspect-[4/3] bg-black/30 relative">
            <img
              src={content.coverImageUri}
              alt={content.title}
              className="w-full h-full object-cover"
            />
            {isOwned && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-500/80 text-white text-[10px] font-medium">
                Owned
              </div>
            )}
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {content.app}
            </span>
            {structureLabel && (
              <>
                <span className="text-slate-500">·</span>
                <span className="text-[10px] text-slate-400">{structureLabel}</span>
              </>
            )}
          </div>
          <h4 className="text-sm font-medium text-slate-100 line-clamp-2">{content.title}</h4>

          <div className="mt-2">
            <ContentActionIcons modalities={modalityState} size="xs" />
          </div>

          {showProgress && progressPercentage > 0 && (
            <div className="mt-2 h-1 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
        </div>
      </button>

      <div className="px-3 pb-3 flex items-center justify-between">
        <div>
          {!isFree && primaryTier ? (
            <span className="text-sm font-medium text-white">
              {primaryTier.amount}{" "}
              <span className="text-xs text-slate-400">{primaryTier.currency}</span>
            </span>
          ) : (
            <span className="text-sm font-medium text-emerald-400">Free</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isInLibrary && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToLibrary?.(content);
              }}
              className="p-1.5 rounded bg-white/5 ring-1 ring-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Add to Library"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
