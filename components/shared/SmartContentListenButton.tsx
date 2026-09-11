'use client';

/**
 * SmartContentListenButton — the card-level "Listen" affordance, a sibling
 * to Share on every supported Qriptopian content card (Threshold Essays,
 * Papers, ordinary articles) and the full article reader.
 *
 * Presentational + wiring only — all playback coordination lives in
 * useSmartContentAudio() (services/smartcontent/smartContentAudioController.tsx),
 * the ONE shared controller. Multiple instances of this button across many
 * cards all read from the SAME context, so activating one automatically
 * reflects as inactive on every other — "only one article plays at a time"
 * is a property of the controller, not of this component.
 */

import { Headphones, Loader2, Square } from 'lucide-react';
import { useOptionalSmartContentAudio, type SmartContentListenItem } from '@/services/smartcontent/smartContentAudioController';

interface SmartContentListenButtonProps {
  item: SmartContentListenItem;
  /** Icon-only, matching the compact card action-row convention (e.g. ShareMenu's `compact` prop). */
  compact?: boolean;
  className?: string;
  /** When true, renders a visibly disabled affordance with a title explaining why (e.g. no canonical text available yet) rather than a working toggle. */
  disabledReason?: string;
}

export function SmartContentListenButton({ item, compact, className, disabledReason }: SmartContentListenButtonProps) {
  // Optional, not the throwing useSmartContentAudio(): this button is a
  // generic card-level control mounted from many hosts (Codex tabs, the
  // article reader, cross-cartridge embeds under app/(embed)/layout.tsx).
  // A host that hasn't mounted SmartContentAudioProvider must render an
  // inert control, never crash the whole page — see the 2026-08-23 embed
  // regression (a Papers card inside /triad/embed/codex/... threw
  // "useSmartContentAudio must be used within a SmartContentAudioProvider").
  const audio = useOptionalSmartContentAudio();
  if (!audio) {
    return (
      <span
        title={disabledReason ?? 'Listen is unavailable here'}
        aria-disabled="true"
        className={
          className ??
          (compact
            ? 'inline-flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-[11px] text-slate-600 shrink-0'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-600')
        }
      >
        <Headphones className="h-3.5 w-3.5" />
        {!compact && 'Listen'}
      </span>
    );
  }
  const { isActive, status, toggle } = audio;
  const active = isActive(item.id);
  const isBusy = active && (status === 'resolving' || status === 'loading');
  const isPlaying = active && (status === 'playing' || status === 'paused');

  if (disabledReason) {
    return (
      <span
        title={disabledReason}
        aria-disabled="true"
        className={
          className ??
          (compact
            ? 'inline-flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-[11px] text-slate-600 shrink-0'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-600')
        }
      >
        <Headphones className="h-3.5 w-3.5" />
        {!compact && 'Listen'}
      </span>
    );
  }

  const label = isPlaying ? `Stop listening to ${item.title}` : `Listen to ${item.title}`;

  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      disabled={isBusy}
      aria-pressed={isPlaying}
      aria-label={label}
      title={label}
      className={
        className ??
        (compact
          ? `inline-flex min-h-[28px] min-w-[28px] items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[11px] shrink-0 transition ${
              isPlaying
                ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300'
                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            } disabled:opacity-50`
          : `inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
              isPlaying
                ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            } disabled:opacity-50`)
      }
    >
      {isBusy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <Square className="h-3.5 w-3.5" />
      ) : (
        <Headphones className="h-3.5 w-3.5" />
      )}
      {!compact && (isBusy ? '…' : isPlaying ? 'Stop' : 'Listen')}
    </button>
  );
}

export default SmartContentListenButton;
