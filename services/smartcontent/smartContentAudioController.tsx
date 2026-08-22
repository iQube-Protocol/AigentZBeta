'use client';

/**
 * SmartContentAudioController — the ONE shared "Listen" (text-to-speech)
 * coordinator for SmartContent, invoked identically from Qriptopian content
 * cards (Threshold Essays, Papers, ordinary articles), their Share-sibling
 * action row, and the full article reader.
 *
 * Per CLAUDE.md's Core Principle (Extend, Don't Duplicate) and this
 * increment's explicit constraint ("do not implement three separate TTS
 * systems"): this is composition, not a new audio engine. The actual
 * synthesis/playback primitive is the ALREADY-existing `useTTSPlayer`
 * (app/hooks/useTTSPlayer.ts — Cartesia Sonic primary, OpenAI tts-1
 * fallback, via /api/skills/tts), the same engine `ListenButton`
 * (components/shared/ListenButton.tsx) and the floating copilot's
 * `useTTSListen` already use. What was missing — and what this module adds
 * — is a SINGLE SHARED INSTANCE of that engine that many independent card
 * components can all address, so "only one article plays at a time" and
 * "tapping another item's Listen stops/switches cleanly" hold across the
 * whole surface, not just within one card's own local state.
 *
 * Mounted once, at app/(shell)/layout.tsx (sibling of the existing
 * SmartContentActionProvider) — high enough in the tree that playback
 * survives navigating between the Codex tabs list and the full article
 * reader within the same app session, and low enough that every Qriptopian
 * surface under the shell can reach it via `useSmartContentAudio()`.
 *
 * Text resolution is the CALLER's job (`item.getText`) — this controller
 * only coordinates WHICH item is active and owns the single audio engine
 * instance. Callers resolve the canonical `modalities.read.text` /
 * `articleBody` field for their own data shape and pass it through
 * `buildSpeechScript` (services/smartcontent/readableTextForSpeech.ts) so
 * every surface sanitizes Markdown/HTML the same way before it reaches the
 * TTS engine.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTTSPlayer } from '@/app/hooks/useTTSPlayer';
import { Headphones, Pause, Play, Square, X } from 'lucide-react';

export type SmartContentListenStatus = 'idle' | 'resolving' | 'loading' | 'playing' | 'paused' | 'error';

export interface SmartContentListenItem {
  /** Stable id — used to detect "same item" (toggle) vs "different item" (switch). */
  id: string;
  /** Spoken first, per the "title/subtitle context at the beginning" requirement. */
  title: string;
  /**
   * Returns the FULLY PREPARED speech script (title + sanitized body — see
   * `buildSpeechScript`). May be async since a card that only holds an
   * excerpt needs to fetch the canonical body first; the controller shows
   * `status: 'resolving'` for the duration of this call.
   */
  getText: () => string | Promise<string>;
}

interface SmartContentAudioContextValue {
  activeItemId: string | null;
  activeTitle: string | null;
  status: SmartContentListenStatus;
  isActive: (id: string) => boolean;
  /** Same item + already active -> stop. Different item (or idle) -> switch and start. */
  toggle: (item: SmartContentListenItem) => void;
  stop: () => void;
  /** True in-place pause/resume for whichever item is currently active — used by the persistent mini-bar. No-op if nothing is playing/paused. */
  pauseOrResume: () => void;
}

const SmartContentAudioContext = createContext<SmartContentAudioContextValue | null>(null);

export function useSmartContentAudio(): SmartContentAudioContextValue {
  const ctx = useContext(SmartContentAudioContext);
  if (!ctx) {
    throw new Error('useSmartContentAudio must be used within a SmartContentAudioProvider');
  }
  return ctx;
}

/** Never throws outside a Provider — surfaces that may render before/without
 *  the shell (e.g. isolated tests) can call this and get a safe no-op. */
export function useOptionalSmartContentAudio(): SmartContentAudioContextValue | null {
  return useContext(SmartContentAudioContext);
}

