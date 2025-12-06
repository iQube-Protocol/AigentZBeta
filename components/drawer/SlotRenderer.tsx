"use client";

/**
 * SlotRenderer
 * 
 * Renders a single drawer slot with its resolved data.
 * Supports various card variants and data source types.
 */

import React from "react";
import {
  Coins,
  Gift,
  CheckSquare,
  Target,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronRight,
  Lock,
  Unlock,
  Clock,
  Star,
  Zap,
} from "lucide-react";
import type { DrawerSlot, Device } from "@/types/smartDrawer";
import type { ResolvedSlotData, ResolvedItem } from "@/services/drawer/slotDataResolver";

// =============================================================================
// TYPES
// =============================================================================

export interface SlotRendererProps {
  /** The slot configuration */
  slot: DrawerSlot;
  
  /** Resolved data for this slot */
  resolvedData?: ResolvedSlotData;
  
  /** Callback when an item is selected */
  onItemSelect?: (item: ResolvedItem) => void;
  
  /** Current device */
  device: Device;
  
  /** Custom class name */
  className?: string;
}

// =============================================================================
// ICON MAPPING
// =============================================================================

const TYPE_ICONS: Record<string, React.ElementType> = {
  balance: Coins,
  entitlement: Lock,
  task: CheckSquare,
  quest: Target,
  reward: Gift,
  content: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
  article: BookOpen,
  default: FileText,
};

const getTypeIcon = (type: string): React.ElementType => {
  return TYPE_ICONS[type] ?? TYPE_ICONS.default;
};

// =============================================================================
// ITEM CARD COMPONENT
// =============================================================================

interface ItemCardProps {
  item: ResolvedItem;
  variant: string;
  onClick?: () => void;
}

