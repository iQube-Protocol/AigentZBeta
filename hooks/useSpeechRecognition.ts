"use client";

/**
 * useSpeechRecognition — thin wrapper over the browser Web Speech API
 * (`SpeechRecognition` / `webkitSpeechRecognition`).
 *
 * Powers the MicButton affordance used in aigentMe compose modals and the
 * experience-guide / expGuide setup textareas. STT only — there is no TTS
 * here.
 *
 * Browser support: Chromium-family (Chrome, Edge, Brave) and Safari ≥14.1.
 * Firefox does NOT support the API; `isSupported` is false there and the
 * consumer should hide the mic button.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /** Fires once per finalised utterance, post any consumer-side transform. */
  onFinalResult?: (text: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    lang = "en-US",
    continuous = true,
    interimResults = true,
    onFinalResult,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalResultRef = useRef(onFinalResult);
  onFinalResultRef.current = onFinalResult;

  useEffect(() => {
    setIsSupported(getCtor() !== null);
  }, []);

  const ensureInstance = useCallback((): SpeechRecognitionInstance | null => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getCtor();
    if (!Ctor) return null;
    const instance = new Ctor();
    instance.lang = lang;
    instance.continuous = continuous;
    instance.interimResults = interimResults;
    instance.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          onFinalResultRef.current?.(text);
        } else {
          interim += text;
        }
      }
      setInterimTranscript(interim);
    };
    instance.onerror = (event) => {
      // 'aborted' and 'no-speech' are routine — don't surface them.
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(event.error);
      setIsListening(false);
    };
    instance.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };
    recognitionRef.current = instance;
    return instance;
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => {
    const instance = ensureInstance();
    if (!instance) {
      setError("speech-recognition-unsupported");
      return;
    }
    setError(null);
    try {
      instance.start();
      setIsListening(true);
    } catch {
      // start() throws if already started; treat as a no-op.
    }
  }, [ensureInstance]);

  const stop = useCallback(() => {
    const instance = recognitionRef.current;
    if (!instance) return;
    try {
      instance.stop();
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      const instance = recognitionRef.current;
      if (instance) {
        try {
          instance.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { isSupported, isListening, interimTranscript, error, start, stop, toggle };
}

/**
 * Best-effort transform of dictated text into an email-friendly form:
 *   "alice at example dot com" → "alice@example.com"
 *   "send to bob at acme dot io" → "send to bob@acme.io"
 *
 * Only touches well-formed runs (`<word> at <word> dot <tld>`); leaves the
 * rest of the sentence alone so non-email "at" / "dot" usages survive.
 */
export function transformEmailDictation(text: string): string {
  return text.replace(
    /\b([A-Za-z0-9._%+-]+)\s+at\s+([A-Za-z0-9-]+(?:\s+dot\s+[A-Za-z0-9-]+)+)\b/gi,
    (_match, local: string, domainRun: string) => {
      const domain = domainRun.replace(/\s+dot\s+/gi, ".");
      return `${local}@${domain}`;
    },
  );
}
