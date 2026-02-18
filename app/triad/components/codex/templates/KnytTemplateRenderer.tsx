/**
 * KnytTemplateRenderer - Renders KNYT Liquid UI templates
 * 
 * This component renders the appropriate template based on the selected template ID,
 * handling fixed-viewport layouts, copilot overlay positioning, and wallet drawer integration.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Play, Users, Scroll, Globe, Crown, Gamepad2, 
  ChevronRight, Sparkles, Gift, ArrowRight, Lock, Check, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SmartContentActions, type ContentModalities } from '@/app/components/content/SmartContentActions';
import type {
  KnytTemplateId,
  KnytTemplate,
  GeometryVariant,
  DeviceType,
  KnytContentItem,
  DrawerMode,
  WalletUIComponent,
  CopilotOverlayMode,
  Realm,
  UserIntent,
  DrawerGridLayoutVariant,
} from '@/app/types/knytLiquidUI';
import { getKnytLiquidUIService } from '@/app/services/knyt/knytLiquidUIService';

// ============================================================================
// Template Renderer Props
// ============================================================================

interface KnytTemplateRendererProps {
  templateId: KnytTemplateId;
  device: DeviceType;
  contentItems: KnytContentItem[];
  userIntent: UserIntent;
  // Copilot state
  copilotMode: CopilotOverlayMode;
  onCopilotModeChange: (mode: CopilotOverlayMode) => void;
  copilotContent?: React.ReactNode;
  // Wallet drawer state
  drawerMode: DrawerMode;
  drawerOpen: boolean;
  walletUI: WalletUIComponent[];
  onDrawerToggle: (open: boolean) => void;
  walletDrawerContent?: React.ReactNode;
  // Content interactions
  onContentSelect: (item: KnytContentItem) => void;
  onViewerOpen: (item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => void;
  onSmartAction?: (item: KnytContentItem, action: string) => void;
  selectedItemId?: string;
  // Quest/Task state
  activeTask?: { id: string; title: string; progress: number; nextStep: string };
  rewards?: Array<{ id: string; amount: number; source: string }>;
  ascensionRank?: { current: string; next: string; progress: number };
  // Realm state
  activeRealm?: Realm;
  onRealmChange?: (realm: Realm) => void;
  // Balance
  knytBalance?: number;
  // Layout variant (copilot-selected)
  layoutVariant?: DrawerGridLayoutVariant;
  // Admin-only layout preview controls
  showLayoutPreviewControls?: boolean;
}

// ============================================================================
// Content Card Component
// ============================================================================

interface ContentCardProps {
  item: KnytContentItem;
  variant: 'poster' | 'card' | 'thumbnail' | 'featured';
  onSelect: () => void;
  onWatch?: () => void;
  onRead?: () => void;
  isSelected?: boolean;
  onAction?: (action: string) => void;
}

function ContentCard({ item, variant, onSelect, onWatch, onRead, isSelected, onAction }: ContentCardProps) {
  const itemType = item.type || '';
  const isPortrait = itemType.includes('portrait');
  const hasVideo = item.modalities?.watch?.available;
  const hasPdf = item.modalities?.read?.available;
  const hasText = !!item.media?.text;
  
  // Get modalities from metadata for SmartContentActions
  const smartModalities = item.metadata?.modalities as ContentModalities | undefined;

  // Determine if this is a character/KNYT card (should be centered) vs episode/cover (align top)
  const isCharacter = itemType.includes('character') || itemType === 'character_portrait';
  const imagePosition = isCharacter ? 'object-center' : 'object-top';

  const handleReadAction = () => {
    if (hasText) {
      onAction?.('read');
      return;
    }
    onRead?.();
  };

  const aspectClass = {
    poster: isPortrait ? 'aspect-[3/4]' : 'aspect-video',
    card: 'aspect-video',
    thumbnail: 'aspect-square',
    featured: 'aspect-[16/9]',
  }[variant];

  const sizeClass = {
    poster: 'w-full',
    card: 'w-full',
    thumbnail: 'w-24 h-24',
    featured: 'w-full',
  }[variant];

  return (
    <div
      className={`
        group relative ${aspectClass} ${sizeClass} rounded-xl overflow-hidden cursor-pointer
        transition-all duration-300 ring-1 ring-white/10
        ${isSelected ? 'ring-2 ring-cyan-400 scale-[1.02]' : 'hover:ring-white/30 hover:scale-[1.01]'}
      `}
      onClick={onSelect}
    >
      {/* Background/Thumbnail */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-black">
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt={item.title}
            className={`absolute inset-0 w-full h-full object-cover ${imagePosition}`}
          />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

      {/* Status badges */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {item.metadata?.owned && (
          <span className="px-2 py-1 bg-cyan-500/80 text-white text-xs font-bold rounded flex items-center gap-1">
            <Check className="w-3 h-3" /> OWNED
          </span>
        )}
        {item.metadata?.rarity && (
          <span className={`px-2 py-1 text-white text-xs font-bold rounded ${
            item.metadata.rarity === 'legendary' ? 'bg-amber-500/80' :
            item.metadata.rarity === 'epic' ? 'bg-purple-500/80' :
            'bg-blue-500/80'
          }`}>
            {item.metadata.rarity.toUpperCase()}
          </span>
        )}
      </div>

      {/* Action buttons - SmartContentActions or legacy buttons */}
      <div className="absolute bottom-12 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {smartModalities ? (
          <div className="flex items-center gap-1">
            <SmartContentActions
              modalities={smartModalities}
              onAction={(action) => {
                if (action === 'read') handleReadAction();
                else if (action === 'watch') onWatch?.();
                else onAction?.(action);
              }}
              size="sm"
              context="card"
              showExpand={false}
              showShare={false}
            />
            {onAction && (
              <button
                className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-white transition-all"
                title="Copilot"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction('copilot');
                }}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-1">
            {hasPdf && (
              <button
                className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                title="Read"
                onClick={(e) => { e.stopPropagation(); handleReadAction(); }}
              >
                <BookOpen className="w-4 h-4" />
              </button>
            )}
            {hasVideo && (
              <button
                className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                title="Watch"
                onClick={(e) => { e.stopPropagation(); onWatch?.(); }}
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            {onAction && (
              <button
                className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-white transition-all"
                title="Copilot"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction('copilot');
                }}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {item.subtitle && (
          <p className="text-xs text-cyan-400 font-medium">{item.subtitle}</p>
        )}
        <p className={`font-bold text-white line-clamp-2 ${variant === 'thumbnail' ? 'text-xs' : 'text-sm'}`}>
          {item.title}
        </p>
        {item.metadata?.price && !item.metadata?.owned && (
          <div className="flex items-center gap-1 mt-1">
            <Coins className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-amber-300">{item.metadata.price} KNYT</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quest Rail Component
// ============================================================================

interface QuestRailProps {
  activeTask?: { id: string; title: string; progress: number; nextStep: string };
  rewards?: Array<{ id: string; amount: number; source: string }>;
  ascensionRank?: { current: string; next: string; progress: number };
  onClaimReward?: (id: string) => void;
}

function QuestRail({ activeTask, rewards, ascensionRank, onClaimReward }: QuestRailProps) {
  return (
    <div className="h-full flex flex-col gap-4 p-4 bg-black/40 backdrop-blur-sm rounded-xl ring-1 ring-white/10">
      {/* Active Task */}
      {activeTask && (
        <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 ring-1 ring-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Active Quest</span>
          </div>
          <p className="text-sm text-white font-medium mb-2">{activeTask.title}</p>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
              style={{ width: `${activeTask.progress}%` }}
            />
          </div>
          <button className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
            {activeTask.nextStep} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Rewards */}
      {rewards && rewards.length > 0 && (
        <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 ring-1 ring-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">Rewards</span>
          </div>
          <div className="space-y-2">
            {rewards.slice(0, 2).map((reward) => (
              <div key={reward.id} className="flex items-center justify-between">
                <span className="text-xs text-white">{reward.amount} KNYT</span>
                <button 
                  className="text-xs text-amber-400 hover:text-amber-300"
                  onClick={() => onClaimReward?.(reward.id)}
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ascension Progress */}
      {ascensionRank && (
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 ring-1 ring-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-400 font-medium">Order Rank</span>
          </div>
          <p className="text-sm text-white font-bold">{ascensionRank.current}</p>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden my-2">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-400"
              style={{ width: `${ascensionRank.progress}%` }}
            />
          </div>
          <p className="text-xs text-white/60">Next: {ascensionRank.next}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Realm Rail Component
// ============================================================================

interface RealmRailProps {
  activeRealm?: Realm;
  onRealmChange?: (realm: Realm) => void;
  vertical?: boolean;
}

function RealmRail({ activeRealm = 'digiterra', onRealmChange, vertical = true }: RealmRailProps) {
  const realms: { id: Realm; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { id: 'digiterra', label: 'DigiTerra', icon: Gamepad2, color: 'cyan' },
    { id: 'terra', label: 'Terra', icon: Globe, color: 'green' },
    { id: 'metaterra_or', label: 'metaTerra/or', icon: Crown, color: 'purple' },
  ];

  return (
    <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} gap-2 p-2 bg-black/40 backdrop-blur-sm rounded-xl ring-1 ring-white/10`}>
      {realms.map((realm) => {
        const Icon = realm.icon;
        const isActive = activeRealm === realm.id;
        return (
          <button
            key={realm.id}
            onClick={() => onRealmChange?.(realm.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg transition-all
              ${vertical ? 'w-full' : ''}
              ${isActive 
                ? `bg-${realm.color}-500/20 text-${realm.color}-400 ring-1 ring-${realm.color}-500/40` 
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{realm.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Template-Specific Renderers
// ============================================================================

// Drawer Grid Template (browse/discover) - Uses template pack card types (poster3, standard)
// This template renders a grid of content cards following the template pack's drawer_grid region
// The copilot determines what content to show; this renderer displays it using the defined card types
function DrawerGridTemplate({
  contentItems,
  onContentSelect,
  onViewerOpen,
  onSmartAction,
  selectedItemId,
  copilotContent,
  copilotMode,
  userIntent,
  layoutVariant: copilotLayoutVariant,
  showLayoutPreviewControls = false,
}: {
  contentItems: KnytContentItem[];
  onContentSelect: (item: KnytContentItem) => void;
  onViewerOpen: (item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => void;
  onSmartAction?: (item: KnytContentItem, action: string) => void;
  selectedItemId?: string;
  copilotContent?: React.ReactNode;
  copilotMode: CopilotOverlayMode;
  userIntent: UserIntent;
  layoutVariant?: DrawerGridLayoutVariant;
  showLayoutPreviewControls?: boolean;
}) {
  // Template pack defines drawer_grid with poster3 (3/row) and standard (3/row) card types
  // Fixed viewport with internal scroll only
  const featured = contentItems[0] as KnytContentItem | undefined;
  const hasFeatured = !!featured?.metadata?.featured && contentItems.length >= 5;
  const featuredLayout = (featured?.metadata?.drawerGridLayout as 'featured_left' | 'featured_right' | undefined) || 'featured_right';

  // In DEV mode, allow manual override; in production, use copilot-selected variant
  const [devPreviewMode, setDevPreviewMode] = useState<'auto' | '1A' | '1B' | '1C' | '2A' | '2B' | '2C' | '3A' | '3B'>('auto');
  
  // Effective layout: DEV preview overrides copilot selection when not 'auto'
  const effectiveLayout: DrawerGridLayoutVariant = 
    (showLayoutPreviewControls && devPreviewMode !== 'auto') 
      ? devPreviewMode 
      : (copilotLayoutVariant || 'auto');

  const renderCard = (item: KnytContentItem, variantOverride?: ContentCardProps['variant']) => {
    const hasPdf = item.modalities?.read?.available;
    const hasVideo = item.modalities?.watch?.available;
    const itemType = item.type || '';
    const isPortrait = itemType.includes('portrait');
    const defaultOpen = () => {
      console.log('[KnytTemplateRenderer] defaultOpen called for:', item.title, { hasPdf, hasVideo, userIntent });
      if (item.media?.text) {
        onSmartAction?.(item, 'read');
        return;
      }
      if (userIntent === 'watch' || userIntent === 'motion_comics' || userIntent === 'immersive_review' || userIntent === 'trailers' || userIntent === 'scene_review') {
        if (hasVideo) { console.log('[KnytTemplateRenderer] Opening video viewer'); return onViewerOpen(item, 'video'); }
        if (hasPdf) { console.log('[KnytTemplateRenderer] Opening PDF viewer'); return onViewerOpen(item, 'pdf'); }
        return;
      }
      if (userIntent === 'page_review' || userIntent === 'cover_art' || userIntent === 'collectible_display') {
        if (hasPdf) { console.log('[KnytTemplateRenderer] Opening PDF viewer'); return onViewerOpen(item, 'pdf'); }
        if (hasVideo) { console.log('[KnytTemplateRenderer] Opening video viewer'); return onViewerOpen(item, 'video'); }
        return;
      }
      if (hasPdf) { console.log('[KnytTemplateRenderer] Opening PDF viewer (default)'); return onViewerOpen(item, 'pdf'); }
      if (hasVideo) { console.log('[KnytTemplateRenderer] Opening video viewer (default)'); return onViewerOpen(item, 'video'); }
    };

    const variant: ContentCardProps['variant'] = variantOverride || (isPortrait ? 'poster' : 'card');

    return (
      <ContentCard
        key={item.id}
        item={item}
        variant={variant}
        isSelected={selectedItemId === item.id}
        onSelect={() => {
          onContentSelect(item);
          defaultOpen();
        }}
        onRead={() => onViewerOpen(item, 'pdf')}
        onWatch={() => onViewerOpen(item, 'video')}
        onAction={(action) => onSmartAction?.(item, action)}
      />
    );
  };

  const renderPlacedGrid = (placements: Array<{ key: string; item: KnytContentItem; col: number; row: number; colSpan: number; rowSpan: number; variant?: ContentCardProps['variant'] }>) => {
    return (
      <div className="hidden lg:grid lg:grid-cols-4 lg:grid-rows-3 lg:auto-rows-fr gap-4 h-full">
        {placements.map((p) => (
          <div
            key={p.key}
            className="h-full"
            style={{
              gridColumn: `${p.col} / span ${p.colSpan}`,
              gridRow: `${p.row} / span ${p.rowSpan}`,
            }}
          >
            {renderCard(p.item, p.variant)}
          </div>
        ))}
      </div>
    );
  };

  const getProductionDesktopPlacements = () => {
    // Featured / 1C style (2x2 stage) + optional row-3 fillers
    if (hasFeatured) {
      const f = contentItems[0];
      if (!f) return null;

      const featuredLeft = featuredLayout === 'featured_left';
      const featuredCol = featuredLeft ? 1 : 3;
      const posterCol1 = featuredLeft ? 3 : 1;
      const posterCol2 = featuredLeft ? 4 : 2;

      const remaining = contentItems.slice(1);
      const portraits = remaining.filter((x) => (x.type || '').includes('portrait'));

      // If we have at least 2 portrait tiles, lock them into the non-featured side as true posters
      // so a poster never “falls” to row 3 (especially column 2).
      if (portraits.length >= 2) {
        const p0 = portraits[0];
        const p1 = portraits[1];
        const usedIds = new Set([f.id, p0.id, p1.id]);
        const fillers = contentItems
          .filter((x) => !usedIds.has(x.id))
          .slice(0, 4);

        return [
          { key: 'p0', item: p0, col: posterCol1, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 'p1', item: p1, col: posterCol2, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 'f', item: f, col: featuredCol, row: 1, colSpan: 2, rowSpan: 2, variant: 'featured' as const },
          ...(fillers[0] ? [{ key: 'r3c1', item: fillers[0], col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(fillers[1] ? [{ key: 'r3c2', item: fillers[1], col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(fillers[2] ? [{ key: 'r3c3', item: fillers[2], col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(fillers[3] ? [{ key: 'r3c4', item: fillers[3], col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ];
      }

      // Fallback: keep the prior 2x2 non-featured side when not enough portraits exist.
      const a = contentItems[1];
      const b = contentItems[2];
      const c = contentItems[3];
      const d = contentItems[4];
      if (!a || !b || !c || !d) return null;

      const nonFeaturedSideCol1 = featuredLeft ? 3 : 1;
      const nonFeaturedSideCol2 = featuredLeft ? 4 : 2;

      const usedIds = new Set([f.id, a.id, b.id, c.id, d.id]);
      const fillers = contentItems.filter((x) => !usedIds.has(x.id)).slice(0, 4);

      return [
        { key: 'f', item: f, col: featuredCol, row: 1, colSpan: 2, rowSpan: 2, variant: 'featured' as const },
        { key: 'a', item: a, col: nonFeaturedSideCol1, row: 1, colSpan: 1, rowSpan: 1 },
        { key: 'b', item: b, col: nonFeaturedSideCol2, row: 1, colSpan: 1, rowSpan: 1 },
        { key: 'c', item: c, col: nonFeaturedSideCol1, row: 2, colSpan: 1, rowSpan: 1 },
        { key: 'd', item: d, col: nonFeaturedSideCol2, row: 2, colSpan: 1, rowSpan: 1 },
        ...(fillers[0] ? [{ key: 'r3c1', item: fillers[0], col: 1, row: 3, colSpan: 1, rowSpan: 1 }] : []),
        ...(fillers[1] ? [{ key: 'r3c2', item: fillers[1], col: 2, row: 3, colSpan: 1, rowSpan: 1 }] : []),
        ...(fillers[2] ? [{ key: 'r3c3', item: fillers[2], col: 3, row: 3, colSpan: 1, rowSpan: 1 }] : []),
        ...(fillers[3] ? [{ key: 'r3c4', item: fillers[3], col: 4, row: 3, colSpan: 1, rowSpan: 1 }] : []),
      ];
    }

    // Auto: default to 1A-like placement (posters only start row 1; row 3 remains wide)
    const tall = contentItems.filter((i) => (i.type || '').includes('portrait'));
    const wide = contentItems.filter((i) => !(i.type || '').includes('portrait'));
    const t0 = tall[0];
    const t1 = tall[1];
    const w = (idx: number) => wide[idx] || contentItems[idx];
    const w0 = w(0);
    const w1 = w(1);
    const w2 = w(2);
    const w3 = w(3);
    const w4 = w(4);
    const w5 = w(5);
    const w6 = w(6);
    const w7 = w(7);

    const placements: Array<{ key: string; item: KnytContentItem; col: number; row: number; colSpan: number; rowSpan: number; variant?: ContentCardProps['variant'] }> = [];
    if (t0) placements.push({ key: 't0', item: t0, col: 1, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' });
    if (t1) placements.push({ key: 't1', item: t1, col: 2, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' });

    if (w0) placements.push({ key: 'w0', item: w0, col: 3, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' });
    if (w1) placements.push({ key: 'w1', item: w1, col: 4, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' });
    if (w2) placements.push({ key: 'w2', item: w2, col: 3, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' });
    if (w3) placements.push({ key: 'w3', item: w3, col: 4, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' });
    if (w4) placements.push({ key: 'w4', item: w4, col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' });
    if (w5) placements.push({ key: 'w5', item: w5, col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' });
    if (w6) placements.push({ key: 'w6', item: w6, col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' });
    if (w7) placements.push({ key: 'w7', item: w7, col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' });

    return placements.length ? placements : null;
  };

  const devIsDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const shouldShowDevPreview = showLayoutPreviewControls && devIsDesktop;

  const tallCandidatesRaw = contentItems.filter((i) => (i.type || '').includes('portrait'));
  const wideCandidatesRaw = contentItems.filter((i) => !(i.type || '').includes('portrait'));
  const tallCandidates = tallCandidatesRaw.length > 0 ? tallCandidatesRaw : contentItems;
  const wideCandidates = wideCandidatesRaw.length > 0 ? wideCandidatesRaw : contentItems;
  const synopsisItem = contentItems.find((item) => /synopsis/i.test(item.title));

  const cyclePick = <T,>(arr: T[], idx: number) => {
    if (!arr.length) return undefined;
    const safe = ((idx % arr.length) + arr.length) % arr.length;
    return arr[safe];
  };

  // Get placements for a specific layout variant (used by both DEV preview and production)
  const getPlacementsForVariant = (variant: DrawerGridLayoutVariant) => {
    if (variant === 'auto') return null;

    if (variant === '1C') {
      const f = cyclePick(wideCandidates, 0) || cyclePick(contentItems, 0);
      if (!f) return null;

      const featuredLeft = userIntent === 'watch' || userIntent === 'motion_comics' || userIntent === 'immersive_review' || userIntent === 'trailers' || userIntent === 'scene_review';
      const featuredCol = featuredLeft ? 1 : 3;
      const posterCol1 = featuredLeft ? 3 : 1;
      const posterCol2 = featuredLeft ? 4 : 2;

      // Use portrait items for the non-featured side as 2-row posters
      const p0 = cyclePick(tallCandidates, 0);
      const p1 = cyclePick(tallCandidates, 1);
      if (!p0 || !p1) return null;

      const usedIds = new Set([f.id, p0.id, p1.id]);
      const fillers = contentItems.filter((x) => !usedIds.has(x.id)).slice(0, 4);

      return [
        { key: 'f', item: f, col: featuredCol, row: 1, colSpan: 2, rowSpan: 2, variant: 'featured' as const },
        { key: 'p0', item: p0, col: posterCol1, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        { key: 'p1', item: p1, col: posterCol2, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        ...(fillers[0] ? [{ key: 'r3c1', item: fillers[0], col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ...(fillers[1] ? [{ key: 'r3c2', item: fillers[1], col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ...(fillers[2] ? [{ key: 'r3c3', item: fillers[2], col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ...(fillers[3] ? [{ key: 'r3c4', item: fillers[3], col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
      ];
    }

    // Option 1 variants: 2 posters left side
    if (variant === '1A' || variant === '1B') {
      const t0 = cyclePick(tallCandidates, 0);
      const t1 = cyclePick(tallCandidates, 1);
      const w0 = cyclePick(wideCandidates, 0);
      const w1 = cyclePick(wideCandidates, 1);
      const w2 = cyclePick(wideCandidates, 2);
      const w3 = cyclePick(wideCandidates, 3);
      const w4 = cyclePick(wideCandidates, 4);
      const w5 = cyclePick(wideCandidates, 5);
      const w6 = cyclePick(wideCandidates, 6);
      const w7 = cyclePick(wideCandidates, 7);

      if (variant === '1A') {
        // 1A: 2 posters (cols 1-2) + 4 wide (cols 3-4) + 4 wide (row 3)
        if (!t0 || !t1 || !w0 || !w1 || !w2 || !w3 || !w4 || !w5 || !w6 || !w7) return null;
        return [
          { key: 't0', item: t0, col: 1, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 't1', item: t1, col: 2, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 'w0', item: w0, col: 3, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w1', item: w1, col: 4, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w2', item: w2, col: 3, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w3', item: w3, col: 4, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w4', item: w4, col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w5', item: w5, col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w6', item: w6, col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w7', item: w7, col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        ];
      }

      // 1B: 2 posters (cols 1-2) + 4 wide (cols 3-4) + 2 wide (cols 1-2 row 3) — sparse row 3
      if (!t0 || !t1 || !w0 || !w1 || !w2 || !w3 || !w4 || !w5) return null;
      return [
        { key: 't0', item: t0, col: 1, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        { key: 't1', item: t1, col: 2, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        { key: 'w0', item: w0, col: 3, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w1', item: w1, col: 4, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w2', item: w2, col: 3, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w3', item: w3, col: 4, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w4', item: w4, col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w5', item: w5, col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
      ];
    }

    // Option 2 variants: Featured 2x2 stage
    if (variant === '2A' || variant === '2B' || variant === '2C') {
      const f = cyclePick(wideCandidates, 0) || cyclePick(contentItems, 0);
      const w0 = cyclePick(wideCandidates, 1);
      const w1 = cyclePick(wideCandidates, 2);
      const w2 = cyclePick(wideCandidates, 3);
      const w3 = cyclePick(wideCandidates, 4);
      const w4 = cyclePick(wideCandidates, 5);
      const w5 = cyclePick(wideCandidates, 6);
      const w6 = cyclePick(wideCandidates, 7);
      const w7 = cyclePick(wideCandidates, 8);
      if (!f || !w0 || !w1 || !w2 || !w3) return null;

      if (variant === '2A') {
        // 2A: Featured 2x2 LEFT + 4 wide right (cols 3-4) + 4 wide row 3
        return [
          { key: 'f', item: f, col: 1, row: 1, colSpan: 2, rowSpan: 2, variant: 'featured' as const },
          { key: 'w0', item: w0, col: 3, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w1', item: w1, col: 4, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w2', item: w2, col: 3, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w3', item: w3, col: 4, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          ...(w4 ? [{ key: 'w4', item: w4, col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(w5 ? [{ key: 'w5', item: w5, col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(w6 ? [{ key: 'w6', item: w6, col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(w7 ? [{ key: 'w7', item: w7, col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ];
      }

      if (variant === '2B') {
        // 2B: Featured 2x2 RIGHT + 4 wide left (cols 1-2) + 4 wide row 3
        return [
          { key: 'f', item: f, col: 3, row: 1, colSpan: 2, rowSpan: 2, variant: 'featured' as const },
          { key: 'w0', item: w0, col: 1, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w1', item: w1, col: 2, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w2', item: w2, col: 1, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w3', item: w3, col: 2, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          ...(w4 ? [{ key: 'w4', item: w4, col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(w5 ? [{ key: 'w5', item: w5, col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(w6 ? [{ key: 'w6', item: w6, col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
          ...(w7 ? [{ key: 'w7', item: w7, col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ];
      }

      // 2C: Featured 2x2 CENTER (cols 2-3) + 2 wide sides + 4 wide row 3
      return [
        { key: 'f', item: f, col: 2, row: 1, colSpan: 2, rowSpan: 2, variant: 'featured' as const },
        { key: 'w0', item: w0, col: 1, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w1', item: w1, col: 4, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w2', item: w2, col: 1, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w3', item: w3, col: 4, row: 2, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        ...(w4 ? [{ key: 'w4', item: w4, col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ...(w5 ? [{ key: 'w5', item: w5, col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ...(w6 ? [{ key: 'w6', item: w6, col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
        ...(w7 ? [{ key: 'w7', item: w7, col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const }] : []),
      ];
    }

    // Option 3 variants: 4 tall posters
    if (variant === '3A' || variant === '3B') {
      const t0 = cyclePick(tallCandidates, 0);
      const t1 = cyclePick(tallCandidates, 1);
      const t2 = cyclePick(tallCandidates, 2);
      const t3 = cyclePick(tallCandidates, 3);
      const w0 = cyclePick(wideCandidates, 0);
      const w1 = cyclePick(wideCandidates, 1);
      const w2 = cyclePick(wideCandidates, 2);
      const w3 = cyclePick(wideCandidates, 3);

      if (variant === '3A') {
        // 3A: 2 posters left (rows 1-2) + 2 wide top-right + 2 posters right (rows 2-3) + 2 wide bottom-left
        if (!t0 || !t1 || !t2 || !t3 || !w0 || !w1 || !w2 || !w3) return null;
        return [
          { key: 't0', item: t0, col: 1, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 't1', item: t1, col: 2, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 'w0', item: w0, col: 3, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w1', item: w1, col: 4, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 't2', item: t2, col: 3, row: 2, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 't3', item: t3, col: 4, row: 2, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
          { key: 'w2', item: w2, col: 1, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
          { key: 'w3', item: w3, col: 2, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        ];
      }

      // 3B: Mirror of 3A — 2 posters right (rows 1-2) + 2 wide top-left + 2 posters left (rows 2-3) + 2 wide bottom-right
      if (!t0 || !t1 || !t2 || !t3 || !w0 || !w1 || !w2 || !w3) return null;
      return [
        { key: 'w0', item: w0, col: 1, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w1', item: w1, col: 2, row: 1, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 't0', item: t0, col: 3, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        { key: 't1', item: t1, col: 4, row: 1, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        { key: 't2', item: t2, col: 1, row: 2, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        { key: 't3', item: t3, col: 2, row: 2, colSpan: 1, rowSpan: 2, variant: 'poster' as const },
        { key: 'w2', item: w2, col: 3, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
        { key: 'w3', item: w3, col: 4, row: 3, colSpan: 1, rowSpan: 1, variant: 'card' as const },
      ];
    }

    return null;
  };

  const devPlacements = getPlacementsForVariant(devPreviewMode);
  const showDevPreviewGrid = shouldShowDevPreview && devPreviewMode !== 'auto' && !!devPlacements;
  
  // In production, use copilot-selected layout variant OR fall back to old production logic
  const copilotPlacements = effectiveLayout !== 'auto' ? getPlacementsForVariant(effectiveLayout) : null;
  const applySynopsisTopRight = (
    placements: Array<{ key: string; item: KnytContentItem; col: number; row: number; colSpan: number; rowSpan: number; variant?: ContentCardProps['variant'] }>
  ) => {
    if (!synopsisItem) return placements;

    const featuredRight = placements.find((p) => p.col === 3 && p.row === 1 && p.colSpan === 2 && p.rowSpan === 2);
    const topRight = featuredRight || placements.find((p) => p.col === 4 && p.row === 1);
    if (!topRight) return placements;

    const synopsisPlacement = placements.find((p) => p.item.id === synopsisItem.id);
    if (synopsisPlacement?.key === topRight.key) return placements;

    return placements.map((p) => {
      if (p.key === topRight.key) {
        return { ...p, item: synopsisItem };
      }
      if (synopsisPlacement && p.key === synopsisPlacement.key) {
        return { ...p, item: topRight.item };
      }
      return p;
    });
  };

  const productionDesktopPlacementsRaw = copilotPlacements || getProductionDesktopPlacements();
  const productionDesktopPlacements = productionDesktopPlacementsRaw
    ? applySynopsisTopRight(productionDesktopPlacementsRaw)
    : null;
  const showProductionDesktopGrid = !showDevPreviewGrid && !!productionDesktopPlacements;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Content Grid - poster3 layout (3 cards per row) with internal scroll */}
      <div className="flex-1 p-4">
        {shouldShowDevPreview ? (
          <div className="mb-3 flex items-center gap-1 flex-wrap">
            {(['auto', '1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B'] as const).map((mode) => (
              <button
                key={mode}
                className={`px-2 py-1 rounded text-xs ring-1 ring-white/10 ${devPreviewMode === mode ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                onClick={() => setDevPreviewMode(mode)}
              >
                {mode === 'auto' ? 'Auto' : mode}
              </button>
            ))}
          </div>
        ) : null}

        {showDevPreviewGrid ? renderPlacedGrid(devPlacements!) : null}
        {showProductionDesktopGrid ? renderPlacedGrid(productionDesktopPlacements!) : null}

        {!showDevPreviewGrid && !showProductionDesktopGrid ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:grid-rows-2 lg:auto-rows-fr gap-4">
            {contentItems.map((item) => renderCard(item))}
          </div>
        ) : null}

        {hasFeatured ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:hidden">
            {contentItems.map((item) => renderCard(item))}
          </div>
        ) : null}
        {contentItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-white/60">
            <BookOpen className="w-12 h-12 mb-4 opacity-50" />
            <p>No content available</p>
            <p className="text-sm mt-1">Check back soon for new Digital Scrolls</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Dual Poster Stage Template (character deep dive, cover art)
function DualPosterStageTemplate({
  contentItems,
  onContentSelect,
  onViewerOpen,
  selectedItemId,
  activeTask,
  rewards,
  ascensionRank,
  device,
  userIntent,
}: {
  contentItems: KnytContentItem[];
  onContentSelect: (item: KnytContentItem) => void;
  onViewerOpen: (item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => void;
  selectedItemId?: string;
  activeTask?: { id: string; title: string; progress: number; nextStep: string };
  rewards?: Array<{ id: string; amount: number; source: string }>;
  ascensionRank?: { current: string; next: string; progress: number };
  device: DeviceType;
  userIntent: UserIntent;
}) {
  const primaryItem = contentItems.find(i => i.id === selectedItemId) || contentItems[0];
  const secondaryItems = contentItems.filter(i => i.id !== primaryItem?.id).slice(0, 4);

  return (
    <div className="h-full flex">
      {/* Primary Poster - 90% height */}
      <div className="flex-1 p-4 flex items-center justify-center">
        {primaryItem ? (
          <div className="h-[90%] aspect-[3/4] max-w-full">
            <ContentCard
              item={primaryItem}
              variant="poster"
              isSelected={true}
              onSelect={() => {
                onContentSelect(primaryItem);
                const hasPdf = primaryItem.modalities?.read?.available;
                const hasVideo = primaryItem.modalities?.watch?.available;
                if ((userIntent === 'watch' || userIntent === 'motion_comics') && hasVideo) {
                  onViewerOpen(primaryItem, 'video');
                } else if (hasPdf) {
                  onViewerOpen(primaryItem, 'pdf');
                } else if (hasVideo) {
                  onViewerOpen(primaryItem, 'video');
                }
              }}
              onRead={() => onViewerOpen(primaryItem, 'pdf')}
              onWatch={() => onViewerOpen(primaryItem, 'video')}
            />
          </div>
        ) : (
          <div className="text-white/60 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Select a character or cover</p>
          </div>
        )}
      </div>

      {/* Secondary content + Quest Rail (desktop only) */}
      {device !== 'mobile' && (
        <div className="w-80 flex flex-col gap-4 p-4">
          {/* Secondary posters */}
          {secondaryItems.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {secondaryItems.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  variant="thumbnail"
                  onSelect={() => {
                    onContentSelect(item);
                    const hasPdf = item.modalities?.read?.available;
                    const hasVideo = item.modalities?.watch?.available;
                    if ((userIntent === 'watch' || userIntent === 'motion_comics') && hasVideo) {
                      onViewerOpen(item, 'video');
                    } else if (hasPdf) {
                      onViewerOpen(item, 'pdf');
                    } else if (hasVideo) {
                      onViewerOpen(item, 'video');
                    }
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Quest Rail */}
          <div className="flex-1">
            <QuestRail
              activeTask={activeTask}
              rewards={rewards}
              ascensionRank={ascensionRank}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Motion Stage Template (watch, motion comics)
function MotionStageTemplate({
  contentItems,
  onContentSelect,
  onViewerOpen,
  selectedItemId,
  activeTask,
  rewards,
  device,
  userIntent,
}: {
  contentItems: KnytContentItem[];
  onContentSelect: (item: KnytContentItem) => void;
  onViewerOpen: (item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => void;
  selectedItemId?: string;
  activeTask?: { id: string; title: string; progress: number; nextStep: string };
  rewards?: Array<{ id: string; amount: number; source: string }>;
  device: DeviceType;
  userIntent: UserIntent;
}) {
  const motionItems = contentItems.filter(i => i.type === 'motion_comic_landscape');
  const selectedItem = motionItems.find(i => i.id === selectedItemId) || motionItems[0];

  return (
    <div className="h-full flex flex-col">
      {/* Main Video Stage */}
      <div className="flex-1 p-4 flex items-center justify-center bg-black">
        {selectedItem ? (
          <div 
            className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden ring-1 ring-white/10 cursor-pointer group relative"
            onClick={() => onViewerOpen(selectedItem, 'video')}
          >
            {selectedItem.thumbnail && (
              <img
                src={selectedItem.thumbnail}
                alt={selectedItem.title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-cyan-500/80 flex items-center justify-center">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
              <p className="text-lg font-bold text-white">{selectedItem.title}</p>
              {selectedItem.modalities?.watch?.duration && (
                <p className="text-sm text-white/60">{selectedItem.modalities.watch.duration}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-white/60 text-center">
            <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No motion comics available</p>
          </div>
        )}
      </div>

      {/* Clip Strip */}
      <div className="h-24 px-4 py-2 bg-black/60 border-t border-white/10">
        <div className="flex gap-2 overflow-x-auto h-full">
          {motionItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onContentSelect(item)}
              className={`
                flex-shrink-0 h-full aspect-video rounded-lg overflow-hidden ring-1 transition-all
                ${selectedItemId === item.id ? 'ring-cyan-400 ring-2' : 'ring-white/10 hover:ring-white/30'}
              `}
            >
              {item.thumbnail && (
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Quest HUD Hub Template (tasks, rewards, ascension)
function QuestHudHubTemplate({
  contentItems,
  onContentSelect,
  onViewerOpen,
  selectedItemId,
  activeTask,
  rewards,
  ascensionRank,
  device,
  userIntent,
}: {
  contentItems: KnytContentItem[];
  onContentSelect: (item: KnytContentItem) => void;
  onViewerOpen: (item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => void;
  selectedItemId?: string;
  activeTask?: { id: string; title: string; progress: number; nextStep: string };
  rewards?: Array<{ id: string; amount: number; source: string }>;
  ascensionRank?: { current: string; next: string; progress: number };
  device: DeviceType;
  userIntent: UserIntent;
}) {
  return (
    <div className="h-full flex">
      {/* Left HUD - Order Status (desktop only) */}
      {device !== 'mobile' && (
        <div className="w-56 p-4">
          <div className="h-full flex flex-col gap-4 p-4 bg-black/40 backdrop-blur-sm rounded-xl ring-1 ring-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-white">Order Status</span>
            </div>
            
            {ascensionRank && (
              <>
                <div className="text-center py-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 ring-2 ring-purple-500/50 flex items-center justify-center mb-3">
                    <Crown className="w-10 h-10 text-purple-400" />
                  </div>
                  <p className="text-lg font-bold text-white">{ascensionRank.current}</p>
                  <p className="text-xs text-white/60">Current Rank</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Progress</span>
                    <span className="text-purple-400">{ascensionRank.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-400"
                      style={{ width: `${ascensionRank.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/50 text-center">Next: {ascensionRank.next}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Center Content Stage */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {contentItems.slice(0, 6).map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              variant="card"
              isSelected={selectedItemId === item.id}
              onSelect={() => {
                onContentSelect(item);
                const hasPdf = item.modalities?.read?.available;
                const hasVideo = item.modalities?.watch?.available;
                if ((userIntent === 'watch' || userIntent === 'motion_comics') && hasVideo) {
                  onViewerOpen(item, 'video');
                } else if (hasPdf) {
                  onViewerOpen(item, 'pdf');
                } else if (hasVideo) {
                  onViewerOpen(item, 'video');
                }
              }}
              onRead={() => onViewerOpen(item, 'pdf')}
              onWatch={() => onViewerOpen(item, 'video')}
            />
          ))}
        </div>
      </div>

      {/* Right HUD - Tasks & Rewards */}
      {device !== 'mobile' && (
        <div className="w-64 p-4">
          <QuestRail
            activeTask={activeTask}
            rewards={rewards}
          />
        </div>
      )}
    </div>
  );
}

// Realm Bridge Map Template (realm navigation)
function RealmBridgeMapTemplate({
  contentItems,
  onContentSelect,
  onViewerOpen,
  selectedItemId,
  activeRealm,
  onRealmChange,
  device,
  userIntent,
}: {
  contentItems: KnytContentItem[];
  onContentSelect: (item: KnytContentItem) => void;
  onViewerOpen: (item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => void;
  selectedItemId?: string;
  activeRealm?: Realm;
  onRealmChange?: (realm: Realm) => void;
  device: DeviceType;
  userIntent: UserIntent;
}) {
  // Filter content by realm
  const realmContent = contentItems.filter(i => i.metadata?.realm === activeRealm);

  return (
    <div className="h-full flex">
      {/* Realm Rail */}
      {device !== 'mobile' ? (
        <div className="w-48 p-4">
          <RealmRail
            activeRealm={activeRealm}
            onRealmChange={onRealmChange}
            vertical={true}
          />
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 p-2 z-10">
          <RealmRail
            activeRealm={activeRealm}
            onRealmChange={onRealmChange}
            vertical={false}
          />
        </div>
      )}

      {/* Bridge Stage */}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {realmContent.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                variant="featured"
                isSelected={selectedItemId === item.id}
                onSelect={() => {
                  onContentSelect(item);
                  const hasPdf = item.modalities?.read?.available;
                  const hasVideo = item.modalities?.watch?.available;
                  if ((userIntent === 'watch' || userIntent === 'motion_comics') && hasVideo) {
                    onViewerOpen(item, 'video');
                  } else if (hasPdf) {
                    onViewerOpen(item, 'pdf');
                  } else if (hasVideo) {
                    onViewerOpen(item, 'video');
                  }
                }}
                onRead={() => onViewerOpen(item, 'pdf')}
                onWatch={() => onViewerOpen(item, 'video')}
              />
            ))}
          </div>
          {realmContent.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-white/60">
              <Globe className="w-12 h-12 mb-4 opacity-50" />
              <p>No content in this realm yet</p>
            </div>
          )}
        </div>

        {/* Related Strip */}
        <div className="h-20 mt-4 flex gap-2 overflow-x-auto">
          {contentItems.filter(i => i.metadata?.realm !== activeRealm).slice(0, 6).map((item) => (
            <button
              key={item.id}
              onClick={() => onContentSelect(item)}
              className="flex-shrink-0 h-full aspect-square rounded-lg overflow-hidden ring-1 ring-white/10 hover:ring-white/30 transition-all"
            >
              {item.thumbnail && (
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Template Renderer
// ============================================================================

export function KnytTemplateRenderer({
  templateId,
  device,
  contentItems,
  userIntent,
  copilotMode,
  onCopilotModeChange,
  copilotContent,
  drawerMode,
  drawerOpen,
  walletUI,
  onDrawerToggle,
  walletDrawerContent,
  onContentSelect,
  onViewerOpen,
  onSmartAction,
  selectedItemId,
  activeTask,
  rewards,
  ascensionRank,
  activeRealm,
  onRealmChange,
  knytBalance,
  layoutVariant: copilotLayoutVariant,
  showLayoutPreviewControls = false,
}: KnytTemplateRendererProps) {
  const service = getKnytLiquidUIService();
  const template = service.getTemplate(templateId);
  const geometry = service.getGeometryForDevice(templateId, device);

  if (!template) {
    return (
      <div className="h-full flex items-center justify-center text-white/60">
        <p>Template not found: {templateId}</p>
      </div>
    );
  }

  // Render template-specific content
  const renderTemplateContent = () => {
    switch (templateId) {
      case 'knyt:drawer_grid_v1':
        return (
          <DrawerGridTemplate
            contentItems={contentItems}
            onContentSelect={onContentSelect}
            onViewerOpen={onViewerOpen}
            onSmartAction={onSmartAction}
            selectedItemId={selectedItemId}
            copilotContent={copilotContent}
            copilotMode={copilotMode}
            userIntent={userIntent}
            layoutVariant={copilotLayoutVariant}
            showLayoutPreviewControls={showLayoutPreviewControls}
          />
        );

      case 'knyt:dual_poster_stage_v1':
        return (
          <DualPosterStageTemplate
            contentItems={contentItems}
            onContentSelect={onContentSelect}
            onViewerOpen={onViewerOpen}
            selectedItemId={selectedItemId}
            activeTask={activeTask}
            rewards={rewards}
            ascensionRank={ascensionRank}
            device={device}
            userIntent={userIntent}
          />
        );

      case 'knyt:motion_stage_v1':
        return (
          <MotionStageTemplate
            contentItems={contentItems}
            onContentSelect={onContentSelect}
            onViewerOpen={onViewerOpen}
            selectedItemId={selectedItemId}
            activeTask={activeTask}
            rewards={rewards}
            device={device}
            userIntent={userIntent}
          />
        );

      case 'knyt:quest_hud_hub_v1':
        return (
          <QuestHudHubTemplate
            contentItems={contentItems}
            onContentSelect={onContentSelect}
            onViewerOpen={onViewerOpen}
            selectedItemId={selectedItemId}
            activeTask={activeTask}
            rewards={rewards}
            ascensionRank={ascensionRank}
            device={device}
            userIntent={userIntent}
          />
        );

      case 'knyt:realm_bridge_map_v1':
        return (
          <RealmBridgeMapTemplate
            contentItems={contentItems}
            onContentSelect={onContentSelect}
            onViewerOpen={onViewerOpen}
            selectedItemId={selectedItemId}
            activeRealm={activeRealm}
            onRealmChange={onRealmChange}
            device={device}
            userIntent={userIntent}
          />
        );

      default:
        return (
          <DrawerGridTemplate
            contentItems={contentItems}
            onContentSelect={onContentSelect}
            onViewerOpen={onViewerOpen}
            selectedItemId={selectedItemId}
            copilotContent={copilotContent}
            copilotMode={copilotMode}
            userIntent={userIntent}
            showLayoutPreviewControls={showLayoutPreviewControls}
          />
        );
    }
  };

  return (
    <div className="h-full w-full overflow-hidden relative">
      {/* Main template content */}
      {renderTemplateContent()}

      {/* Wallet Drawer */}
      {walletDrawerContent}
    </div>
  );
}
