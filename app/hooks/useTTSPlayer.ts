"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TtsState = "idle" | "loading" | "playing" | "error";

function splitTextIntoChunks(text: string, maxChars = 900): string[] {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;

    if (current.length + sentence.length + 1 > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      // Hard-split sentences longer than maxChars
      if (sentence.length > maxChars) {
        let remaining = sentence;
        while (remaining.length > maxChars) {
          chunks.push(remaining.slice(0, maxChars).trim());
          remaining = remaining.slice(maxChars);
        }
        if (remaining.trim()) current = remaining.trim();
      } else {
        current = sentence;
      }
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export function useTTSPlayer(options: { getText: () => string; voice?: string }) {
  const [ttsState, setTtsState] = useState<TtsState>("idle");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioEndResolveRef = useRef<(() => void) | null>(null);
  const pendingFetchRef = useRef<Promise<Response> | null>(null);

  const revokeCurrent = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  const stopAll = useCallback(() => {
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    audioRef.current?.pause();
    audioRef.current = null;
    revokeCurrent();
    audioEndResolveRef.current?.();
    audioEndResolveRef.current = null;
  }, []);

  const playAudio = useCallback((url: string, voice: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      blobUrlRef.current = url;
      audioEndResolveRef.current = resolve;

      audio.onended = () => {
        audioEndResolveRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        audioEndResolveRef.current = null;
        reject(new Error("Audio playback error"));
      };

      setTtsState("playing");
      audio.play().catch(reject);
    });
  }, []);

  const fetchChunk = useCallback(
    (text: string, signal: AbortSignal): Promise<Response> => {
      return fetch("/api/skills/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: options.voice || "nova" }),
        signal,
      });
    },
    [options.voice]
  );

  const handleListen = useCallback(async () => {
    if (ttsState !== "idle") {
      stopAll();
      setTtsState("idle");
      return;
    }

    const text = options.getText().trim();
    if (!text) return;

    const chunks = splitTextIntoChunks(text);
    if (!chunks.length) return;

    stopRequestedRef.current = false;
    setTtsState("loading");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Pre-fetch the first chunk immediately
    let pendingFetch: Promise<Response> = fetchChunk(chunks[0], abortController.signal);
    pendingFetchRef.current = pendingFetch;

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (stopRequestedRef.current) break;

        // Await current chunk fetch
        const res = await pendingFetch;

        if (stopRequestedRef.current) break;
        if (!res.ok) {
          // Surface the response body so the user can see WHY the TTS
          // route failed (no provider configured, both providers down,
          // quota, etc.) instead of a bare HTTP status. Read once via
          // text() to avoid double-consuming the body.
          const detail = await res.text().catch(() => '');
          console.error(`[useTTSPlayer] /api/skills/tts ${res.status}: ${detail.slice(0, 400)}`);
          throw new Error(`TTS ${res.status}: ${detail.slice(0, 200)}`);
        }

        // Diagnostic — log which provider served the bytes + any
        // Cartesia fallthrough reason. Operator can DevTools the
        // network tab too but this surfaces it in console for the
        // common case where the operator just clicked Listen and
        // wants to know why the voice changed (or didn't).
        const provider = res.headers.get('X-TTS-Provider');
        const cartesiaErr = res.headers.get('X-TTS-Cartesia-Error');
        if (provider) {
          if (cartesiaErr) {
            console.warn(`[useTTSPlayer] served by ${provider}; Cartesia fell through: ${cartesiaErr}`);
          } else {
            console.info(`[useTTSPlayer] served by ${provider}`);
          }
        }

        const blob = await res.blob();
        if (stopRequestedRef.current) break;

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;

        // Kick off pre-fetch of next chunk while current plays
        if (i + 1 < chunks.length && !stopRequestedRef.current) {
          const nextAbort = new AbortController();
          abortControllerRef.current = nextAbort;
          pendingFetch = fetchChunk(chunks[i + 1], nextAbort.signal);
          pendingFetchRef.current = pendingFetch;
        }

        await playAudio(url, options.voice || "nova");
        revokeCurrent();

        if (stopRequestedRef.current) break;
      }

      if (!stopRequestedRef.current) {
        setTtsState("idle");
      }
    } catch (err) {
      revokeCurrent();
      abortControllerRef.current?.abort();
      if (!stopRequestedRef.current) {
        setTtsState("error");
        setTimeout(() => setTtsState((s) => (s === "error" ? "idle" : s)), 3000);
      }
    } finally {
      audioRef.current = null;
      audioEndResolveRef.current = null;
    }
  }, [ttsState, options, fetchChunk, playAudio, stopAll]);

  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return { ttsState, handleListen };
}
