"use client";

/**
 * useAGUIActionBridge
 *
 * Subscribes to /api/a2a/agui/persona-stream?personaId=<id> and maps
 * incoming thin-client actions to SmartTriadProvider state changes.
 *
 * Mount this inside SmartTriadSurfaces (which already has access to
 * SmartTriad actions via useSmartTriad).
 */

import { useEffect } from "react";

type BridgeActions = {
  openWallet: (mode?: "compact" | "full", tab?: string) => void;
  closeWallet: () => void;
  setActiveDrawer: (drawer: string | null) => void;
};

export function useAGUIActionBridge(
  personaId: string | undefined,
  actions: BridgeActions
) {
  useEffect(() => {
    if (!personaId) return;

    const url = `/api/a2a/agui/persona-stream?personaId=${encodeURIComponent(personaId)}`;
    const es = new EventSource(url);

    es.addEventListener("ACTION", (raw) => {
      try {
        const action = JSON.parse((raw as MessageEvent).data) as {
          type: string;
          payload?: Record<string, unknown>;
        };

        switch (action.type) {
          case "OPEN_WALLET": {
            const mode =
              (action.payload?.mode as "compact" | "full") ?? "full";
            const tab = (action.payload?.tab as string) ?? "wallet";
            actions.openWallet(mode, tab as any);
            break;
          }
          case "CLOSE_WALLET":
            actions.closeWallet();
            break;
          case "OPEN_DRAWER": {
            const drawerId = (action.payload?.drawerId as string) ?? null;
            if (drawerId) actions.setActiveDrawer(drawerId);
            break;
          }
          case "CLOSE_DRAWER":
            actions.setActiveDrawer(null);
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed events
      }
    });

    return () => es.close();
  }, [personaId, actions.openWallet, actions.closeWallet, actions.setActiveDrawer]);
}
