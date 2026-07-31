/**
 * AgentiqCartridgeTab
 *
 * Renders Agentiq Cartridge content from codexes/packs/agentiq.
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownUp, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Pencil, X } from "lucide-react";
import { getCachedOrFetch } from "../cache";
import { CopilotInferenceBodyRenderer } from "@/app/components/codex/CopilotInferenceBodyRenderer";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";

interface CollectionEntry {
  id: string;
  title: string;
  items: string[];
}

interface CartridgeTabProps {
  packId: string;
  collectionId: string;
  defaultPath?: string;
  editable?: boolean;
}

interface FileResponse {
  ok: boolean;
  format: "markdown" | "json";
  path: string;
  content?: string;
  data?: unknown;
}

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Human label for a collection doc. For EXPERIMENT docs — whose parent directory
 * carries the id (e.g. `.../exp-p3-capability-validation/README.md`) — prefix the
 * label with the experiment id so a column of README files is identifiable at a
 * glance (EXP-006, CCE-006, EXP-P3, IRV-001…). Non-experiment docs keep the
 * plain prettified-filename behaviour.
 */
function formatLabel(path: string): string {
  const parts = path.split("/");
  const file = (parts[parts.length - 1] || path).replace(/\.md$/i, "");
  const parent = parts.length >= 2 ? parts[parts.length - 2] : "";
  const expMatch = parent.match(/^(exp|cce|irv|ipv)-(p?\d+[a-z]?)\b/i);
  if (expMatch) {
    const id = `${expMatch[1].toUpperCase()}-${expMatch[2].toUpperCase()}`; // EXP-P3 · CCE-006 · IRV-001 · EXP-006
    if (/^readme$/i.test(file)) {
      // README → "EXP-P3 · Capability Validation" (nice name from the dir slug).
      const slug = parent.replace(/^(exp|cce|irv|ipv)-p?\d+[a-z]?-?/i, "");
      return slug ? `${id} · ${titleCase(slug)}` : id;
    }
    // A companion doc → "EXP-001 · Canonical Article".
    return `${id} · ${titleCase(file)}`;
  }
  return file.replace(/[_-]+/g, " ");
}

interface CodexSource {
  path: string;
  status: string;
  github_url: string;
}

