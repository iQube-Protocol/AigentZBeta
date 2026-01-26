/**
 * KnytTemplateRenderer - Renders KNYT Liquid UI templates
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
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
import { getKnytLiquidUIService, KnytLiquidUIService } from '@/app/services/knyt/knytLiquidUIService';

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
// Main Template Renderer
// ============================================================================

export default function KnytTemplateRenderer({
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
  layoutVariant,
}: KnytTemplateRendererProps) {
  // For now, render a simple drawer grid template
  // In a full implementation, this would switch based on templateId
  const service = getKnytLiquidUIService();

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

  // Simple grid layout for now
  return (
    <div className="h-full w-full flex">
      {/* Main content area */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {contentItems.map((item) => renderCard(item))}
        </div>
      </div>

      {/* Side rails */}
      <div className="w-80 flex flex-col gap-4 p-4">
        {/* Quest Rail */}
        <QuestRail
          activeTask={activeTask}
          rewards={rewards}
          ascensionRank={ascensionRank}
          onClaimReward={(id) => console.log('Claim reward:', id)}
        />

        {/* Realm Rail */}
        <RealmRail
          activeRealm={activeRealm}
          onRealmChange={onRealmChange}
        />

        {/* Wallet Drawer Content */}
        {walletDrawerContent && (
          <div className="flex-1">
            {walletDrawerContent}
          </div>
        )}
      </div>
    </div>
  );
}