export function SmartContentAudioProvider({ children }: { children: React.ReactNode }) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);

  // The engine always reads from this ref rather than a piece of React
  // state — text for the CURRENT item is only ever known at the moment
  // `play()` is called (after resolution), never ahead of time, so there is
  // nothing for `getText` to read reactively. It exists solely to satisfy
  // useTTSPlayer's synchronous-getText contract for its own internal
  // `handleListen` convenience method, which this controller does not use
  // (it calls `play`/`stop` directly — see header note in useTTSPlayer.ts).
  const currentTextRef = useRef<string>('');
  const tts = useTTSPlayer({ getText: () => currentTextRef.current });

  // Monotonic request counter — guards against a slow text-resolution
  // promise resolving AFTER the user has already switched to (or stopped)
  // a different item. Without this, tapping Item B then Item A in quick
  // succession while B's text is still resolving could play B's audio
  // after A was already selected.
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    requestIdRef.current += 1; // invalidate any in-flight resolution
    tts.stop();
    setActiveItemId(null);
    setActiveTitle(null);
    setResolving(false);
    setResolveError(false);
  }, [tts]);

  const pauseOrResume = useCallback(() => {
    if (tts.ttsState === 'playing') {
      tts.pause();
    } else if (tts.ttsState === 'paused') {
      tts.resume();
    }
  }, [tts]);

  const toggle = useCallback(
    (item: SmartContentListenItem) => {
      const isSameItem = activeItemId === item.id;

      if (isSameItem && tts.ttsState !== 'idle') {
        // Already active for this item (loading, playing, or paused) — a
        // card's own Listen button is a simple play/stop toggle; true
        // pause/resume lives on the persistent mini-bar (`pauseOrResume`).
        stop();
        return;
      }

      // Either a different item, or the same item restarting from idle —
      // either way, stop whatever the engine is currently doing first so
      // exactly one item is ever in flight.
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      tts.stop();

      setActiveItemId(item.id);
      setActiveTitle(item.title);
      setResolving(true);
      setResolveError(false);

      void (async () => {
        let text: string;
        try {
          text = await Promise.resolve(item.getText());
        } catch {
          if (requestIdRef.current !== requestId) return; // superseded
          setResolving(false);
          setResolveError(true);
          return;
        }
        if (requestIdRef.current !== requestId) return; // superseded while resolving
        setResolving(false);
        if (!text.trim()) {
          setResolveError(true);
          return;
        }
        currentTextRef.current = text;
        await tts.play(text);
      })();
    },
    [activeItemId, tts, stop],
  );

  const isActive = useCallback((id: string) => activeItemId === id, [activeItemId]);

  const status: SmartContentListenStatus = resolveError
    ? 'error'
    : resolving
      ? 'resolving'
      : activeItemId
        ? (tts.ttsState as SmartContentListenStatus)
        : 'idle';

  const value = useMemo<SmartContentAudioContextValue>(
    () => ({ activeItemId, activeTitle, status, isActive, toggle, stop, pauseOrResume }),
    [activeItemId, activeTitle, status, isActive, toggle, stop, pauseOrResume],
  );

  return (
    <SmartContentAudioContext.Provider value={value}>
      {children}
      <SmartContentAudioBar activeTitle={activeTitle} status={status} onToggle={pauseOrResume} onStop={stop} />
    </SmartContentAudioContext.Provider>
  );
}

/**
 * Compact, persistent, mobile-first playback affordance — deliberately NOT
 * a desktop-style media player (no scrubber, no volume slider, no queue
 * UI). Shows only while something is active; a fixed bar at the bottom of
 * the viewport so it stays reachable while the visitor scrolls the
 * Codex/feed, per the mobile-first requirement.
 */
function SmartContentAudioBar({
  activeTitle,
  status,
  onToggle,
  onStop,
}: {
  activeTitle: string | null;
  status: SmartContentListenStatus;
  onToggle: () => void;
  onStop: () => void;
}) {
  if (status === 'idle' || !activeTitle) return null;

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isBusy = status === 'loading' || status === 'resolving';

  const statusLabel =
    status === 'error'
      ? 'Could not read this aloud'
      : status === 'resolving'
        ? 'Preparing…'
        : status === 'loading'
          ? 'Loading voice…'
          : isPaused
            ? 'Paused'
            : 'Listening';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[70] flex items-center gap-3 border-t border-white/10 bg-slate-950/95 px-3 py-2.5 backdrop-blur-md sm:bottom-3 sm:left-1/2 sm:right-auto sm:w-[min(28rem,calc(100vw-1.5rem))] sm:-translate-x-1/2 sm:rounded-full sm:border sm:px-4 sm:shadow-lg sm:shadow-black/40"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <Headphones className="h-4 w-4 shrink-0 text-fuchsia-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">{activeTitle}</p>
        <p className="text-[10px] text-slate-400">{statusLabel}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={isBusy || status === 'error'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        aria-pressed={isPlaying}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop listening"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-label="Dismiss"
        title="Dismiss"
        className="hidden shrink-0 items-center justify-center text-slate-500 hover:text-slate-300 sm:flex"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
