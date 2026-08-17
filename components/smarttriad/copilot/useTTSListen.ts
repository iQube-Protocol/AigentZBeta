"use client";

/**
 * useTTSListen — shared "read the latest assistant reply aloud" state
 * (WPA-3 finishing pass, operator brief 2026-08-17, item 2).
 *
 * Extracted from SmartTriadCopilotLayer.tsx's inline TTS wiring so BOTH the
 * main/embedded copilot (SmartTriadCopilotLayer) and the real floating
 * copilot (app/components/codex/CodexCopilotLayer.tsx) share the EXACT same
 * hook (useTTSPlayer — Cartesia Sonic primary, OpenAI tts-1 fallback, via
 * /api/skills/tts), text extraction, and toggle behaviour — never a second
 * TTS subsystem.
 *
 * Returned as a hook (not folded entirely into the button component)
 * because the busy-pulse convention (CLAUDE.md "metaMe Client Protocol
 * Primitive — R/T scoring dots + busy pulse") requires `ttsState ===
 * 'loading'` to feed the SAME R/T dots pulse as the chat round-trip
 * (`isProcessing`) — a caller-level concern, not something the button can
 * own privately.
 *
 * Text normalization: the most recent assistant message's RAW string
 * content — no markdown stripping; useTTSPlayer's splitTextIntoChunks is
 * the only normalization that ever existed here. A message whose `content`
 * is not a plain string (e.g. a rendered React node from a custom bypass
 * response) is treated as "nothing to read yet" — the same rule
 * SmartTriadCopilotLayer always used.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTTSPlayer } from "@/app/hooks/useTTSPlayer";

export interface TTSListenMessage {
  role: string;
  content: unknown;
}

export function useTTSListen(messages: TTSListenMessage[], voice = "nova") {
  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && typeof messages[i].content === "string") {
        return messages[i].content as string;
      }
    }
    return "";
  }, [messages]);

  const lastAssistantMessageRef = useRef(lastAssistantMessage);
  useEffect(() => {
    lastAssistantMessageRef.current = lastAssistantMessage;
  }, [lastAssistantMessage]);

  const tts = useTTSPlayer({
    getText: () => lastAssistantMessageRef.current,
    voice,
  });

  const handleListenToggle = useCallback(() => {
    if (!lastAssistantMessage) return;
    void tts.handleListen();
  }, [tts, lastAssistantMessage]);

  return {
    ttsState: tts.ttsState,
    isSpeaking: tts.ttsState === "playing",
    isLoading: tts.ttsState === "loading",
    hasContent: Boolean(lastAssistantMessage),
    handleListenToggle,
  };
}
