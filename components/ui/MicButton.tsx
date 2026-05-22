"use client";

/**
 * MicButton — voice-to-text affordance for prompt inputs and free-form
 * textareas. Wraps useSpeechRecognition: click toggles listening, each
 * finalised utterance is appended to the parent value via `onTranscript`.
 *
 * If the browser does not support the Web Speech API (Firefox), the
 * button is not rendered.
 *
 * Used by:
 *   - aigentMe compose modals (Gmail, Doc, Sheet, Slides, Calendar, Marketa)
 *   - expGuide / experience-strategy free-form textareas
 */

import React, { useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface MicButtonProps {
  /** Receives each finalised utterance (post-transform). */
  onTranscript: (text: string) => void;
  /** Optional post-process applied to each utterance before onTranscript. */
  transform?: (text: string) => string;
  disabled?: boolean;
  size?: "sm" | "md";
  theme?: "light" | "dark";
  className?: string;
  /** Accessible label override. */
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

  const { isSupported, isListening, toggle, error } = useSpeechRecognition({
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

  const computedTitle =
    title ??
    (error
      ? `Voice input error: ${error}`
      : isListening
        ? "Stop listening"
        : "Dictate (speech-to-text)");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={computedTitle}
      aria-label={computedTitle}
      aria-pressed={isListening}
      className={`rounded-md ${pad} transition disabled:opacity-50 disabled:cursor-not-allowed ${
        isListening ? active : idle
      } ${className ?? ""}`}
    >
      {isListening ? <MicOff className={icon} /> : <Mic className={icon} />}
    </button>
  );
}
