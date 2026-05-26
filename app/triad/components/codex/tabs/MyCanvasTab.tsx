"use client";

/**
 * MyCanvasTab — personal publishing surface inside the metaMe runtime.
 *
 * Phase 4 baseline: list / create / edit / delete entries. Invite UI is
 * stubbed — a single text input + "Add" sends a raw persona id to the
 * invites table; acceptance flow lands later.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Cpu, Loader2, Plus, PenSquare, Radio, Share2, Sparkles, Trash2, Save, X, UserPlus } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { RemixDialog } from "@/components/metame/runtime/RemixDialog";
import { SocialSharingModal } from "@/packages/smarttriad/src/SocialSharingModal";
import { InviteModal } from "@/components/shared/InviteModal";
import { ListenButton } from "@/components/shared/ListenButton";
import { useActivePersona } from "@/app/hooks/useActivePersona";

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
  const [remixSource, setRemixSource] = useState<CanvasEntry | null>(null);
  // PIECE 4 of the 413 fix — tracks which entry IDs have been hydrated
  // via GET /[id]. Without this, a note entry (legitimate bodyMd='' +
  // metaJson={}) would re-trigger the hydration effect on every
  // setEntries call because the GET response equals the list shape →
  // setEntries replaces the object → `selected` reference changes →
  // effect re-fires → infinite GET loop hammering Lambda. The ref is
  // cleared on personaId change so the next persona's stripped list
  // re-hydrates from a clean slate.
  const hydratedRef = useRef<Set<string>>(new Set());
  useEffect(() => { hydratedRef.current = new Set(); }, [personaId]);
  // Per-entry hydration state for visible diagnostics. Lets the right
  // panel show whether a fetch is in flight, errored, or finished
  // empty — so we can tell at a glance whether missing body content
  // is "fetch never fired", "fetch failed", or "entry truly empty".
  const [hydrationState, setHydrationState] = useState<Record<string, { status: "loading" | "ok" | "error"; code?: number }>>({});

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

  // PIECE 5 of the 413 fix — hydrate the full entry the first time it's
  // selected and merge body_md + meta_json back into the list state.
  // Each entry is fetched at most once per persona thanks to hydratedRef.
  useEffect(() => {
    if (!personaId || !selected) return;
    if (hydratedRef.current.has(selected.id)) return;
    hydratedRef.current.add(selected.id);
    const targetId = selected.id;
    setHydrationState((prev) => ({ ...prev, [targetId]: { status: "loading" } }));
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch(`/api/mycanvas/entries/${targetId}`, { personaIdHint: personaId });
        if (!res.ok) {
          console.error("[MyCanvas] hydration failed", { entryId: targetId, status: res.status });
          if (!cancelled) {
            setHydrationState((prev) => ({ ...prev, [targetId]: { status: "error", code: res.status } }));
          }
          // Allow a retry next time the user selects this entry.
          hydratedRef.current.delete(targetId);
          return;
        }
        const data = (await res.json()) as { entry: CanvasEntry };
        if (cancelled || !data?.entry) return;
        setEntries((prev) => prev.map((e) => (e.id === data.entry.id ? data.entry : e)));
        setHydrationState((prev) => ({ ...prev, [targetId]: { status: "ok" } }));
      } catch (err) {
        console.error("[MyCanvas] hydration threw", { entryId: targetId, err });
        if (!cancelled) {
          setHydrationState((prev) => ({ ...prev, [targetId]: { status: "error" } }));
        }
        hydratedRef.current.delete(targetId);
      }
    })();
    return () => { cancelled = true; };
  }, [personaId, selected]);

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

  // Share now opens the canonical Qriptopian SocialSharingModal —
  // same modal the runtime + community surfaces use. Persona attribution
  // flows through shareId server-side, not in the URL.
  const [shareEntry, setShareEntry] = useState<CanvasEntry | null>(null);
  const handleShare = useCallback((entry: CanvasEntry) => {
    setShareEntry(entry);
  }, []);

  // Invite now opens the shared InviteModal. Same surface as the
  // SmartContentActionContext 'invite' action — server-side resolution
  // of handle → persona_id, no T0 leak.
  const [inviteEntry, setInviteEntry] = useState<CanvasEntry | null>(null);

  // T1 label for the share modal's 'Shared by' badge — pulled from
  // useActivePersona's canonical surface, never a UUID fallback.
  const { surface: activePersonaSurface } = useActivePersona();
  type SurfaceWithFio = typeof activePersonaSurface & { ownFioHandle?: string };
  const personaLabel =
    activePersonaSurface?.displayLabel ??
    (activePersonaSurface as SurfaceWithFio | null)?.ownFioHandle ??
    undefined;

  // Publish a saved derived-experience entry to the community surface. The
  // entry's metaJson.contentId points at the original community_generated_content
  // row created when the user first remixed. Flipping its status to 'shared'
  // exposes it in KNYT / Qriptopian community tabs.
  const handlePublishToCommunity = useCallback(
    async (entry: CanvasEntry): Promise<{ ok: boolean; error?: string }> => {
      const contentId =
        typeof entry.metaJson.contentId === "string" ? entry.metaJson.contentId : null;
      if (!contentId) return { ok: false, error: "no content id on entry" };
      try {
        const res = await personaFetch(`/api/community-content/${contentId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          personaIdHint: personaId ?? undefined,
        });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          return { ok: false, error: j.error ?? `publish failed (${res.status})` };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [personaId],
  );

  // Per-entry "publish to Pulse" state — open dropdown picks the
  // destination cartridge (KNYT Pulse / Qriptopian Pulse). For 'note'
  // entries the route materialises a stub community_generated_content
  // row (skill='note', qc_cost=0, image_url=null) then flips it to
  // 'shared'. For 'experience_derived' entries the existing
  // /api/community-content/[id]/publish path is used — the row already
  // exists with its own cartridge stamp.
  const [publishOpenForId, setPublishOpenForId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const handlePublishNoteToPulse = useCallback(
    async (entry: CanvasEntry, cartridge: "knyt" | "qripto") => {
      setError(null);
      setPublishingId(entry.id);
      try {
        const res = await personaFetch(`/api/mycanvas/entries/${entry.id}/publish-to-pulse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartridge }),
          personaIdHint: personaId ?? undefined,
        });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          contentId?: string;
          cartridge?: string;
        };
        if (!res.ok || !j.ok) {
          setError(j.error ?? `publish failed (${res.status})`);
          return;
        }
        // Refresh the entry list so the metaJson.contentId stamp
        // appears immediately (drives the existing republish path on
        // subsequent clicks). Closed publish dropdown either way.
        setPublishOpenForId(null);
        if (j.contentId) {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id
                ? {
                    ...e,
                    metaJson: {
                      ...e.metaJson,
                      contentId: j.contentId!,
                      cartridge: j.cartridge ?? cartridge,
                      publishedAt: new Date().toISOString(),
                    },
                  }
                : e,
            ),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPublishingId(null);
      }
    },
    [personaId],
  );

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
              personaId={personaId ?? null}
              hydration={hydrationState[selected.id] ?? null}
              inviteOpen={inviteOpenForId === selected.id}
              inviteInput={inviteInput}
              onInviteToggle={() => setInviteEntry(selected)}
              onInviteInputChange={setInviteInput}
              onInviteSubmit={() => void handleInvite(selected.id)}
              onInviteCancel={() => { setInviteOpenForId(null); setInviteInput(""); }}
              onDelete={(id) => void handleDelete(id)}
              onShare={() => handleShare(selected)}
              onRemix={() => setRemixSource(selected)}
              onPublish={() => handlePublishToCommunity(selected)}
            />
          ) : selected.entryType === "experience_origin" ? (
            <ExperienceOriginPanel
              entry={selected}
              hydration={hydrationState[selected.id] ?? null}
              inviteOpen={inviteOpenForId === selected.id}
              inviteInput={inviteInput}
              onInviteToggle={() => setInviteEntry(selected)}
              onInviteInputChange={setInviteInput}
              onInviteSubmit={() => void handleInvite(selected.id)}
              onInviteCancel={() => { setInviteOpenForId(null); setInviteInput(""); }}
              onDelete={(id) => void handleDelete(id)}
              onShare={() => handleShare(selected)}
              onRemix={() => setRemixSource(selected)}
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
                {/* Publish to Pulse — note entries only. experience_derived
                    entries already have a publish path via metaJson.contentId
                    (handlePublishToCommunity below). Adds a cartridge picker
                    so the user chooses KNYT Pulse or Qriptopian Pulse. Once
                    published, the entry is stamped with contentId so it can
                    re-publish idempotently via the existing path. */}
                {selected.entryType === "note" && (
                  <button
                    type="button"
                    onClick={() => setPublishOpenForId(publishOpenForId === selected.id ? null : selected.id)}
                    disabled={publishingId === selected.id}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs disabled:opacity-50 ${
                      selected.metaJson?.contentId
                        ? "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                        : "border-slate-600 text-slate-300 hover:border-violet-500/40"
                    }`}
                    title={
                      selected.metaJson?.contentId
                        ? "Already published — publishing again is idempotent"
                        : "Publish this note to KNYT Pulse or Qriptopian Pulse"
                    }
                  >
                    {publishingId === selected.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Radio className="w-3 h-3" />
                    )}
                    {selected.metaJson?.contentId ? "Published" : "Publish"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDelete(selected.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-rose-500/50 text-xs text-slate-300 hover:text-rose-200"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
              {publishOpenForId === selected.id && selected.entryType === "note" && (
                <div className="p-3 border-b border-slate-700/50 bg-slate-800/40 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Publish to:</span>
                  <button
                    type="button"
                    onClick={() => void handlePublishNoteToPulse(selected, "knyt")}
                    disabled={publishingId === selected.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 text-xs disabled:opacity-50"
                  >
                    <Radio className="w-3 h-3" /> KNYT Pulse
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePublishNoteToPulse(selected, "qripto")}
                    disabled={publishingId === selected.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-100 text-xs disabled:opacity-50"
                  >
                    <Radio className="w-3 h-3" /> Qriptopian Pulse
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishOpenForId(null)}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              )}
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
      {remixSource && (
        <RemixDialog
          open={true}
          personaId={personaId ?? null}
          sourceExperienceId={
            typeof remixSource.metaJson.experienceId === "string"
              ? remixSource.metaJson.experienceId
              : typeof remixSource.metaJson.sourceExperienceId === "string"
                ? remixSource.metaJson.sourceExperienceId
                : remixSource.id
          }
          initialTitle={remixSource.title}
          initialPrompt=""
          sourceImageUrl={
            typeof remixSource.metaJson.imageUrl === "string" ? remixSource.metaJson.imageUrl : null
          }
          sourceDescription={
            typeof remixSource.metaJson.description === "string"
              ? remixSource.metaJson.description
              : remixSource.bodyMd || null
          }
          onClose={() => { setRemixSource(null); void fetchEntries(); }}
        />
      )}
      {/* Canonical share modal — Qriptopian SocialSharingModal. Persona
          attribution flows through shareId server-side. */}
      <SocialSharingModal
        isOpen={!!shareEntry}
        onClose={() => setShareEntry(null)}
        article={
          shareEntry
            ? {
                id: shareEntry.id,
                title: shareEntry.title,
                description: shareEntry.bodyMd?.slice(0, 200) || undefined,
                section: shareEntry.entryType,
                type: 'text',
              }
            : { id: '', title: '' }
        }
        personaId={personaId}
        personaLabel={personaLabel}
      />
      {/* Canonical invite modal — same component used everywhere via
          SmartContentActionContext.executeAction('invite'). */}
      <InviteModal
        isOpen={!!inviteEntry}
        onClose={() => setInviteEntry(null)}
        entity={inviteEntry ? { id: inviteEntry.id, title: inviteEntry.title, kind: inviteEntry.entryType } : { id: '', title: '' }}
        endpointPath={inviteEntry ? `/api/mycanvas/entries/${inviteEntry.id}/invite` : ''}
        personaId={personaId ?? null}
        onInvited={() => void fetchEntries()}
      />
    </div>
  );
}

// ─── Experience panels ────────────────────────────────────────────────────────

interface ExperiencePanelActions {
  inviteOpen: boolean;
  inviteInput: string;
  onInviteToggle: () => void;
  onInviteInputChange: (next: string) => void;
  onInviteSubmit: () => void;
  onInviteCancel: () => void;
  onDelete: (id: string) => void;
  onShare: () => void;
  onRemix: () => void;
}

function ExperienceActionBar({
  entry,
  onRemix,
  onShare,
  onInviteToggle,
  onDelete,
  publishButton,
}: {
  entry: CanvasEntry;
  onRemix: () => void;
  onShare: () => void;
  onInviteToggle: () => void;
  onDelete: (id: string) => void;
  publishButton?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={onRemix}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 text-xs"
        title="Remix this experience"
      >
        <Sparkles className="w-3 h-3" /> Remix
      </button>
      {publishButton}
      <button
        type="button"
        onClick={onShare}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-violet-500/40 text-xs text-slate-300"
        title="Share"
      >
        <Share2 className="w-3 h-3" /> Share
      </button>
      <button
        type="button"
        onClick={onInviteToggle}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-violet-500/40 text-xs text-slate-300"
        title="Invite (stub — acceptance flow coming later)"
      >
        <UserPlus className="w-3 h-3" /> Invite
      </button>
      <button
        type="button"
        onClick={() => onDelete(entry.id)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-600 hover:border-rose-500/50 text-xs text-slate-300 hover:text-rose-200"
      >
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </div>
  );
}

function InviteBar({
  inviteInput,
  onInviteInputChange,
  onInviteSubmit,
  onInviteCancel,
}: Pick<ExperiencePanelActions, "inviteInput" | "onInviteInputChange" | "onInviteSubmit" | "onInviteCancel">) {
  return (
    <div className="p-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/40">
      <input
        type="text"
        value={inviteInput}
        onChange={(e) => onInviteInputChange(e.target.value)}
        placeholder="invitedPersonaId — stub; real invite flow lands later"
        className="flex-1 px-2 py-1.5 rounded border border-slate-700 bg-slate-900 text-slate-100 text-xs focus:border-violet-500/60 focus:outline-none"
      />
      <button
        type="button"
        onClick={onInviteSubmit}
        disabled={!inviteInput.trim()}
        className="flex items-center gap-1 px-2 py-1 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 text-xs disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onInviteCancel}
        className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function ExperienceOriginPanel({
  entry,
  hydration,
  inviteOpen,
  inviteInput,
  onInviteToggle,
  onInviteInputChange,
  onInviteSubmit,
  onInviteCancel,
  onDelete,
  onShare,
  onRemix,
}: { entry: CanvasEntry; hydration: { status: "loading" | "ok" | "error"; code?: number } | null } & ExperiencePanelActions) {
  const experienceId =
    typeof entry.metaJson.experienceId === "string" ? entry.metaJson.experienceId : null;
  const imageUrl =
    typeof entry.metaJson.imageUrl === "string" ? entry.metaJson.imageUrl : null;
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
            Origin Experience
          </span>
        </div>
        <ExperienceActionBar
          entry={entry}
          onRemix={onRemix}
          onShare={onShare}
          onInviteToggle={onInviteToggle}
          onDelete={onDelete}
        />
      </div>
      {inviteOpen && (
        <InviteBar
          inviteInput={inviteInput}
          onInviteInputChange={onInviteInputChange}
          onInviteSubmit={onInviteSubmit}
          onInviteCancel={onInviteCancel}
        />
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-100 leading-tight">{entry.title}</h2>
          {entry.bodyMd ? (
            <ListenButton getText={() => `${entry.title}. ${entry.bodyMd}`} />
          ) : null}
        </div>
        <HydrationIndicator hydration={hydration} />
        {imageUrl && (
          <img
            src={imageUrl}
            alt={entry.title}
            className="w-full rounded-xl border border-white/10 object-cover max-h-56"
            loading="lazy"
          />
        )}
        {entry.bodyMd ? (
          <article className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
            {entry.bodyMd}
          </article>
        ) : hydration?.status !== "loading" ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[12px] text-amber-200/80 leading-relaxed">
            This is the source Experience Qube you remixed from. Visit the runtime to re-experience it.
          </div>
        ) : null}
        {experienceId && (
          <div className="text-[10px] text-slate-600 font-mono break-all">
            ref: {experienceId}
          </div>
        )}
      </div>
    </div>
  );
}

function ExperienceDerivedPanel({
  entry,
  personaId,
  hydration,
  inviteOpen,
  inviteInput,
  onInviteToggle,
  onInviteInputChange,
  onInviteSubmit,
  onInviteCancel,
  onDelete,
  onShare,
  onRemix,
  onPublish,
}: {
  entry: CanvasEntry;
  personaId: string | null;
  hydration: { status: "loading" | "ok" | "error"; code?: number } | null;
  onPublish: () => Promise<{ ok: boolean; error?: string }>;
} & ExperiencePanelActions) {
  const imageUrl =
    typeof entry.metaJson.imageUrl === "string" ? entry.metaJson.imageUrl : null;
  const skill =
    typeof entry.metaJson.skill === "string" ? entry.metaJson.skill : null;
  const contentId =
    typeof entry.metaJson.contentId === "string" ? entry.metaJson.contentId : null;
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const handlePublishClick = useCallback(async () => {
    setPublishing(true);
    setPublishError(null);
    const res = await onPublish();
    setPublishing(false);
    if (!res.ok) {
      setPublishError(res.error ?? "Publish failed");
      return;
    }
    setPublished(true);
  }, [onPublish]);
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between gap-2 flex-wrap">
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
        <ExperienceActionBar
          entry={entry}
          onRemix={onRemix}
          onShare={onShare}
          onInviteToggle={onInviteToggle}
          onDelete={onDelete}
          publishButton={
            contentId ? (
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={publishing || published || !personaId}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-semibold transition disabled:opacity-50 ${
                  published
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100"
                }`}
                title={!personaId ? "Sign in to publish" : "Publish to KNYT / Qriptopian community tabs"}
              >
                {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : published ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                {published ? "Published" : "Publish"}
              </button>
            ) : null
          }
        />
      </div>
      {inviteOpen && (
        <InviteBar
          inviteInput={inviteInput}
          onInviteInputChange={onInviteInputChange}
          onInviteSubmit={onInviteSubmit}
          onInviteCancel={onInviteCancel}
        />
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {publishError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {publishError}
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-100 leading-tight">{entry.title}</h2>
          {entry.bodyMd ? (
            <ListenButton getText={() => `${entry.title}. ${entry.bodyMd}`} />
          ) : null}
        </div>
        <HydrationIndicator hydration={hydration} />
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

function HydrationIndicator({
  hydration,
}: {
  hydration: { status: "loading" | "ok" | "error"; code?: number } | null;
}) {
  if (!hydration) {
    return (
      <div className="text-[10px] text-slate-600 italic">no hydration attempted</div>
    );
  }
  if (hydration.status === "loading") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading full entry…
      </div>
    );
  }
  if (hydration.status === "error") {
    return (
      <div className="text-[11px] text-rose-300">
        Hydration failed{hydration.code ? ` (HTTP ${hydration.code})` : ""}. Check the Network tab for the GET response.
      </div>
    );
  }
  return null;
}

export default MyCanvasTab;
