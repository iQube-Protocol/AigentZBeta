"use client";

/**
 * useSpeechRecognition — browser-agnostic STT via MediaRecorder + Whisper.
 *
 * Earlier iterations of this hook wrapped the Web Speech API
 * (`webkitSpeechRecognition`). That works in Chrome/Edge/Mac Safari but
 * fails on Brave (Shields block Google's STT servers) and iOS Safari is
 * unreliable. We now record a clip with MediaRecorder and POST it to
 * /api/skills/stt for Whisper transcription — works in every browser
 * that exposes `getUserMedia` and `MediaRecorder`.
 *
 * Powers the MicButton affordance used in aigentMe compose modals and
 * the experience-guide / expGuide setup textareas. STT only — no TTS.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";

export interface UseSpeechRecognitionOptions {
  lang?: string;
  /** Fires once per recording with the full transcript (post any consumer-side transform). */
  onFinalResult?: (text: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  /** Always empty — kept for API compatibility; MediaRecorder has no interim transcript. */
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { lang, onFinalResult } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const onFinalResultRef = useRef(onFinalResult);
  onFinalResultRef.current = onFinalResult;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    setIsSupported(supported);
  }, []);

  const cleanupStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setIsProcessing(true);
      try {
        const form = new FormData();
        form.append("audio", blob, "clip");
        if (lang) form.append("lang", lang);
        const response = await personaFetch("/api/skills/stt", {
          method: "POST",
          body: form,
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.detail || detail?.error || `stt-${response.status}`);
        }
        const data = (await response.json()) as { text?: string };
        const text = (data.text ?? "").trim();
        if (text) onFinalResultRef.current?.(text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [lang],
  );

  const start = useCallback(async () => {
    if (isListening || isProcessing) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("mediarecorder-unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        cleanupStream();
        setIsListening(false);
        if (blob.size > 0) {
          void transcribe(blob);
        }
      };
      recorder.start();
      setIsListening(true);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      const msg =
        name === "NotAllowedError"
          ? "microphone-permission-denied"
          : name === "NotFoundError"
            ? "no-microphone-found"
            : err instanceof Error
              ? err.message
              : String(err);
      setError(msg);
      cleanupStream();
      setIsListening(false);
    }
  }, [isListening, isProcessing, transcribe, cleanupStream]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        cleanupStream();
        setIsListening(false);
      }
    }
  }, [cleanupStream]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else void start();
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  return {
    isSupported,
    isListening,
    isProcessing,
    interimTranscript: "",
    error,
    start,
    stop,
    toggle,
  };
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
