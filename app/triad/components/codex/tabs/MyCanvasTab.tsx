"use client";

/**
 * MyCanvasTab — personal publishing surface inside the metaMe runtime.
 *
 * Phase 4 baseline: list / create / edit / delete entries. Invite UI is
 * stubbed — a single text input + "Add" sends a raw persona id to the
 * invites table; acceptance flow lands later.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Cpu, Loader2, Plus, PenSquare, Sparkles, Trash2, Save, X, UserPlus } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

type CanvasEntryType = "note" | "experience_origin" | "experience_derived";

interface CanvasEntry {
  id: string;
  title: string;
  bodyMd: string;
  tags: string[];
  visibility: "private" | "invited";
  entryType: CanvasEntryType;
  metaJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function MyCanvasTab({ personaId, theme = "dark" }: Props) {
  const [entries, setEntries] = useState<CanvasEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorBody, setEditorBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteOpenForId, setInviteOpenForId] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState("");

  const fetchEntries = useCallback(async () => {
    if (!personaId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/mycanvas/entries", { personaIdHint: personaId });
      if (!res.ok) throw new Error(`mycanvas list failed (${res.status})`);
      const data = (await res.json()) as { entries: CanvasEntry[] };
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void fetchEntries(); }, [fetchEntries]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) { setEditorTitle(""); setEditorBody(""); return; }
    setEditorTitle(selected.title);
    setEditorBody(selected.bodyMd);
  }, [selectedId, selected]);

  const handleCreate = useCallback(async () => {
    if (!personaId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await personaFetch("/api/mycanvas/entries", {
        personaIdHint: personaId,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled draft", bodyMd: "" }),
      });
      if (!res.ok) throw new Error(`create failed (${res.status})`);
      const data = (await res.json()) as { entry: CanvasEntry };
      setEntries((prev) => [data.entry, ...prev]);
      setSelectedId(data.entry.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, [personaId]);

  const handleSave = useCallback(async () => {
    if (!personaId || !selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/mycanvas/entries/${selected.id}`, {
        personaIdHint: personaId,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editorTitle, bodyMd: editorBody }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      const data = (await res.json()) as { entry: CanvasEntry };
      setEntries((prev) => prev.map((e) => (e.id === data.entry.id ? data.entry : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [personaId, selected, editorTitle, editorBody]);

  const handleDelete = useCallback(async (id: string) => {
    if (!personaId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this entry?")) return;
    try {
      const res = await personaFetch(`/api/mycanvas/entries/${id}`, {
        personaIdHint: personaId,
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [personaId, selectedId]);

  const handleInvite = useCallback(async (entryId: string) => {
    if (!personaId || !inviteInput.trim()) return;
    try {
      const res = await personaFetch(`/api/mycanvas/entries/${entryId}/invite`, {
        personaIdHint: personaId,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitedPersonaId: inviteInput.trim(), role: "viewer" }),
      });
      if (!res.ok) throw new Error(`invite failed (${res.status})`);
      setInviteInput("");
      setInviteOpenForId(null);
      void fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [personaId, inviteInput, fetchEntries]);

  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={`h-full overflow-hidden ${panelClass}`}>
      <div className="flex h-full">
        {/* Sidebar: entry list */}
        <aside className="w-64 border-r border-slate-700/50 flex flex-col">
          <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenSquare className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold">myCanvas</h2>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              title="New entry"
              className="flex items-center gap-1 px-2 py-1 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 text-xs disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : entries.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 italic">
                No entries yet — your private drafts live here.
              </div>
            ) : (
              <ul>
                {entries.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full text-left px-3 py-2 border-b border-slate-800/60 transition ${
                        selectedId === e.id ? "bg-violet-500/10" : "hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {e.entryType === "experience_origin" && (
                          <Cpu className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                        {e.entryType === "experience_derived" && (
                          <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{e.title || "Untitled"}</span>
                      </div>
                      <div className={`text-[11px] mt-0.5 ${mutedClass}`}>
                        {new Date(e.updatedAt).toLocaleDateString()} · {e.visibility}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right panel */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              Select an entry on the left, or create a new one.
            </div>
          ) : selected.entryType === "experience_derived" ? (
            <ExperienceDerivedPanel
              entry={selected}
              onDelete={(id) => void handleDelete(id)}
            />
          ) : selected.entryType === "experience_origin" ? (
            <ExperienceOriginPanel
              entry={selected}
              onDelete={(id) => void handleDelete(id)}
            />
          ) : (
            <>
              <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="Title"
                  className="flex-1 px-2 py-1.5 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:border-violet-500/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 text-xs disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setInviteOpenForId(inviteOpenForId === selected.id ? null : selected.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-violet-500/40 text-xs text-slate-300"
                  title="Invite (stub — acceptance flow coming later)"
                >
                  <UserPlus className="w-3 h-3" /> Invite
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(selected.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-rose-500/50 text-xs text-slate-300 hover:text-rose-200"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
              {inviteOpenForId === selected.id && (
                <div className="p-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/40">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="invitedPersonaId — stub; real invite flow lands later"
                    className="flex-1 px-2 py-1.5 rounded border border-slate-700 bg-slate-900 text-slate-100 text-xs focus:border-violet-500/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleInvite(selected.id)}
                    disabled={!inviteInput.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 text-xs disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInviteOpenForId(null); setInviteInput(""); }}
                    className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <textarea
                value={editorBody}
                onChange={(e) => setEditorBody(e.target.value)}
                placeholder="Write your draft, idea, or musing here…"
                className="flex-1 w-full px-4 py-3 bg-slate-950/40 text-slate-100 text-sm font-mono resize-none focus:outline-none"
              />
            </>
          )}
          {error && <p className="px-3 py-2 text-xs text-rose-300">{error}</p>}
        </section>
      </div>
    </div>
  );
}

// ─── Experience panels ────────────────────────────────────────────────────────

function ExperienceOriginPanel({
  entry,
  onDelete,
}: {
  entry: CanvasEntry;
  onDelete: (id: string) => void;
}) {
  const experienceId =
    typeof entry.metaJson.experienceId === "string" ? entry.metaJson.experienceId : null;
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
            Origin Experience
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-rose-500/50 text-xs text-slate-300 hover:text-rose-200"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-base font-semibold text-slate-100 leading-tight mb-3">{entry.title}</h2>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[12px] text-amber-200/80 leading-relaxed">
          This is the source Experience Qube you remixed from. Visit the runtime to re-experience it.
        </div>
        {experienceId && (
          <div className="mt-3 text-[10px] text-slate-600 font-mono break-all">
            ref: {experienceId}
          </div>
        )}
      </div>
    </div>
  );
}

function ExperienceDerivedPanel({
  entry,
  onDelete,
}: {
  entry: CanvasEntry;
  onDelete: (id: string) => void;
}) {
  const imageUrl =
    typeof entry.metaJson.imageUrl === "string" ? entry.metaJson.imageUrl : null;
  const skill =
    typeof entry.metaJson.skill === "string" ? entry.metaJson.skill : null;
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">
            Remix
          </span>
          {skill && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300/70 border border-violet-500/20 capitalize">
              {skill}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-rose-500/50 text-xs text-slate-300 hover:text-rose-200"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <h2 className="text-base font-semibold text-slate-100 leading-tight">{entry.title}</h2>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={entry.title}
            className="w-full rounded-xl border border-white/10 object-cover max-h-56"
            loading="lazy"
          />
        )}
        <article className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
          {entry.bodyMd}
        </article>
      </div>
    </div>
  );
}

export default MyCanvasTab;
