"use client";

/**
 * PersonalCartridgeTab — renders a personal (wizard-created) cartridge's
 * configured tabs via the existing TAB_TEMPLATES framework.
 *
 * Surfaces in the mycluster group when the owner publishes their cartridge
 * to myCluster (published_to_cluster = true). Receives the cartridge slug
 * from the tab config, fetches the cartridge's tab list from the API, and
 * shows them in a nested sub-tab strip.
 *
 * Uses the same TabRenderer dispatch as every other template tab, so the
 * owner sees exactly the same view that external visitors would see —
 * no special-casing.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { TabRenderer } from "../TabRenderer";
import type { CodexTab } from "@/types/codex";

interface RawApiTab {
  id: string;
  slug: string;
  label: string;
  enabled: boolean;
  order: number;
  type: string;
  config?: Record<string, unknown>;
}

interface Props {
  cartridgeSlug: string;
  personaId?: string;
  theme?: "light" | "dark";
}

export function PersonalCartridgeTab({ cartridgeSlug, personaId, theme }: Props) {
  const [tabs, setTabs] = useState<RawApiTab[] | null>(null);
  const [cartridgeTitle, setCartridgeTitle] = useState<string>(cartridgeSlug);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTabSlug, setActiveTabSlug] = useState<string | null>(null);

  const loadTabs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await personaFetch(`/api/cartridge/${encodeURIComponent(cartridgeSlug)}`);
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.detail || body.error || `load failed (${res.status})`);
      }
      setCartridgeTitle((body.cartridge as { title?: string })?.title ?? cartridgeSlug);
      const enabled = ((body.tabs ?? []) as RawApiTab[])
        .filter((t) => t.enabled)
        .sort((a, b) => a.order - b.order);
      setTabs(enabled);
      setActiveTabSlug(enabled[0]?.slug ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [cartridgeSlug]);

  useEffect(() => {
    void loadTabs();
  }, [loadTabs]);

  const activeTab = useMemo(
    () => (tabs ?? []).find((t) => t.slug === activeTabSlug) ?? null,
    [tabs, activeTabSlug],
  );

  // Cast the raw API row into a CodexTab so TabRenderer can dispatch it.
  // The config stored in codex_tabs already matches CodexTabConfig shape —
  // the wizard writes { templateId, props } for template tabs and
  // { component, props } for static tabs.
  const tabForRenderer: CodexTab | null = activeTab
    ? ({
        id: activeTab.id,
        slug: activeTab.slug,
        label: activeTab.label,
        enabled: activeTab.enabled,
        order: activeTab.order,
        type: activeTab.type as CodexTab["type"],
        config: (activeTab.config ?? {}) as CodexTab["config"],
      } as CodexTab)
    : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading {cartridgeTitle}…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-amber-400 text-sm">
        <AlertCircle className="w-4 h-4" />
        {loadError}
      </div>
    );
  }

  if (!tabs || tabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        {cartridgeTitle} has no enabled tabs yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Nested sub-tab strip — only visible when the cartridge has multiple tabs */}
      {tabs.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700/40 overflow-x-auto shrink-0">
          {tabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setActiveTabSlug(t.slug)}
              className={`px-3 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-all ${
                t.slug === activeTabSlug
                  ? "bg-violet-500/20 text-violet-200 border border-violet-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content dispatched via the standard template framework */}
      <div className="flex-1 overflow-auto">
        {tabForRenderer && (
          <TabRenderer
            tab={tabForRenderer}
            codexId={cartridgeSlug}
            theme={theme}
            personaId={personaId}
          />
        )}
      </div>
    </div>
  );
}

export default PersonalCartridgeTab;
