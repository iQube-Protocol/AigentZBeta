/**
 * Dynamic CodexPanel Component
 * 
 * Supports multiple codexes loaded from the registry API.
 * Renders tabs dynamically based on codex configuration.
 */

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCodexConfig, getEnabledTabs } from "@/app/hooks/useCodexConfig";
import { CodexTab } from "@/types/codex";
import type { DeviceType } from "@/app/types/knytLiquidUI";
import { Loader2, AlertCircle, X, Coins, Zap } from "lucide-react";
import { SmartTriadProvider, SmartTriadSurfaces } from "@/app/components/content";
import { TabRenderer } from "./codex/TabRenderer";
import { getIconComponent } from "./codex/iconMap";
import { getCachedOrFetch } from "./codex/cache";


interface CodexPanelDynamicProps {
  codexId: string;              // 'knyt-codex', 'qripto-codex', 'aigentiq-codex' (Agentiq Cartridge)
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  initialTab?: string;
  hiddenTabs?: string[];
  personaId?: string;
  isAdmin?: boolean;            // Explicit admin override — hides adminOnly tabs from non-admins
  useDefaults?: boolean;        // Use hardcoded configs vs database
  previewDevice?: DeviceType;
  onClose?: () => void;         // Direct close callback (inline rendering)
}

type IssueOption = {
  slug: string;
  label: string;
  count?: number;
};

/** Two-column economic framing strip shown in KNYT and AgentiQ codex headers. */
function EconomicSplitBanner() {
  return (
    <div className="flex gap-2 border-b border-slate-800/80 bg-slate-900/60 px-4 py-2">
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-1.5">
        <Zap className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">Q¢ &mdash; Platform Rail</span>
          <p className="truncate text-[11px] text-slate-400">Base currency for content, access, and platform rewards across all cartridges.</p>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5">
        <Coins className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">$KNYT &mdash; Cartridge Economy</span>
          <p className="truncate text-[11px] text-slate-400">KNYT-native token earned by curating, remixing, and participating in the living canon.</p>
        </div>
      </div>
    </div>
  );
}

const TAB_DESCRIPTION_OVERRIDES: Record<string, Record<string, string>> = {
  'knyt-codex': {
    codex: 'Featured KNYT drops, character cards, and lore snapshots.',
    scrolls: 'Episodes and collectible preorder drops from the metaKnyts saga.',
    characters: 'Meet the heroes and villains of the metaKnyts universe.',
    lore: 'Background lore documents and world-building context.',
    digiterra: 'Digital-realm stories, clips, and character-linked moments.',
    terra: 'Cross-realm feeds for Terra and metaTerra updates.',
    order: 'Order progression, tasks, and status context.',
  },
};

const TAB_TITLE_OVERRIDES: Record<string, Record<string, string>> = {
  'knyt-codex': {
    characters: 'KNYT Cards',
  },
};

