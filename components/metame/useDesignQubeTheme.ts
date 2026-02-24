"use client";

import { useEffect } from "react";
import type { DesignQubeConstraints, DesignQubeTokens, DesignQubeThemeMode } from "../../types/designQube";

const CSS_MAP: Record<string, string> = {
  background: "--background",
  foreground: "--foreground",
  surface: "--card",
  border: "--border",
  accent: "--accent",
  primary: "--primary",
  muted: "--muted",
  secondary: "--secondary",
};

function applyTokensToRoot(tokens: Record<string, any> | undefined) {
  if (!tokens || typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries(CSS_MAP).forEach(([key, cssVar]) => {
    const value = tokens?.color?.[key];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
}

function applyGlassConstraints(constraints?: DesignQubeConstraints) {
  if (!constraints || typeof document === "undefined") return;
  const glass = constraints.material?.glass;
  if (!glass) return;
  const root = document.documentElement;
  if (glass.blurPx !== undefined) {
    root.style.setProperty("--glass-blur", `${glass.blurPx}px`);
  }
  if (glass.alpha !== undefined) {
    root.style.setProperty("--glass-alpha", String(glass.alpha));
  }
  if (glass.borderAlpha !== undefined) {
    root.style.setProperty("--glass-border-alpha", String(glass.borderAlpha));
  }
}

function resolveThemeTokens(tokens?: DesignQubeTokens, theme?: DesignQubeThemeMode) {
  if (!tokens?.themes) return undefined;
  if (theme === "light") {
    return (tokens.themes.light as any)?.metame ?? tokens.themes.light;
  }
  return (tokens.themes.dark as any)?.knyt ?? tokens.themes.dark;
}

export function useDesignQubeTheme(tokens?: DesignQubeTokens, constraints?: DesignQubeConstraints, theme: DesignQubeThemeMode = "dark") {
  useEffect(() => {
    const themeTokens = resolveThemeTokens(tokens, theme);
    applyTokensToRoot(themeTokens);
    applyGlassConstraints(constraints);
  }, [tokens, constraints, theme]);
}
