"use client";

/**
 * useSpeechSynthesis — browser-native TTS for copilot replies.
 *
 * Wraps window.speechSynthesis so callers don't have to repeat the
 * SpeechSynthesisUtterance setup. Used by the Listen icon next to
 * the trust/reliability dots in SmartTriadCopilotLayer to speak the
 * latest assistant message aloud.
 *
 * Posture
 * -------
 *   - SSR-safe: isSupported is false on the server, all methods
 *     no-op until window.speechSynthesis exists.
 *   - Speaking is exclusive: calling speak() while isSpeaking is
 *     true cancels the prior utterance first, so the listener
 *     doesn't end up with two voices overlapping.
 *   - Voices are loaded async on most browsers (Chrome/Edge fire
 *     `voiceschanged` later). The hook re-reads voices on that
 *     event so a preferred voice is picked up the second time
 *     speak() runs even if the first call landed before voices
 *     populated.
 *   - On unmount, cancel any in-flight utterance so a tab switch
 *     doesn't leave the speech engine talking to an empty tab.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSpeechSynthesisOptions {
  /** Preferred voice name. Falls back to system default. */
  voiceName?: string;
  /** Speaking rate. 1 = normal; <1 slower; >1 faster. */
  rate?: number;
  /** Pitch. 1 = normal; range 0–2. */
  pitch?: number;
}

export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  cancel: () => void;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const { voiceName, rate = 1, pitch = 1 } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setIsSupported(true);
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      // Cancel anything in flight so the new utterance starts clean.
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.rate = rate;
      utterance.pitch = pitch;
      if (voiceName) {
        const match = voicesRef.current.find((v) => v.name === voiceName);
        if (match) utterance.voice = match;
      }
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [voiceName, rate, pitch],
  );

  return { isSupported, isSpeaking, speak, cancel };
}
