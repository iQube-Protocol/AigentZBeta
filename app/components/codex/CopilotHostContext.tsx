"use client";

/**
 * CopilotHostContext — floating-copilot dedupe seam (SmartTriad Phase 1).
 *
 * Many tab components self-mount a specialized floating CodexCopilotLayer
 * (AgentiqCartridgeTab, KnytTab, TerraTab, CartridgeRuntimeTemplate, …). The
 * cartridge shell (CodexPanelDynamic) now ALSO mounts a generic floating
 * copilot on every cartridge so the launcher is always present. To avoid two
 * floating buttons on tabs that bring their own richer copilot:
 *
 *   - tab-level floating layers REGISTER here on mount (hostRole 'tab', the
 *     default — no changes needed at their call sites),
 *   - the shell's generic layer (hostRole 'panel') SUBSCRIBES and yields
 *     (renders nothing) while any tab-level host is registered.
 *
 * The specialized tab copilot always wins; the generic shell copilot fills
 * every gap. Absent a provider (copilot layers used outside the cartridge
 * shell), the default no-op context keeps behaviour unchanged.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface CopilotHostContextValue {
  /** Number of tab-level floating copilots currently mounted. */
  tabHosts: number;
  /** Register a tab-level host; returns the unregister cleanup. */
  registerTabHost: () => () => void;
}

const CopilotHostContext = createContext<CopilotHostContextValue>({
  tabHosts: 0,
  registerTabHost: () => () => {},
});

export function CopilotHostProvider({ children }: { children: React.ReactNode }) {
  const [tabHosts, setTabHosts] = useState(0);
  const registerTabHost = useCallback(() => {
    setTabHosts((n) => n + 1);
    return () => setTabHosts((n) => Math.max(0, n - 1));
  }, []);
  const value = useMemo(() => ({ tabHosts, registerTabHost }), [tabHosts, registerTabHost]);
  return <CopilotHostContext.Provider value={value}>{children}</CopilotHostContext.Provider>;
}

export function useCopilotHost(): CopilotHostContextValue {
  return useContext(CopilotHostContext);
}
