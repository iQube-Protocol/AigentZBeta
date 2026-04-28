"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
const CodexPanelDynamic = dynamic(
  () => import("../../../triad/components/CodexPanelDynamic"),
  { ssr: false }
);
import { useCodexConfig, useCodexList } from "@/app/hooks/useCodexConfig";
import type { CodexListItem } from "@/types/codex";
const CodexCopilotLayer = dynamic(
  () => import("@/app/components/codex/CodexCopilotLayer").then(m => ({ default: m.CodexCopilotLayer })),
  { ssr: false }
);
import { useSupabaseSessionPersonas } from "@/app/hooks/useSupabaseSessionPersonas";
import {
  BookOpen,
  Bot,
  Code,
  LayoutGrid,
  Link,
  List,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Smartphone,
  Tablet,
} from "lucide-react";

type ConfigSection = "codex" | "theme" | "density" | "tab" | "embed" | "iframe";
type CodexOption = { id: string; label: string; color: string };
type TabOption = { slug: string; label: string };
type PreviewDevice = "mobile" | "tablet" | "desktop";

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
  const searchParams = useSearchParams();
  const [codexId, setCodexId] = useState(searchParams.get("id") ?? "knyt-codex");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [density, setDensity] = useState<"narrow" | "wide">("wide");
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "scrolls");
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(() => {
    // Restore per-codex hidden tabs from localStorage on mount
    if (typeof window === "undefined") return [];
    try {
      const key = `viewer_hidden_${searchParams.get("id") ?? "knyt-codex"}`;
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<ConfigSection>("codex");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Sync codexId and activeTab when navigating between cartridges via URL (same-path navigation)
  useEffect(() => {
    const newId = searchParams.get("id");
    const newTab = searchParams.get("tab");
    if (newId && newId !== codexId) {
      setCodexId(newId);
      // Restore hidden tabs for the new codex
      try {
        const stored = localStorage.getItem(`viewer_hidden_${newId}`);
        setHiddenTabs(stored ? (JSON.parse(stored) as string[]) : []);
      } catch {
        setHiddenTabs([]);
      }
    }
    if (newTab && newTab !== activeTab) setActiveTab(newTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Persist hidden tabs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`viewer_hidden_${codexId}`, JSON.stringify(hiddenTabs));
    } catch { /* storage unavailable */ }
  }, [hiddenTabs, codexId]);

  // Resolve active session persona so SmartTriadProvider queries the right ownership data
  const { sessionPersonas } = useSupabaseSessionPersonas();
  const activePersonaId = useMemo(() => {
    const human = sessionPersonas.find(p => !p.isAgent);
    return human?.id || sessionPersonas[0]?.id;
  }, [sessionPersonas]);

  const isAigentiqCodex = codexId === "agentiq-codex";
  const isAgentiqOSCartridge = codexId === "agentiq-os-cartridge";

  const [copilotOSOpen, setCopilotOSOpen] = useState(false);

  // Listen for AigentCOSTab button clicks (dispatched via custom DOM event)
  useEffect(() => {
    const handler = () => setCopilotOSOpen(true);
    window.addEventListener('aigent-c-os:open-copilot', handler);
    return () => window.removeEventListener('aigent-c-os:open-copilot', handler);
  }, []);

  const handleAigentCOSPrompt = useCallback(async (prompt: string): Promise<string> => {
    try {
      const res = await fetch("/api/codex/chat/agentiq-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, persona_id: activePersonaId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.response || "I could not generate a response.";
    } catch (err) {
      console.error("[CodexViewer] Aigent C-OS chat error:", err);
      return "I encountered an error. Please try again.";
    }
  }, [activePersonaId]);

  const handleAigentZPrompt = useCallback(async (prompt: string): Promise<string> => {
    try {
      const res = await fetch("/api/codex/chat/aigentiq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.response || "I could not generate a response.";
    } catch (err) {
      console.error("[CodexViewer] Aigent Z chat error:", err);
      return "I encountered an error querying the codex. Please try again.";
    }
  }, []);

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

  const visibleTabOptions = useMemo(
    () => tabOptions.filter((tab) => !hiddenTabs.includes(tab.slug)),
    [tabOptions, hiddenTabs]
  );

  useEffect(() => {
    if (!tabOptions.length) return;
    setHiddenTabs((prev) => prev.filter((slug) => tabOptions.some((tab) => tab.slug === slug)));
  }, [tabOptions]);

  const fallbackCodexes = useMemo<CodexOption[]>(() => ([
    { id: "knyt-codex", label: "KNYT Cartridge", color: "purple" },
    { id: "qripto-codex", label: "Qriptopian Cartridge", color: "indigo" },
    { id: "agentiq-codex", label: "AgentiQ Cartridge", color: "blue" },
    { id: "marketa-codex", label: "Aigent Marketa", color: "rose" },
    { id: "moneypenny-codex", label: "Aigent MoneyPenny", color: "green" },
    { id: "nakamoto-codex", label: "Aigent Nakamoto", color: "orange" },
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
    if (searchParams.get("id")) return; // URL-provided codex ID may not be in the picker list (e.g. admin-only)
    if (!codexOptions.some(option => option.id === codexId)) {
      setCodexId(codexOptions[0].id);
    }
  }, [codexOptions, codexId, searchParams]);

  useEffect(() => {
    if (!enabledTabs.length) return; // don't reset until real config tabs are loaded (prevents fallback list from overriding URL-provided tab)
    if (!visibleTabOptions.length) return;
    if (!visibleTabOptions.some(tab => tab.slug === activeTab)) {
      setActiveTab(visibleTabOptions[0].slug);
    }
  }, [visibleTabOptions, activeTab, enabledTabs]);

  const codexSlug = codexId.replace("-codex", "");
  const hiddenTabsParam = hiddenTabs.length > 0 ? `&hiddenTabs=${encodeURIComponent(hiddenTabs.join(","))}` : "";
  const embedUrl = `https://dev-beta.aigentz.me/triad/embed/codex/${codexSlug}?tab=${activeTab}&theme=${theme}&density=${density}${hiddenTabsParam}`;

  const toggleTabHidden = (slug: string) => {
    setHiddenTabs((prev) => {
      if (prev.includes(slug)) return prev.filter((entry) => entry !== slug);
      return [...prev, slug];
    });
  };

  const sections = [
    {
      id: "codex",
      label: "Select Cartridge",
      icon: BookOpen,
      content: (
        <div className="flex flex-col gap-2">
          {codexOptions.map((codex) => (
            <button
              key={codex.id}
              onClick={() => setCodexId(codex.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                codexId === codex.id
                  ? `bg-${codex.color}-500/10 ring-1 ring-${codex.color}-500/30 text-${codex.color}-300`
                  : "bg-slate-700/30 text-slate-400 hover:bg-white/6 hover:text-slate-300"
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
        <div className="space-y-2">
          <div className="text-[11px] text-slate-400">
            Visible tabs: {visibleTabOptions.length}/{tabOptions.length}
          </div>
          {tabOptions.map((tab) => (
            <div key={tab.slug} className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab(tab.slug)}
                disabled={hiddenTabs.includes(tab.slug)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  hiddenTabs.includes(tab.slug)
                    ? "bg-slate-800/60 text-slate-500 cursor-not-allowed"
                    : activeTab === tab.slug
                      ? "bg-purple-500 text-white"
                      : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
              <button
                type="button"
                onClick={() => toggleTabHidden(tab.slug)}
                className={`inline-flex items-center justify-center rounded-lg border p-2 transition-colors ${
                  hiddenTabs.includes(tab.slug)
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                }`}
                title={hiddenTabs.includes(tab.slug) ? "Show tab" : "Hide tab"}
                aria-label={hiddenTabs.includes(tab.slug) ? `Show ${tab.label} tab` : `Hide ${tab.label} tab`}
              >
                {hiddenTabs.includes(tab.slug) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
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
  const previewViewportClass = {
    mobile: "w-[390px]",
    tablet: "w-[900px]",
    desktop: "w-full",
  }[previewDevice];
  const useFramedViewport = previewDevice !== "desktop";

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
            <h1 className="text-xl font-bold text-white">Multi-Cartridge Viewer</h1>
            <span className="text-sm text-slate-400">Test and configure Codex embed components</span>
          </div>
          <div className="flex items-center gap-2">
            {isAigentiqCodex && (
              <button
                type="button"
                onClick={() => setCopilotOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                  copilotOpen
                    ? "border-blue-500/60 bg-blue-500/20 text-blue-200"
                    : "border-slate-600/60 bg-slate-800/70 text-slate-300 hover:border-blue-500/40 hover:text-blue-300"
                }`}
                title="Toggle Aigent Z copilot"
              >
                <Bot className="h-3.5 w-3.5" />
                Aigent Z
              </button>
            )}
            {isAgentiqOSCartridge && (
              <button
                type="button"
                onClick={() => setCopilotOSOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                  copilotOSOpen
                    ? "border-green-500/60 bg-green-500/20 text-green-200"
                    : "border-slate-600/60 bg-slate-800/70 text-slate-300 hover:border-green-500/40 hover:text-green-300"
                }`}
                title="Toggle Aigent C-OS copilot"
              >
                <Bot className="h-3.5 w-3.5" />
                Aigent C-OS
              </button>
            )}
            <Settings className="w-5 h-5 text-slate-400" />
            <div className="inline-flex items-center rounded-lg border border-slate-700/60 bg-slate-900/70 p-1">
              {(
                [
                  { id: "mobile", label: "Mobile", icon: Smartphone },
                  { id: "tablet", label: "Tablet", icon: Tablet },
                  { id: "desktop", label: "Desktop", icon: Monitor },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const active = previewDevice === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPreviewDevice(option.id)}
                    className={`inline-flex items-center justify-center rounded-md px-2 py-1 transition-colors ${
                      active
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                    }`}
                    title={option.label}
                    aria-label={option.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
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
        <div className="flex-1 overflow-auto bg-slate-900/40 p-4 relative">
          <div className={`mx-auto h-full max-w-full ${previewViewportClass}`}>
            <div
              className={`h-full overflow-hidden ${
                useFramedViewport ? "rounded-xl border border-slate-700/60 shadow-2xl shadow-black/50" : ""
              }`}
            >
              <CodexPanelDynamic
                key={codexId}
                codexId={codexId}
                theme={theme}
                density={density}
                initialTab={activeTab}
                hiddenTabs={hiddenTabs}
                isAdmin={true}
                useDefaults={true}
                previewDevice={previewDevice}
                personaId={activePersonaId}
                shell="viewer"
              />
            </div>
          </div>

          {/* Aigent Z copilot — only for AgentiQ Codex */}
          {isAigentiqCodex && (
            <CodexCopilotLayer
              isOpen={copilotOpen}
              onClose={() => setCopilotOpen(false)}
              onOpen={() => setCopilotOpen(true)}
              variant="floating"
              onUserPrompt={handleAigentZPrompt}
              density={density}
              agent={{ id: "aigent-z", name: "Aigent Z" }}
              personaId="aigent-z"
              enableInferenceRendering
              initialMessage="I'm Aigent Z — the engineering intelligence of the AgentiQ platform. Ask me about the architecture, codebase, deployment history, API routes, or any decision made during development."
              quickPrompts={[
                "What was built recently?",
                "Explain the 4-layer architecture",
                "What is x402?",
                "Show me the API routes",
                "What are the core architectural decisions?",
                "How does the iQube identity hierarchy work?",
              ]}
              promptPlaceholder="Ask about the platform, commits, architecture..."
            />
          )}
          {isAgentiqOSCartridge && (
            <CodexCopilotLayer
              isOpen={copilotOSOpen}
              onClose={() => setCopilotOSOpen(false)}
              onOpen={() => setCopilotOSOpen(true)}
              variant="floating"
              onUserPrompt={handleAigentCOSPrompt}
              density={density}
              agent={{ id: "aigent-c-os", name: "Aigent C-OS" }}
              personaId={activePersonaId ?? "aigent-c-os"}
              enableInferenceRendering
              initialMessage="I'm Aigent C-OS — your grounded guide to the AgentiQ OS open layer. Ask me about protocols, SDK usage, bounded delegation, cartridge building, Registry submissions, or the nanOS bridge path."
              quickPrompts={[
                "What is the PolicyEnvelope?",
                "How do I install the SDK?",
                "Explain the three protocols",
                "What is bounded delegation?",
                "How do I submit to the Registry?",
                "What is my path to nanOS?",
              ]}
              promptPlaceholder="Ask about AgentiQ OS, protocols, SDK, delegation..."
            />
          )}
        </div>
      </div>
    </div>
  );
}
