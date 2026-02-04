/**
 * Dynamic CodexPanel Component
 * 
 * Supports multiple codexes loaded from the registry API.
 * Renders tabs dynamically based on codex configuration.
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCodexConfig, getEnabledTabs } from "@/app/hooks/useCodexConfig";
import { CodexTab } from "@/types/codex";
import { Loader2, AlertCircle } from "lucide-react";
import { SmartTriadProvider, SmartTriadSurfaces } from "@/app/components/content";
import { TabRenderer } from "./codex/TabRenderer";
import { getIconComponent } from "./codex/iconMap";
import { getCachedOrFetch } from "./codex/cache";


interface CodexPanelDynamicProps {
  codexId: string;              // 'knyt-codex', 'qripto-codex', 'aigentiq-codex' (Agentiq Cartridge)
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  initialTab?: string;
  personaId?: string;
  useDefaults?: boolean;        // Use hardcoded configs vs database
}

type IssueOption = {
  slug: string;
  label: string;
  count?: number;
};

export default function CodexPanelDynamic({
  codexId,
  theme = 'dark',
  density = 'wide',
  initialTab,
  personaId,
  useDefaults = true
}: CodexPanelDynamicProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: codex, isLoading, error } = useCodexConfig({ codexId, useDefaults });
  
  const enabledTabs = useMemo(() => getEnabledTabs(codex), [codex]);
  
  const [activeTabSlug, setActiveTabSlug] = useState<string>(
    initialTab || enabledTabs[0]?.slug || 'codex'
  );

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
      <div className={`flex flex-col h-full w-full ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
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
      <div className={`flex flex-col h-full w-full ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
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
      <div className={`flex flex-col h-full w-full ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
            <p className="text-amber-400">No tabs available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SmartTriadProvider personaId={personaId}>
      <div className={`flex flex-col h-full w-full ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-shrink-0 border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {codex.metadata.icon && React.createElement(
                getIconComponent(codex.metadata.icon),
                { className: `w-5 h-5 text-${codex.metadata.color || 'indigo'}-400` }
              )}
              {codex.name}
            </h2>
            <div className="flex items-center gap-3">
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
              {codex.metadata.description && density === 'wide' && (
                <p className="text-sm text-slate-400">{codex.metadata.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-b border-slate-700/50 px-4">
          <div className="flex gap-1 overflow-x-auto">
            {enabledTabs.map((tab) => {
              const Icon = getIconComponent(tab.metadata?.icon || 'Circle');
              const isActive = tab.slug === activeTabSlug;

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
                  {tab.metadata?.badge && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 rounded">
                      {tab.metadata.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab && (
            <TabRenderer
              tab={activeTab}
              codexId={codexId}
              theme={theme}
              density={density}
              personaId={personaId}
              issueSlug={isQriptopian ? issueSlug : undefined}
            />
          )}
        </div>
      </div>

      <SmartTriadSurfaces personaId={personaId} />
    </SmartTriadProvider>
  );
}
