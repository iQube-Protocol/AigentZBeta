"use client";

/**
 * AG-UI Provider for CopilotKit v1.50
 * 
 * Wraps the application with CopilotKit v2 provider and AG-UI state management.
 * Enables ultra-thin clients to connect via SSE for server-authoritative UI.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { HttpAgent } from "@ag-ui/client";

interface AGUIProviderProps {
  children: React.ReactNode;
  runtimeUrl?: string;
}

export function AGUIProvider({ children, runtimeUrl = "/api/copilotkit" }: AGUIProviderProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const devAgents = useMemo(() => {
    return {
      default: new HttpAgent({
        agentId: "default",
        description: "Local dev agent",
        url: "/api/agents/execute",
      }),
    } as Record<string, any>;
  }, []);

  useEffect(() => {
    // Generate or retrieve session ID
    let sid = sessionStorage.getItem('agui_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('agui_session_id', sid);
    }
    setSessionId(sid);
  }, []);

  return (
    <CopilotKit runtimeUrl={runtimeUrl} agents__unsafe_dev_only={devAgents}>
      {children}
    </CopilotKit>
  );
}