export function AgentiqCartridgeTab({ packId, collectionId, defaultPath, editable = false }: CartridgeTabProps) {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [lastSources, setLastSources] = useState<CodexSource[]>([]);

  // Route copilot prompts through the AgentiQ-specific chat route so Aigent Z
  // has full KB access (both packs) and returns proper GitHub file links.
  const handleAigentZPrompt = async (prompt: string): Promise<string> => {
    try {
      const res = await fetch('/api/codex/chat/aigentiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          chatHistory: copilotMessages
            .filter((m) => m.role !== 'system')
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.codex_sources) && data.codex_sources.length > 0) {
        setLastSources(data.codex_sources);
      }
      return data.response ?? 'No response from Aigent Z.';
    } catch (err) {
      return `Aigent Z error: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  const [collection, setCollection] = useState<CollectionEntry | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentFormat, setContentFormat] = useState<"markdown" | "json">("markdown");
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sortDesc, setSortDesc] = useState(true); // true = newest first (default)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const items = useMemo(() => {
    const raw = collection?.items ?? [];
    return sortDesc ? [...raw] : [...raw].reverse();
  }, [collection, sortDesc]);

  useEffect(() => {
    let isMounted = true;
    async function loadCollection() {
      setLoading(true);
      setError(null);
      try {
        const collections = await getCachedOrFetch<CollectionEntry[]>(
          `codex:pack:${packId}:collections`,
          async () => {
            const response = await fetch(`/api/codex/packs/${packId}/file?path=collections.json`);
            if (!response.ok) {
              throw new Error(`Failed to load collections for ${packId}`);
            }
            const payload: FileResponse = await response.json();
            const data = payload.data as { collections?: CollectionEntry[] } | undefined;
            return data?.collections ?? [];
          },
          30 * 60 * 1000
        );
        const match = collections.find((col) => col.id === collectionId) ?? null;
        if (!match) {
          throw new Error(`Collection not found: ${collectionId}`);
        }
        if (isMounted) {
          setCollection(match);
          setActivePath(defaultPath ?? match.items[0] ?? null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load collection.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCollection();
    return () => {
      isMounted = false;
    };
  }, [packId, collectionId, defaultPath]);

  useEffect(() => {
    let isMounted = true;
    async function loadContent() {
      if (!activePath) return;
      setContentLoading(true);
      setError(null);
      try {
        const encoded = encodeURIComponent(activePath);
        const payload = await getCachedOrFetch<FileResponse>(
          `codex:pack:${packId}:file:${activePath}`,
          async () => {
            const response = await fetch(`/api/codex/packs/${packId}/file?path=${encoded}`);
            if (!response.ok) {
              throw new Error(`Failed to load ${activePath}`);
            }
            return response.json();
          },
          30 * 60 * 1000
        );
        if (!isMounted) return;
        if (payload.format === "json") {
          setContent(JSON.stringify(payload.data ?? {}, null, 2));
          setContentFormat("json");
        } else {
          setContent(payload.content ?? "");
          setContentFormat("markdown");
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load content.");
        }
      } finally {
        if (isMounted) setContentLoading(false);
      }
    }
    loadContent();
    return () => {
      isMounted = false;
    };
  }, [packId, activePath]);

  // Strip "items/" prefix for write-doc endpoint which expects paths relative to items/
  function toWriteDocPath(itemPath: string): string {
    return itemPath.replace(/^items\//, "");
  }

  async function handleSave() {
    if (!activePath) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/codex/chat/aigentiq/write-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: toWriteDocPath(activePath), content: editDraft, overwrite: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setContent(editDraft);
        setEditMode(false);
        setSaveResult({ ok: true, message: "Saved and queued for deploy." });
      } else {
        setSaveResult({ ok: false, message: data.error || "Save failed." });
      }
    } catch (err) {
      setSaveResult({ ok: false, message: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading cartridge...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="p-6 text-center text-slate-400">
        No collection available.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className={`flex-shrink-0 border-r border-slate-800 bg-slate-900/40 overflow-y-auto transition-all duration-200 ${sidebarCollapsed ? "w-8" : "w-56"}`}>
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center pt-2 gap-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {items.map((item) => (
              <button
                key={item}
                onClick={() => { setActivePath(item); setSidebarCollapsed(false); }}
                title={formatLabel(item)}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                  item === activePath ? "bg-blue-500/20 text-blue-400" : "text-slate-600 hover:text-slate-300"
                }`}
              >
                <FileText className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {collection.title}
              </h3>
              <div className="flex items-center gap-1">
                {items.length > 1 && (
                  <button
                    onClick={() => setSortDesc((d) => !d)}
                    title={sortDesc ? "Showing newest first — click for oldest first" : "Showing oldest first — click for newest first"}
                    className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
                  >
                    <ArrowDownUp className="h-3 w-3" />
                    {sortDesc ? "Newest" : "Oldest"}
                  </button>
                )}
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  className="flex h-5 w-5 items-center justify-center rounded-md text-slate-500 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item}
                  onClick={() => setActivePath(item)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    item === activePath
                      ? "bg-blue-500/20 text-blue-200"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{formatLabel(item)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {contentLoading ? (
          <div className="flex items-center text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading content...
          </div>
        ) : editMode ? (
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-300">Editing — changes commit to the dev branch</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setEditMode(false); setSaveResult(null); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-500/60 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 hover:bg-blue-500/30 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            {saveResult && (
              <div className={`rounded-lg px-3 py-2 text-xs ${saveResult.ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" : "bg-red-500/10 text-red-300 border border-red-500/30"}`}>
                {saveResult.message}
              </div>
            )}
            <textarea
              className="flex-1 min-h-[400px] rounded-lg border border-slate-700/60 bg-slate-900/60 p-4 font-mono text-sm text-slate-200 focus:border-blue-500/60 focus:outline-none resize-none"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="relative">
            {editable && activePath && (
              <div className="flex items-center justify-between mb-4">
                <span />
                <button
                  type="button"
                  onClick={() => { setEditDraft(content); setEditMode(true); setSaveResult(null); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-1 text-xs text-slate-300 hover:border-blue-500/40 hover:text-blue-300"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            )}
            {saveResult?.ok && (
              <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {saveResult.message}
              </div>
            )}
            {contentFormat === "markdown" ? (
              <CopilotInferenceBodyRenderer content={content || ""} />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-slate-200">
                {content || "No content available."}
              </pre>
            )}
          </div>
        )}
      </div>

      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        contextId="agentiq-cartridge"
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
        onUserPrompt={handleAigentZPrompt}
        footerContent={
          lastSources.length > 0 ? (
            <div className="px-3 py-2 border-t border-slate-800">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Sources</p>
              <div className="flex flex-col gap-1">
                {lastSources.map((s) => (
                  <a
                    key={s.path}
                    href={s.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 truncate"
                  >
                    <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase bg-slate-800 text-slate-400">
                      {s.status}
                    </span>
                    <span className="truncate">{s.path.split('/').pop()}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}
