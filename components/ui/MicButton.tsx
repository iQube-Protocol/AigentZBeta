"use client";

/**
 * MicButton — voice-to-text affordance for prompt inputs and free-form
 * textareas. Records a short clip with MediaRecorder and POSTs it to
 * /api/skills/stt for Whisper transcription. Each finished utterance is
 * appended to the parent value via `onTranscript`.
 *
 * If the browser does not support MediaRecorder / getUserMedia, the
 * button is not rendered.
 *
 * Used by:
 *   - aigentMe compose modals (Gmail, Doc, Sheet, Slides, Calendar, Marketa)
 *   - expGuide / experience-strategy free-form textareas
 */

import React, { useCallback } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface MicButtonProps {
  /** Receives the transcribed utterance (post-transform). */
  onTranscript: (text: string) => void;
  /** Optional post-process applied to the transcript before onTranscript. */
  transform?: (text: string) => string;
  disabled?: boolean;
  size?: "sm" | "md";
  theme?: "light" | "dark";
  className?: string;
  title?: string;
}

export function MicButton({
  onTranscript,
  transform,
  disabled,
  size = "md",
  theme = "dark",
  className,
  title,
}: MicButtonProps) {
  const handleFinal = useCallback(
    (text: string) => {
      const processed = transform ? transform(text) : text;
      const trimmed = processed.trim();
      if (trimmed) onTranscript(trimmed);
    },
    [onTranscript, transform],
  );

  const { isSupported, isListening, isProcessing, toggle, error } = useSpeechRecognition({
    onFinalResult: handleFinal,
  });

  if (!isSupported) return null;

  const isDark = theme === "dark";
  const pad = size === "sm" ? "p-1.5" : "p-2";
  const icon = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  const idle = isDark
    ? "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100 bg-slate-800/40"
    : "border border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900 bg-white";
  const active = "border border-red-500/60 text-red-400 bg-red-500/10 animate-pulse";
  const processing = isDark
    ? "border border-slate-700 text-violet-300 bg-slate-800/40"
    : "border border-slate-300 text-violet-600 bg-white";

  const computedTitle =
    title ??
    (error === "microphone-permission-denied"
      ? "Microphone permission denied — enable it in browser settings"
      : error === "no-microphone-found"
        ? "No microphone detected"
        : error
          ? `Voice input error: ${error}`
          : isProcessing
            ? "Transcribing…"
            : isListening
              ? "Stop recording"
              : "Dictate (speech-to-text)");

  const classes = isListening ? active : isProcessing ? processing : idle;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isProcessing}
      title={computedTitle}
      aria-label={computedTitle}
      aria-pressed={isListening}
      aria-busy={isProcessing}
      className={`rounded-md ${pad} transition disabled:opacity-50 disabled:cursor-not-allowed ${classes} ${className ?? ""}`}
    >
      {isProcessing ? (
        <Loader2 className={`${icon} animate-spin`} />
      ) : isListening ? (
        <MicOff className={icon} />
      ) : (
        <Mic className={icon} />
      )}
    </button>
  );
}
