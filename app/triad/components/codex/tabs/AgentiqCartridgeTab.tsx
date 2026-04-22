/**
 * AgentiqCartridgeTab
 *
 * Renders Agentiq Cartridge content from codexes/packs/agentiq.
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownUp, CheckCircle2, FileText, Loader2, Pencil, X } from "lucide-react";
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

function formatLabel(path: string): string {
  const parts = path.split("/");
  const name = parts[parts.length - 1] || path;
  return name.replace(/\.md$/i, "").replace(/[_-]+/g, " ");
}

export function AgentiqCartridgeTab({ packId, collectionId, defaultPath, editable = false }: CartridgeTabProps) {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);

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
      <div className="w-56 flex-shrink-0 border-r border-slate-800 bg-slate-900/40 p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {collection.title}
          </h3>
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
        contextId="knyt-cartridge-doc"
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
      />
    </div>
  );
}