function ItemCard({ item, variant, onClick }: ItemCardProps) {
  const Icon = getTypeIcon(item.type);
  const isCompact = variant === "compact" || variant === "list";

  if (isCompact) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20 transition-all text-left"
      >
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-purple-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white/90 truncate">{item.display.title}</div>
          {item.display.subtitle && (
            <div className="text-xs text-white/50 truncate">{item.display.subtitle}</div>
          )}
        </div>

        {/* Badge */}
        {item.display.badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30">
            {item.display.badge}
          </span>
        )}

        {/* Arrow */}
        {item.action && (
          <ChevronRight className="w-4 h-4 text-white/40" />
        )}
      </button>
    );
  }

  // Standard card
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20 transition-all overflow-hidden text-left"
    >
      {/* Thumbnail */}
      {item.display.imageUrl && (
        <div className="aspect-video bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 relative">
          <img
            src={item.display.imageUrl}
            alt={item.display.title}
            className="w-full h-full object-cover"
          />
          {item.display.badge && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] bg-black/60 text-white/90 backdrop-blur-sm">
              {item.display.badge}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          {!item.display.imageUrl && (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-purple-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white/90 line-clamp-2">{item.display.title}</div>
            {item.display.subtitle && (
              <div className="text-xs text-white/50 mt-0.5 line-clamp-1">{item.display.subtitle}</div>
            )}
          </div>
        </div>

        {/* Status */}
        {item.display.status && (
          <div className="mt-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/60">
              {item.display.status}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

// =============================================================================
// BALANCE CARD COMPONENT
// =============================================================================

interface BalanceCardProps {
  item: ResolvedItem;
  onClick?: () => void;
}

function BalanceCard({ item, onClick }: BalanceCardProps) {
  const raw = item.raw as any;
  
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-transparent ring-1 ring-cyan-500/20 cursor-pointer hover:ring-cyan-500/40 transition-all"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <Coins className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <div className="text-sm text-white/90">{item.display.title}</div>
          <div className="text-xs text-white/50">{raw?.chain ?? "Multi-chain"}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-white">{item.display.subtitle}</div>
        {raw?.usdValue && (
          <div className="text-xs text-white/50">${raw.usdValue.toFixed(2)}</div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// TASK CARD COMPONENT
// =============================================================================

interface TaskCardProps {
  item: ResolvedItem;
  onClick?: () => void;
}

function TaskCard({ item, onClick }: TaskCardProps) {
  const raw = item.raw as any;
  const progress = raw?.progress ?? 0;
  const status = raw?.status ?? "pending";
  
  const statusColors: Record<string, string> = {
    pending: "text-amber-400",
    in_progress: "text-blue-400",
    completed: "text-emerald-400",
    expired: "text-red-400",
  };

  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-all text-left"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckSquare className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-sm text-white/90">{item.display.title}</div>
            {item.display.subtitle && (
              <div className="text-xs text-white/50 mt-0.5">{item.display.subtitle}</div>
            )}
          </div>
        </div>
        <span className={`text-xs ${statusColors[status] ?? "text-white/50"}`}>
          {status}
        </span>
      </div>

      {/* Progress bar */}
      {progress > 0 && progress < 1 && (
        <div className="mt-3">
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-white/40 mt-1">
            {Math.round(progress * 100)}% complete
          </div>
        </div>
      )}

      {/* Reward preview */}
      {raw?.rewardPreview && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-300">
          <Gift className="w-3 h-3" />
          +{raw.rewardPreview.amount} {raw.rewardPreview.asset}
        </div>
      )}
    </button>
  );
}

// =============================================================================
// QUEST CARD COMPONENT
// =============================================================================

interface QuestCardProps {
  item: ResolvedItem;
  onClick?: () => void;
}

function QuestCard({ item, onClick }: QuestCardProps) {
  const raw = item.raw as any;
  const currentStep = raw?.currentStep ?? 0;
  const totalSteps = raw?.totalSteps ?? 1;
  const progress = currentStep / totalSteps;

  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 ring-1 ring-purple-500/20 hover:ring-purple-500/40 transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Target className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white/90">{item.display.title}</div>
          <div className="text-xs text-white/50">
            Step {currentStep} of {totalSteps}
          </div>
        </div>
        {item.display.badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
            {item.display.badge}
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Rewards */}
      {raw?.rewards && raw.rewards.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-300">
          <Star className="w-3 h-3" />
          {raw.rewards.map((r: any) => `${r.amount} ${r.asset}`).join(", ")}
        </div>
      )}
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SlotRenderer({
  slot,
  resolvedData,
  onItemSelect,
  device,
  className = "",
}: SlotRendererProps) {
  const variant = slot.cardVariant ?? "standard";
  const isLoading = !resolvedData;
  const hasError = resolvedData?.error;
  const items = resolvedData?.items ?? [];

  // Determine layout based on variant and device
  const getLayoutClass = () => {
    if (device === "mobile") {
      return "space-y-2";
    }

    switch (variant) {
      case "gridCompact":
      case "gridThumbnail":
        return "grid grid-cols-2 gap-2";
      case "gridLarge":
        return "grid grid-cols-1 gap-3";
      case "list":
      case "compact":
        return "space-y-1";
      default:
        return "space-y-2";
    }
  };

  // Render item based on type
  const renderItem = (item: ResolvedItem) => {
    switch (item.type) {
      case "balance":
        return (
          <BalanceCard
            key={item.id}
            item={item}
            onClick={() => onItemSelect?.(item)}
          />
        );
      case "task":
        return (
          <TaskCard
            key={item.id}
            item={item}
            onClick={() => onItemSelect?.(item)}
          />
        );
      case "quest":
        return (
          <QuestCard
            key={item.id}
            item={item}
            onClick={() => onItemSelect?.(item)}
          />
        );
      default:
        return (
          <ItemCard
            key={item.id}
            item={item}
            variant={variant}
            onClick={() => onItemSelect?.(item)}
          />
        );
    }
  };

  return (
    <section className={`rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 ${className}`}>
      {/* Header */}
      {slot.id && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-white/60">
            {slot.id.replace(/-/g, ' ')}
          </div>
          {items.length > 0 && (
            <span className="text-[10px] text-white/40">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{resolvedData.error}</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasError && items.length === 0 && (
        <div className="text-center py-6 text-white/50 text-sm">
          No items available
        </div>
      )}

      {/* Items */}
      {!isLoading && !hasError && items.length > 0 && (
        <div className={getLayoutClass()}>
          {items.map(renderItem)}
        </div>
      )}
    </section>
  );
}

export default SlotRenderer;