export default function CodexPanelDynamic({
  codexId,
  theme = 'dark',
  density = 'wide',
  initialTab,
  hiddenTabs = [],
  personaId,
  isAdmin: isAdminProp,
  useDefaults = true,
  previewDevice,
  onClose,
}: CodexPanelDynamicProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: codex, isLoading, error } = useCodexConfig({ codexId, useDefaults });
  const resolvedTheme: 'light' | 'dark' = theme === 'light' ? 'light' : 'dark';
  const normalizedInitialTab = (initialTab || '').trim().toLowerCase();
  const lastAppliedInitialTabRef = useRef<string>("");

  const queryHiddenTabs = useMemo(() => {
    const raw = (searchParams?.get("hiddenTabs") || searchParams?.get("hidden_tabs") || "").trim();
    if (!raw) return [] as string[];
    return raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }, [searchParams]);

  const hiddenTabSet = useMemo(() => {
    const next = new Set<string>();
    for (const tab of [...hiddenTabs, ...queryHiddenTabs]) {
      const slug = tab.trim().toLowerCase();
      if (slug) next.add(slug);
    }
    return next;
  }, [hiddenTabs, queryHiddenTabs]);
  
  // isAdminProp is the authoritative source when provided by the caller (e.g. platform shell
  // already resolved admin status from Supabase/AA-API). Falls back to false so adminOnly
  // tabs stay hidden when no explicit admin signal is received.
  const isAdmin = isAdminProp === true;

  const enabledTabs = useMemo(
    () => getEnabledTabs(codex, isAdmin).filter((tab) => !hiddenTabSet.has(tab.slug.toLowerCase())),
    [codex, isAdmin, hiddenTabSet]
  );
  
  const [activeTabSlug, setActiveTabSlug] = useState<string>(
    normalizedInitialTab || enabledTabs[0]?.slug || 'codex'
  );

  useEffect(() => {
    if (!normalizedInitialTab) return;
    if (lastAppliedInitialTabRef.current === normalizedInitialTab) return;
    if (enabledTabs.length > 0 && !enabledTabs.some((tab) => tab.slug === normalizedInitialTab)) {
      lastAppliedInitialTabRef.current = normalizedInitialTab;
      return;
    }
    setActiveTabSlug(normalizedInitialTab);
    lastAppliedInitialTabRef.current = normalizedInitialTab;
  }, [normalizedInitialTab, enabledTabs]);

  useEffect(() => {
    if (!enabledTabs.length) return;
    const exists = enabledTabs.some((tab) => tab.slug === activeTabSlug);
    if (exists) return;
    if (normalizedInitialTab && enabledTabs.some((tab) => tab.slug === normalizedInitialTab)) {
      setActiveTabSlug(normalizedInitialTab);
      return;
    }
    setActiveTabSlug(enabledTabs[0].slug);
  }, [enabledTabs, activeTabSlug, normalizedInitialTab]);

  const isQriptopian = codexId === 'qripto-codex';
  const [issueSlug, setIssueSlug] = useState<string>(() => {
    if (!isQriptopian) return 'issue-1';
    return 'issue-1';
  });
  const [issueOptions, setIssueOptions] = useState<IssueOption[]>([]);
  const [issueOptionsLoading, setIssueOptionsLoading] = useState(false);

  useEffect(() => {
    if (!isQriptopian) return;
    if (typeof window === 'undefined') return;
    const next = new URLSearchParams(window.location.search).get('issue') || 'issue-1';
    setIssueSlug(next);
  }, [isQriptopian]);

  const toIssueLabel = (slug: string) => {
    const match = slug.match(/issue-(\d{1,2})/i);
    if (!match) return slug;
    return `#${match[1]}`;
  };

  const fallbackIssueOptions = useMemo<IssueOption[]>(() => {
    if (!issueSlug) return [{ slug: 'issue-1', label: '#1' }];
    return [{ slug: issueSlug, label: toIssueLabel(issueSlug) }];
  }, [issueSlug]);

  useEffect(() => {
    if (!isQriptopian) return;
    let cancelled = false;

    const fetchIssues = async () => {
      setIssueOptionsLoading(true);
      try {
        const options = await getCachedOrFetch<IssueOption[]>(
          "codex:issues:qripto",
          async () => {
            const res = await fetch('/api/content/issues?scope=codex');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return Array.isArray(data?.issues) ? data.issues : [];
          },
          15 * 60 * 1000
        );
        if (!cancelled && options.length > 0) {
          setIssueOptions(options);
        }
      } catch {
        if (!cancelled) setIssueOptions([]);
      } finally {
        if (!cancelled) setIssueOptionsLoading(false);
      }
    };

    fetchIssues();
    return () => {
      cancelled = true;
    };
  }, [isQriptopian]);

  useEffect(() => {
    if (!isQriptopian) return;
    if (issueOptions.length === 0) return;
    if (issueOptions.some((opt) => opt.slug === issueSlug)) return;
    const next = issueOptions[0]?.slug;
    if (!next || next === issueSlug) return;
    setIssueSlug(next);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('issue', next);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [issueOptions, issueSlug, isQriptopian, pathname, router]);

  const activeTab = useMemo(
    () => enabledTabs.find(tab => tab.slug === activeTabSlug) || enabledTabs[0],
    [enabledTabs, activeTabSlug]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
            <p className="text-slate-400">Loading {codexId}...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !codex) {
    return (
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
            <p className="text-red-400">Failed to load codex</p>
            <p className="text-sm text-slate-500">{error?.message || 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }

  // No tabs available
  if (enabledTabs.length === 0) {
    return (
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
            <p className="text-amber-400">No tabs available</p>
          </div>
        </div>
      </div>
    );
  }

  const displayCodexName = codex.name.replace(/\s+codex$/i, '').trim() || codex.name;
  const activeTabTitle = activeTab
    ? TAB_TITLE_OVERRIDES[codexId]?.[activeTab.slug] || activeTab.label
    : '';
  const ActiveTabIcon = getIconComponent(activeTab?.metadata?.icon || 'Circle');
  const activeTabDescription = activeTab
    ? TAB_DESCRIPTION_OVERRIDES[codexId]?.[activeTab.slug] ||
      activeTab.metadata?.description ||
      codex.metadata.description ||
      ''
    : '';
  const tabBadgeText = (tab: CodexTab) => {
    const rawBadge = typeof tab.metadata?.badge === 'string' ? tab.metadata.badge : '';
    if (codexId === 'knyt-codex' && tab.slug === 'scrolls') {
      return '14';
    }
    if (codexId === 'knyt-codex' && tab.slug === 'characters') {
      const numeric = rawBadge.match(/\d+/)?.[0];
      return numeric || '';
    }
    return rawBadge;
  };

  const closeParam = (searchParams?.get("closable") || "").trim().toLowerCase();
  const closeEnabledByQuery = ["1", "true", "on", "yes"].includes(closeParam);
  const closeDisabledByQuery = ["0", "false", "off", "no"].includes(closeParam);
  const isEmbeddedContext = typeof window !== "undefined" && window.parent !== window;
  const showCloseLayerButton = !closeDisabledByQuery && (closeEnabledByQuery || isEmbeddedContext || !!onClose);

  const handleCloseLayer = () => {
    const handledInline = Boolean(onClose);
    if (onClose) {
      onClose();
    }

    if (typeof window === "undefined") return;

    const closePayload = {
      type: "METAME_CODEX_CLOSE_LAYER",
      source: "codex-embed",
      close_target: "codex-panel",
      runtime_source: "codex",
      codex_id: codexId,
      codexId,
      codex_slug: codexId.replace(/-codex$/i, ""),
      codexSlug: codexId.replace(/-codex$/i, ""),
      tab_slug: activeTabSlug,
    };

    const shouldBroadcast = closeEnabledByQuery || isEmbeddedContext || !handledInline;
    if (shouldBroadcast) {
      try {
        const bc = new BroadcastChannel("metame_codex_close");
        bc.postMessage(closePayload);
        bc.close();
      } catch (e) {}
    }

    if (shouldBroadcast && window.parent && window.parent !== window) {
      window.parent.postMessage(closePayload, "*");
      window.parent.postMessage("METAME_CODEX_CLOSE_LAYER", "*");
      // Also send bridge-format NAVIGATE that the shell handler understands
      window.parent.postMessage({
        type: "NAVIGATE",
        msg_id: "codex-close-" + Date.now(),
        timestamp: new Date().toISOString(),
        source: "runtime",
        payload: { path: "/", action: "close_codex", codex_id: codexId },
      }, "*");
    }
    if (shouldBroadcast && window.top && window.top !== window && window.top !== window.parent) {
      window.top.postMessage(closePayload, "*");
      window.top.postMessage("METAME_CODEX_CLOSE_LAYER", "*");
      window.top.postMessage({
        type: "NAVIGATE",
        msg_id: "codex-close-" + Date.now(),
        timestamp: new Date().toISOString(),
        source: "runtime",
        payload: { path: "/", action: "close_codex", codex_id: codexId },
      }, "*");
    }
    if (handledInline) return;
    if ((window.parent && window.parent !== window) || (window.top && window.top !== window)) {
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <SmartTriadProvider personaId={personaId}>
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-shrink-0 border-b border-slate-700/50 px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-4">
              <h2
                className="text-xl font-bold flex items-center gap-2 whitespace-nowrap"
                title={codex.metadata.description || undefined}
              >
                {codex.metadata.icon && React.createElement(
                  getIconComponent(codex.metadata.icon),
                  { className: `w-5 h-5 text-${codex.metadata.color || 'indigo'}-400` }
                )}
                {displayCodexName}
              </h2>
              <div className="flex gap-1 overflow-x-auto">
                {enabledTabs.map((tab) => {
                  const Icon = getIconComponent(tab.metadata?.icon || 'Circle');
                  const isActive = tab.slug === activeTabSlug;
                  const badge = tabBadgeText(tab);

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTabSlug(tab.slug)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                        isActive
                          ? `border-${codex.metadata.color || 'indigo'}-500 text-${codex.metadata.color || 'indigo'}-400`
                          : 'border-transparent text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {density === 'wide' && tab.label}
                      {badge && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 rounded">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isQriptopian && (
                <select
                  value={issueSlug}
                  onChange={(e) => {
                    const next = e.target.value;
                    setIssueSlug(next);
                    const params = new URLSearchParams(window.location.search);
                    params.set('issue', next);
                    router.replace(`${pathname}?${params.toString()}`);
                  }}
                  disabled={issueOptionsLoading && issueOptions.length === 0}
                  className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200"
                >
                  {(issueOptions.length > 0 ? issueOptions : fallbackIssueOptions).map((opt) => (
                    <option key={opt.slug} value={opt.slug}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {showCloseLayerButton ? (
                <button
                  type="button"
                  onClick={handleCloseLayer}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600/80 bg-slate-900/70 text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
                  title="Close codex layer"
                  aria-label="Close codex layer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {(codexId === 'knyt-codex' || codexId === 'agentiq-codex') && (
          <EconomicSplitBanner />
        )}

        {activeTab && (
          <div className="flex-shrink-0 border-b border-slate-800/80 px-4 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <ActiveTabIcon className="h-4 w-4 flex-shrink-0 text-slate-300" />
              <h3 className="text-sm font-semibold text-white whitespace-nowrap">{activeTabTitle}</h3>
              {activeTabDescription ? (
                <p
                  className="min-w-0 flex-1 truncate text-xs text-slate-400 sm:text-sm"
                  title={activeTabDescription}
                >
                  {activeTabDescription}
                </p>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {activeTab && (
            <TabRenderer
              tab={activeTab}
              codexId={codexId}
              theme={resolvedTheme}
              density={density}
              personaId={personaId}
              issueSlug={isQriptopian ? issueSlug : undefined}
              previewDevice={previewDevice}
            />
          )}
        </div>
      </div>

      <SmartTriadSurfaces personaId={personaId} />
    </SmartTriadProvider>
  );
}
