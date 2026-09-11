"use client";

/**
 * Constitutional Representation System — the client provider + hook (CFS-021).
 *
 * Holds the active interpretation, injects its CSS custom properties at a root
 * scope, and exposes `useRepresentation()`. Components read ROLES through this
 * (or `var(--rep-…)`) — they NEVER hardcode a look. Swapping the interpretation
 * reskins the whole subtree coherently, with no component change. That is the
 * proof CFS-021 §3.1 requires: "the system accommodates many interpretations."
 *
 * SSR-safe: the active interpretation is plain state (default = CCF); the CSS
 * vars are computed purely from it in render — nothing reads `window`.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Interpretation, RepresentationRole } from "@/types/representation";
import { resolveRole, emitCssVariables, surfaceStyle } from "@/services/representation/representationResolver";
import {
  INTERPRETATIONS,
  getInterpretation,
  DEFAULT_INTERPRETATION_ID,
} from "@/services/representation/interpretations";

interface RepresentationContextValue {
  /** The active interpretation. */
  interpretation: Interpretation;
  /** Switch interpretation (by id or object) — reskins the scope. */
  setInterpretation: (next: string | Interpretation) => void;
  /** Resolve a semantic role to its concrete value under the active interpretation. */
  role: (name: RepresentationRole) => string;
  /** Every registered interpretation (for switchers). */
  interpretations: Interpretation[];
}

const RepresentationContext = createContext<RepresentationContextValue | null>(null);

export interface RepresentationProviderProps {
  /** Initial interpretation id — defaults to Constitutional Civic Futurism (v1). */
  defaultInterpretationId?: string;
  /** When true, inject the CSS variables on the wrapping element (default true).
   * Set false to consume roles purely via the hook without a style scope. */
  injectCssVars?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Provider. Wraps a subtree, injects the active interpretation's CSS variables
 * at the wrapping `<div>` scope, and serves the hook.
 */
export function RepresentationProvider({
  defaultInterpretationId = DEFAULT_INTERPRETATION_ID,
  injectCssVars = true,
  className,
  children,
}: RepresentationProviderProps) {
  const [interpretation, setInterpretationState] = useState<Interpretation>(() =>
    getInterpretation(defaultInterpretationId),
  );

  const setInterpretation = useCallback((next: string | Interpretation) => {
    setInterpretationState(typeof next === "string" ? getInterpretation(next) : next);
  }, []);

  const role = useCallback(
    (name: RepresentationRole) => resolveRole(name, interpretation),
    [interpretation],
  );

  const value = useMemo<RepresentationContextValue>(
    () => ({ interpretation, setInterpretation, role, interpretations: INTERPRETATIONS }),
    [interpretation, setInterpretation, role],
  );

  const style = useMemo(
    () => (injectCssVars ? (emitCssVariables(interpretation) as React.CSSProperties) : undefined),
    [interpretation, injectCssVars],
  );

  return (
    <RepresentationContext.Provider value={value}>
      <div className={className} style={style} data-interpretation={interpretation.id}>
        {children}
      </div>
    </RepresentationContext.Provider>
  );
}

/** Consume the active interpretation, the role resolver, and the switcher. */
export function useRepresentation(): RepresentationContextValue {
  const ctx = useContext(RepresentationContext);
  if (!ctx) {
    throw new Error("useRepresentation must be used within a <RepresentationProvider>.");
  }
  return ctx;
}

/**
 * The composed surface-MATERIAL style for a panel under the ACTIVE interpretation
 * (CFS-021 §3; `inv.representation.129`). Spread it onto a panel `<div style>` so
 * the SAME markup renders an opaque matte panel under a flat interpretation
 * (Constitutional Civic Futurism, High-Contrast) and a liquid-glass panel under
 * AgentiQ Liquid Glass — material flows through roles, never literals. Components
 * MUST NOT hand-assemble glass; they consume this. SSR-safe (pure CSS values).
 */
export function useSurfaceStyle(): React.CSSProperties {
  const { interpretation } = useRepresentation();
  return useMemo(() => surfaceStyle(interpretation) as React.CSSProperties, [interpretation]);
}
