"use client";

/**
 * useCopilotDrawer Hook
 * 
 * React hook for Copilot-driven drawer management.
 * Handles session creation, prompt processing, and drawer updates.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { DrawerSet, Device } from "@/types/smartDrawer";

// =============================================================================
// TYPES
// =============================================================================

export interface UseCopilotDrawerOptions {
  /** Drawer set ID */
  drawerSetId: string;
  
  /** App context */
  appId: string;
  tenantId: string;
  personaId: string;
  
  /** Device */
  device: Device;
  
  /** Auto-create session on mount */
  autoCreateSession?: boolean;
  
  /** Welcome message */
  welcomeMessage?: string;
  
  /** Callback when drawer is modified */
  onDrawerModified?: (drawerSet: DrawerSet) => void;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  changes?: string[];
}

export interface UseCopilotDrawerReturn {
  /** Session ID */
  sessionId: string | null;
  
  /** Messages */
  messages: CopilotMessage[];
  
  /** Is loading */
  loading: boolean;
  
  /** Error */
  error: string | null;
  
  /** Is session active */
  isActive: boolean;
  
  /** Send a prompt */
  sendPrompt: (prompt: string) => Promise<void>;
  
  /** Create a new session */
  createSession: () => Promise<void>;
  
  /** End the session */
  endSession: () => void;
  
  /** Clear messages */
  clearMessages: () => void;
  
  /** Last compilation result */
  lastCompilation: {
    changes: Array<{ type: string; target: string; description: string }>;
    confidence: number;
    warnings: string[];
  } | null;
  
  /** Merged drawer set (after modifications) */
  mergedDrawerSet: any | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useCopilotDrawer(options: UseCopilotDrawerOptions): UseCopilotDrawerReturn {
  const {
    drawerSetId,
    appId,
    tenantId,
    personaId,
    device,
    autoCreateSession = true,
    welcomeMessage,
    onDrawerModified,
  } = options;

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [lastCompilation, setLastCompilation] = useState<UseCopilotDrawerReturn["lastCompilation"]>(null);
  const [mergedDrawerSet, setMergedDrawerSet] = useState<any | null>(null);

  const onDrawerModifiedRef = useRef(onDrawerModified);
  onDrawerModifiedRef.current = onDrawerModified;

  // ---------------------------------------------------------------------------
  // CREATE SESSION
  // ---------------------------------------------------------------------------
  
  const createSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/copilot/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawerSetId,
          appId,
          tenantId,
          personaId,
          welcomeMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      setSessionId(data.session.id);
      setIsActive(data.session.isActive);
      
      // Set initial messages
      setMessages(
        data.session.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  }, [drawerSetId, appId, tenantId, personaId, welcomeMessage]);

  // ---------------------------------------------------------------------------
  // SEND PROMPT
  // ---------------------------------------------------------------------------
  
  const sendPrompt = useCallback(async (prompt: string) => {
    if (!sessionId) {
      setError("No active session");
      return;
    }

    setLoading(true);
    setError(null);

    // Optimistically add user message
    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/copilot/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          prompt,
          device,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? `Request failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
        changes: data.compilation?.changes?.map((c: any) => c.description),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update compilation result
      if (data.compilation) {
        setLastCompilation({
          changes: data.compilation.changes,
          confidence: data.compilation.confidence,
          warnings: data.compilation.warnings,
        });
      }

      // Update merged drawer set
      if (data.mergedDrawerSet) {
        setMergedDrawerSet(data.mergedDrawerSet);
        onDrawerModifiedRef.current?.(data.mergedDrawerSet);
      }

      // Update session status
      setIsActive(data.session.isActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send prompt");
      
      // Add error message
      const errorMessage: CopilotMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, device]);

  // ---------------------------------------------------------------------------
  // END SESSION
  // ---------------------------------------------------------------------------
  
  const endSession = useCallback(() => {
    setSessionId(null);
    setIsActive(false);
    setMessages([]);
    setLastCompilation(null);
    setMergedDrawerSet(null);
  }, []);

  // ---------------------------------------------------------------------------
  // CLEAR MESSAGES
  // ---------------------------------------------------------------------------
  
  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastCompilation(null);
  }, []);

  // ---------------------------------------------------------------------------
  // AUTO-CREATE SESSION
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    if (autoCreateSession && !sessionId) {
      createSession();
    }
  }, [autoCreateSession, sessionId, createSession]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  
  return {
    sessionId,
    messages,
    loading,
    error,
    isActive,
    sendPrompt,
    createSession,
    endSession,
    clearMessages,
    lastCompilation,
    mergedDrawerSet,
  };
}

export default useCopilotDrawer;
