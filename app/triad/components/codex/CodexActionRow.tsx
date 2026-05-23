'use client';

import { BookOpen, Eye, Headphones, Loader2, Play, Share2, Square } from 'lucide-react';
import { CodexBadge } from './CodexBadge';
import { getContentPrice } from './utils/contentFlags';
import { useTTSPlayer } from '@/app/hooks/useTTSPlayer';

type Variant = 'indigo' | 'amber' | 'slate';

interface CodexActionRowProps {
  showRead?: boolean;
  showWatch?: boolean;
  showView?: boolean;
  showShare?: boolean;
  showListen?: boolean;
  onRead?: () => void;
  onWatch?: () => void;
  onView?: () => void;
  onShare?: () => void;
  /**
   * TTS text resolver. When provided alongside showListen, the row renders a
   * first-class Listen action that streams audio via /api/skills/tts. New
   * cartridge tabs inherit TTS automatically by passing this prop.
   */
  getListenText?: () => string;
  listenVoice?: string;
  variant?: Variant;
  className?: string;
  /** Pass the content item to auto-render a Q¢ price badge when price > 0. */
  item?: {
    price?: { amount?: number | string | null } | null;
    pricingModel?: { tiers?: Array<{ amount?: number | string | null; kind?: string }> } | null;
    market_data?: { pricing_model?: { tiers?: Array<{ amount?: number | string | null; kind?: string }> } | null } | null;
    metadata?: { pricing?: { amount?: number | string | null } } | null;
  };
  /** When true, suppress the price badge (item is already owned). */
  isOwned?: boolean;
}

const VARIANTS: Record<Variant, { primary: string; secondary: string }> = {
  indigo: {
    primary: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20',
    secondary: 'border-slate-600 bg-slate-700/30 text-slate-200 hover:bg-slate-700/60',
  },
  amber: {
    primary: 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
    secondary: 'border-slate-600 bg-slate-700/30 text-slate-200 hover:bg-slate-700/60',
  },
  slate: {
    primary: 'border-slate-500/40 bg-slate-500/10 text-slate-200 hover:bg-slate-500/20',
    secondary: 'border-slate-600 bg-slate-700/30 text-slate-200 hover:bg-slate-700/60',
  },
};

export function CodexActionRow({
  showRead,
  showWatch,
  showView = true,
  showShare = false,
  showListen = false,
  onRead,
  onWatch,
  onView,
  onShare,
  getListenText,
  listenVoice,
  variant = 'indigo',
  className,
  item,
  isOwned = false,
}: CodexActionRowProps) {
  const styles = VARIANTS[variant];
  const base =
    'flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors border';

  const stop = (handler?: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    handler?.();
  };

  // First-class TTS: any tab can pass `showListen` + `getListenText` and
  // inherit consistent audio playback without re-implementing the hook.
  const { ttsState, handleListen } = useTTSPlayer({
    getText: () => (getListenText ? getListenText() : ''),
    voice: listenVoice,
  });
  const listenEnabled = showListen && typeof getListenText === 'function';

  const price = item ? getContentPrice(item as any) : null;

  if (!showRead && !showWatch && !showView && !showShare && !listenEnabled && price === null) return null;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className || ''}`}>
      {price !== null && !isOwned && (
        <CodexBadge tone="amber">Q¢ {price}</CodexBadge>
      )}
      {showRead && (
        <button
          type="button"
          onClick={stop(onRead)}
          aria-label="Read"
          className={`${base} ${styles.primary}`}
        >
          <BookOpen className="h-3 w-3" />
          Read
        </button>
      )}
      {showWatch && (
        <button
          type="button"
          onClick={stop(onWatch)}
          aria-label="Watch"
          className={`${base} ${styles.primary}`}
        >
          <Play className="h-3 w-3" />
          Watch
        </button>
      )}
      {showView && (
        <button
          type="button"
          onClick={stop(onView)}
          aria-label="View"
          className={`${base} ${styles.secondary}`}
        >
          <Eye className="h-3 w-3" />
          View
        </button>
      )}
      {showShare && (
        <button
          type="button"
          onClick={stop(onShare)}
          aria-label="Share"
          className={`${base} ${styles.secondary}`}
        >
          <Share2 className="h-3 w-3" />
          Share
        </button>
      )}
      {listenEnabled && (
        <button
          type="button"
          onClick={stop(() => void handleListen())}
          aria-label="Listen"
          disabled={ttsState === 'loading'}
          className={`${base} ${
            ttsState === 'playing'
              ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200'
              : ttsState === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : styles.secondary
          }`}
        >
          {ttsState === 'loading' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : ttsState === 'playing' ? (
            <Square className="h-3 w-3" />
          ) : (
            <Headphones className="h-3 w-3" />
          )}
          {ttsState === 'playing' ? 'Stop' : ttsState === 'loading' ? '…' : ttsState === 'error' ? 'Error' : 'Listen'}
        </button>
      )}
    </div>
  );
}
