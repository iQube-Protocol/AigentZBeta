"use client";

import { useEffect, useMemo, useState } from "react";
import CodexPanelDynamic from "../../../triad/components/CodexPanelDynamic";
import { useCodexConfig, useCodexList } from "@/app/hooks/useCodexConfig";
import type { CodexListItem } from "@/types/codex";
import {
  BookOpen,
  Code,
  LayoutGrid,
  Link,
  List,
  Maximize2,
  Minimize2,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";

type ConfigSection = "codex" | "theme" | "density" | "tab" | "embed" | "iframe";
type CodexOption = { id: string; label: string; color: string };
type TabOption = { slug: string; label: string };

const COLOR_SET = new Set(["purple", "indigo", "blue", "emerald", "cyan", "amber", "rose", "slate"]);

function normalizeColor(color?: string) {
  if (!color) return "indigo";
  const lowered = color.toLowerCase();
  return COLOR_SET.has(lowered) ? lowered : "indigo";
}

function labelize(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CodexViewerPage() {
  const [codexId, setCodexId] = useState("knyt-codex");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [density, setDensity] = useState<"narrow" | "wide">("wide");
  const [activeTab, setActiveTab] = useState("scrolls");
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<ConfigSection>("codex");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: codexList } = useCodexList({ useDefaults: true });
  const { data: codexConfig } = useCodexConfig({ codexId, useDefaults: true });

  const enabledTabs = useMemo(() => {
    return (codexConfig?.tabs || []).filter(tab => tab.enabled).sort((a, b) => a.order - b.order);
  }, [codexConfig]);

  const tabOptions = useMemo<TabOption[]>(() => {
    if (enabledTabs.length > 0) {
      return enabledTabs.map(tab => ({ slug: tab.slug, label: tab.label }));
    }
    return ["scrolls", "characters", "lore", "digiterra", "terra", "order"].map(slug => ({
      slug,
      label: labelize(slug),
    }));
  }, [enabledTabs]);

  const fallbackCodexes = useMemo<CodexOption[]>(() => ([
    { id: "knyt-codex", label: "KNYT Codex", color: "purple" },
    { id: "qripto-codex", label: "Qriptopian Codex", color: "indigo" },
    { id: "aigentiq-codex", label: "AgentiQ Codex", color: "blue" },
    { id: "marketa-codex", label: "Aigent Marketa", color: "rose" },
    { id: "moneypenny-codex", label: "Aigent MoneyPenny", color: "green" },
  ]), []);

  const codexOptions = useMemo<CodexOption[]>(() => {
    if (!codexList || codexList.length === 0) return fallbackCodexes;
    return codexList.map((codex: CodexListItem) => ({
      id: codex.id,
      label: codex.name,
      color: normalizeColor(codex.metadata?.color),
    }));
  }, [codexList, fallbackCodexes]);

  useEffect(() => {
    if (!codexOptions.length) return;
    if (!codexOptions.some(option => option.id === codexId)) {
      setCodexId(codexOptions[0].id);
    }
  }, [codexOptions, codexId]);

  useEffect(() => {
    if (!tabOptions.length) return;
    if (!tabOptions.some(tab => tab.slug === activeTab)) {
      setActiveTab(tabOptions[0].slug);
    }
  }, [tabOptions, activeTab]);

  const codexSlug = codexId.replace("-codex", "");
  const embedUrl = `https://dev-beta.aigentz.me/triad/embed/codex/${codexSlug}?tab=${activeTab}&theme=${theme}&density=${density}`;

  const sections = [
    {
      id: "codex",
      label: "Select Codex",
      icon: BookOpen,
      content: (
        <div className="flex flex-col gap-2">
          {codexOptions.map((codex) => (
            <button
              key={codex.id}
              onClick={() => setCodexId(codex.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                codexId === codex.id
                  ? `bg-${codex.color}-500 text-white`
                  : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {codex.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "theme",
      label: "Theme",
      icon: Palette,
      content: (
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("dark")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              theme === "dark"
                ? "bg-indigo-500 text-white"
                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              theme === "light"
                ? "bg-indigo-500 text-white"
                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Light
          </button>
        </div>
      ),
    },
    {
      id: "density",
      label: "Density",
      icon: LayoutGrid,
      content: (
        <div className="flex gap-2">
          <button
            onClick={() => setDensity("narrow")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              density === "narrow"
                ? "bg-purple-500 text-white"
                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Narrow
          </button>
          <button
            onClick={() => setDensity("wide")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              density === "wide"
                ? "bg-purple-500 text-white"
                : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
            }`}
          >
            Wide
          </button>
        </div>
      ),
    },
    {
      id: "tab",
      label: "Initial Tab",
      icon: List,
      content: (
        <div className="grid grid-cols-2 gap-2">
          {tabOptions.map((tab) => (
            <button
              key={tab.slug}
              onClick={() => setActiveTab(tab.slug)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.slug
                  ? "bg-purple-500 text-white"
                  : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "embed",
      label: "Embed URL",
      icon: Link,
      content: (
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <code className="text-xs text-emerald-400 break-all">{embedUrl}</code>
        </div>
      ),
    },
    {
      id: "iframe",
      label: "Iframe Code",
      icon: Code,
      content: (
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <code className="text-xs text-cyan-400 break-all">
            {`<iframe src="${embedUrl}" width="100%" height="600px" />`}
          </code>
        </div>
      ),
    },
  ];

  const activeSectionConfig = sections.find(section => section.id === activeSection) ?? sections[0];

  return (
    <div
      className={`flex flex-col bg-slate-900 ${
        isFullscreen ? "fixed inset-0 z-[200]" : "h-screen"
      }`}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-bold text-white">Multi-Codex Viewer</h1>
            <span className="text-sm text-slate-400">Test and configure Codex embed components</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-400">Component Tester</span>
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="ml-2 inline-flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-800/70 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700/80"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Control Panel */}
        <div className="flex h-full border-r border-slate-700/50 bg-slate-800/30">
          <div className="w-16 flex-shrink-0 border-r border-slate-700/50 bg-slate-800/70 flex flex-col items-center py-4">
            <button
              onClick={() => setConfigCollapsed(!configCollapsed)}
              className="p-2 rounded-lg bg-slate-700/50 text-slate-200 hover:bg-slate-700"
              title={configCollapsed ? "Expand configuration" : "Collapse configuration"}
              aria-label={configCollapsed ? "Expand configuration" : "Collapse configuration"}
            >
              {configCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            <div className="mt-6 flex flex-col gap-3">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id as ConfigSection);
                      if (configCollapsed) setConfigCollapsed(false);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-indigo-500/30 text-indigo-200"
                        : "bg-slate-700/30 text-slate-400 hover:bg-slate-700/60"
                    }`}
                    title={section.label}
                    aria-label={section.label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {!configCollapsed && (
            <div className="w-80 p-6 overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    {activeSectionConfig.label}
                  </label>
                  {activeSectionConfig.content}
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                  <p className="text-xs text-indigo-300">
                    <strong>Testing Mode:</strong> Changes here update the component in real-time. Use this to ensure predictable behavior before embedding in thin clients.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Component Preview */}
        <div className="flex-1 overflow-hidden">
          <CodexPanelDynamic 
            codexId={codexId}
            theme={theme} 
            density={density} 
            initialTab={activeTab}
            useDefaults={true}
          />
        </div>
      </div>
    </div>
  );
}
