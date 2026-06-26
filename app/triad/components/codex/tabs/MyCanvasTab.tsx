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

/**
 * Surface mode — distinguishes the two consumers of this component.
 *
 *   - 'canvas' (default): PUBLIC publishing surface. Entries default
 *     to visibility 'invited' (shareable) and the heading nudges the
 *     operator toward publishing to KNYT Pulse / Qriptopian Pulse.
 *   - 'workbench': PRIVATE working surface. Entries default to
 *     visibility 'private' and the heading frames the surface as
 *     internal work (partner briefs, reports, decks, drafts pre-
 *     publication). Entries are stamped metaJson.surface='workbench'
 *     so the list filter can scope them separately from canvas
 *     entries.
 *
 * The two surfaces share the same backing /api/mycanvas/entries
 * endpoint and the same editor — only the defaults + chrome differ.
 * Per operator: 'myCanvas is for public publishing... myWorkbench
 * is for private confidential work'.
 */
// 2026-05-29 myArtifacts restructure:
//   - 'canvas'    — public-publishable experiences (default).
//   - 'workspace' — private work artifacts (docs, reports, tools,
//                   workflows, briefs). NEW. Separate kind value so
//                   work-artifact entries never leak into the public
//                   canvas list and vice versa.
//   - 'workbench' — legacy alias kept for back-compat with stamped
//                   metaJson.surface='workbench' rows from before the
//                   workspace split. Treated identically to 'workspace'
//                   at the entries-filter layer; will be retired in a
//                   follow-up migration that rewrites stamped rows to
//                   'workspace'.
type MyCanvasSurface = 'canvas' | 'workspace' | 'workbench';

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
  surface?: MyCanvasSurface;
}

export function MyCanvasTab({ personaId, theme = "dark", surface = 'canvas' }: Props) {
  // Internal alias: 'workspace' (new) and 'workbench' (legacy alias)
  // share the same private-entries codepath. The distinction will be
  // erased entirely once a follow-up migration rewrites stamped
  // metaJson.surface='workbench' rows to 'workspace'.
  const isWorkbench = surface === 'workspace' || surface === 'workbench';
  const [entries, setEntries] = useState<CanvasEntry[]>([]);
  // Surface-specific API base — strict separation, sibling tables:
  //   canvas    → /api/mycanvas/entries     (mycanvas_entries)
  //   workspace → /api/myworkspace/entries  (myworkspace_entries)
  // Eliminates the leaky meta_json.surface discriminator — entries
  // can no longer surface in the wrong tab regardless of how they
  // were stamped. canvas-only side endpoints (invite, publish-to-pulse)
  // stay rooted at /api/mycanvas since workspace items don't publish.
  const entriesApiBase = isWorkbench ? '/api/myworkspace/entries' : '/api/mycanvas/entries';
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

  /**
   * Consumer for the dispatch-from-elsewhere URL params (Phase F.1):
   *
   *   /codex/viewer?slug=metame&tab=mycanvas&remix=<encoded JSON>
   *   /codex/viewer?slug=metame&tab=my-workbench&draft=<encoded JSON>
   *
   * Both forms carry a payload of
   *   { source, specialistId, title, summary, recommendations }
   * from dispatchArtifact() in the welcome surface. When detected,
   * we auto-create an entry seeded with the payload + a metaJson
   * flag pointing back to the originator (specialist id / source).
   *
   * Runs once per personaId+surface and clears the URL param so a
   * refresh doesn't re-create the entry. Skipped when personaId
   * isn't ready yet (the create needs it).
   */
  const seededRef = useRef(false);
  useEffect(() => {
    if (!personaId || seededRef.current) return;
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const paramName = isWorkbench ? 'draft' : 'remix';
    const raw = url.searchParams.get(paramName);
    if (!raw) return;
    let payload: {
      source?: string;
      specialistId?: string;
      title?: string;
      summary?: string;
      recommendations?: string[];
    } | null = null;
    try {
      payload = JSON.parse(decodeURIComponent(raw));
    } catch {
      payload = null;
    }
    if (!payload || !payload.title) return;
    seededRef.current = true;
    const lines: string[] = [];
    if (payload.summary) lines.push(payload.summary, '');
    if (payload.recommendations && payload.recommendations.length > 0) {
      lines.push('## Recommendations', '');
      for (const r of payload.recommendations) lines.push(`- ${r}`);
    }
    void handleCreate({
      title: payload.title,
      bodyMd: lines.join('\n'),
      metaJson: {
        source: payload.source ?? 'unknown',
        specialistId: payload.specialistId ?? null,
        // Creator tag — flag the persona as the entry's creator so
        // the publishing surface (KNYT Pulse / Qriptopian Pulse)
        // can render the byline correctly. Operator: 'the surfaces
        // currently publish to does have Creator/created by field
        // which the user should be able to tag with their persona'.
        createdByPersonaId: personaId,
      },
    });
    // Clear the URL param so refresh doesn't re-seed.
    url.searchParams.delete(paramName);
    window.history.replaceState({}, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId, isWorkbench]);
  // Per-entry hydration state for visible diagnostics. Lets the right
  // panel show whether a fetch is in flight, errored, or finished
  // empty — so we can tell at a glance whether missing body content
  // is "fetch never fired", "fetch failed", or "entry truly empty".
  const [hydrationState, setHydrationState] = useState<Record<string, { status: "loading" | "ok" | "error"; code?: number }>>({});

  // Surface-aware list filter. Each entry's metaJson.surface is the
  // primary signal; if absent, fall back to 'canvas' (legacy entries
  // created before the workspace split was introduced). 'workspace'
  // and 'workbench' (legacy alias) share the same private-entries set,
  // so a stamped 'workbench' row surfaces under the new 'workspace'
  // tab and vice versa.
  const filteredEntries = entries.filter((e) => {
    const stamped = (e.metaJson as { surface?: string } | undefined)?.surface;
    const stampedIsPrivate = stamped === 'workbench' || stamped === 'workspace';
    const surfaceIsPrivate = surface === 'workbench' || surface === 'workspace';
    if (surfaceIsPrivate) return stampedIsPrivate;
    // surface === 'canvas' — only show entries that are NOT stamped
    // private. Legacy entries with no stamp default to canvas too.
    return !stampedIsPrivate;
  });

  const fetchEntries = useCallback(async () => {
    if (!personaId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(entriesApiBase, { personaIdHint: personaId });
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
        const res = await personaFetch(`${entriesApiBase}/${targetId}`, { personaIdHint: personaId });
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

  const handleCreate = useCallback(async (seed?: {
    title?: string;
    bodyMd?: string;
    metaJson?: Record<string, unknown>;
  }) => {
    if (!personaId) return;
    setCreating(true);
    setError(null);
    try {
      // Surface-aware defaults:
      //   workbench → private + metaJson.surface='workbench' so the
      //     list filter scopes correctly
      //   canvas    → invited + metaJson.surface='canvas' (or absent
      //     for legacy data which is treated as canvas)
      const defaultVisibility = isWorkbench ? 'private' : 'invited';
      const surfaceStamp = { surface, ...(seed?.metaJson ?? {}) };
      const res = await personaFetch(entriesApiBase, {
        personaIdHint: personaId,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: seed?.title ?? (
            isWorkbench
              ? (surface === 'workspace' ? 'Untitled workspace draft' : 'Untitled workbench draft')
              : 'Untitled draft'
          ),
          bodyMd: seed?.bodyMd ?? '',
          visibility: defaultVisibility,
          metaJson: surfaceStamp,
        }),
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
  }, [personaId, isWorkbench, surface]);

  const handleSave = useCallback(async () => {
    if (!personaId || !selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await personaFetch(`${entriesApiBase}/${selected.id}`, {
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

  /**
   * Generic entry-patch helper for in-panel edit affordances (Edit
   * button on experience_derived / experience_origin panels).
   * Operator-requested 2026-06-01: "add an edit button and capability
   * to the saved experiences in the users myCanvas shelf also so they
   * can also edit the artifact after saving it and before publishing".
   *
   * PATCHes the canvas-entries endpoint with the operator's patch,
   * merges the response into local state so the panel re-renders with
   * the latest content. The PATCH route already emits an
   * mycanvas_entry_updated activity_receipt server-side, so the edit
   * shows up in myLedger automatically.
   */
  const handleEntryEdit = useCallback(
    async (id: string, patch: { title?: string; bodyMd?: string }): Promise<{ ok: boolean; error?: string }> => {
      if (!personaId) return { ok: false, error: 'persona-required' };
      try {
        const res = await personaFetch(`${entriesApiBase}/${id}`, {
          personaIdHint: personaId,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return { ok: false, error: (body as { error?: string }).error ?? `HTTP ${res.status}` };
        }
        const data = (await res.json()) as { entry: CanvasEntry };
        setEntries((prev) => prev.map((e) => (e.id === data.entry.id ? data.entry : e)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [personaId, entriesApiBase],
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!personaId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this entry?")) return;
    try {
      const res = await personaFetch(`${entriesApiBase}/${id}`, {
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
      // Invite is canvas-only — workspace entries are private by design.
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
        // publish-to-pulse is canvas-only — workspace entries don't publish.
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
          <div className="p-3 border-b border-slate-700/50 flex items-start justify-between">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <PenSquare className="w-4 h-4 text-violet-400 shrink-0" />
                <h2 className="text-sm font-semibold leading-none">
                  {surface === 'workspace'
                    ? 'myWorkspace'
                    : surface === 'workbench'
                      ? 'myWorkbench'
                      : 'myCluster'}
                </h2>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 pl-6">
                {isWorkbench ? 'private · internal' : 'public · publishable'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleCreate()}
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
              <div className="p-3 space-y-3">
                <p className="text-xs text-slate-500 italic">
                  {surface === 'canvas'
                    ? 'No entries yet — start from a template below or hit New.'
                    : 'No entries yet — your private drafts live here.'}
                </p>
                {surface === 'canvas' && (
                  <button
                    type="button"
                    onClick={() => setRemixSource({
                      id: 'template-qriptopian-15min-sprint',
                      entryType: 'experience_origin',
                      title: 'Qriptopian Agents of Change — 15-min reading sprint',
                      bodyMd: '',
                      tags: ['template', 'qriptopian', 'reading-sprint'],
                      visibility: 'private',
                      metaJson: {
                        experienceId: 'exp_1773512145689_1vnt1jcnt',
                        sourceExperienceId: 'exp_1773512145689_1vnt1jcnt',
                        seedTemplate: 'qriptopian-agents-of-change-reading-sprint',
                      },
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    })}
                    className="w-full text-left rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2 hover:border-violet-500/60 hover:bg-violet-500/10 transition"
                  >
                    <div className="text-[11px] uppercase tracking-wider text-violet-400 mb-0.5">
                      Remix template
                    </div>
                    <div className="text-xs font-semibold text-white">
                      Qriptopian Agents of Change
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Guided 15-min reading sprint · article or story
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <ul>
                {filteredEntries.map((e) => (
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
            {/* Always-available "remix from template" affordance —
                visible on canvas surface in both empty + populated
                states. Short-term: hardcoded Qriptopian Agents of
                Change seed. Follow-up: pull a list of templates from
                a registry. */}
            {surface === 'canvas' && entries.length > 0 && (
              <div className="border-t border-slate-700/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                  Templates
                </p>
                <button
                  type="button"
                  onClick={() => setRemixSource({
                    id: 'template-qriptopian-15min-sprint',
                    entryType: 'experience_origin',
                    title: 'Qriptopian Agents of Change — 15-min reading sprint',
                    bodyMd: '',
                    tags: ['template', 'qriptopian', 'reading-sprint'],
                    visibility: 'private',
                    metaJson: {
                      experienceId: 'exp_1773512145689_1vnt1jcnt',
                      sourceExperienceId: 'exp_1773512145689_1vnt1jcnt',
                      seedTemplate: 'qriptopian-agents-of-change-reading-sprint',
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  })}
                  className="w-full text-left rounded-md border border-violet-500/30 bg-violet-500/5 px-2.5 py-1.5 hover:border-violet-500/60 hover:bg-violet-500/10 transition"
                >
                  <div className="text-[11px] font-semibold text-white">
                    Qriptopian Agents of Change
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    15-min reading sprint · remix
                  </div>
                </button>
              </div>
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
              onEdit={handleEntryEdit}
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
              onEdit={handleEntryEdit}
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
  /**
   * In-panel edit for saved experiences. Operator clicks Edit in the
   * action bar, panel body swaps to title + body textareas, Save edits
   * round-trips through PATCH /api/mycanvas/entries/[id]. Server emits
   * an mycanvas_entry_updated activity_receipt so the change shows up
   * in myLedger automatically.
   */
  onEdit?: (id: string, patch: { title?: string; bodyMd?: string }) => Promise<{ ok: boolean; error?: string }>;
}

function ExperienceActionBar({
  entry,
  onRemix,
  onShare,
  onInviteToggle,
  onDelete,
  onEdit,
  publishButton,
}: {
  entry: CanvasEntry;
  onRemix: () => void;
  onShare: () => void;
  onInviteToggle: () => void;
  onDelete: (id: string) => void;
  /** Toggle the panel into in-place edit mode. Not the save handler —
   *  the panel manages its own edit state and calls onEdit on Save. */
  onEdit?: () => void;
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
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 text-xs"
          title="Edit title and body before publishing"
        >
          <PenSquare className="w-3 h-3" /> Edit
        </button>
      )}
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
  onEdit,
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
  // In-panel edit state. Operator hits Edit in the action bar →
  // panel body swaps to title + body textareas → Save edits PATCHes
  // the entry and the server emits an mycanvas_entry_updated
  // activity_receipt so the change shows up in myLedger.
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editBody, setEditBody] = useState(entry.bodyMd);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Keep the local edit-form in sync if the parent reloads the entry.
  useEffect(() => {
    if (!editing) {
      setEditTitle(entry.title);
      setEditBody(entry.bodyMd);
    }
  }, [entry.id, entry.title, entry.bodyMd, editing]);
  const handleStartEdit = useCallback(() => {
    setEditTitle(entry.title);
    setEditBody(entry.bodyMd);
    setEditError(null);
    setEditing(true);
  }, [entry.title, entry.bodyMd]);
  const handleSaveEdit = useCallback(async () => {
    if (!onEdit) return;
    setSavingEdit(true);
    setEditError(null);
    const res = await onEdit(entry.id, { title: editTitle, bodyMd: editBody });
    setSavingEdit(false);
    if (!res.ok) {
      setEditError(res.error ?? 'Save failed');
      return;
    }
    setEditing(false);
  }, [onEdit, entry.id, editTitle, editBody]);
  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditTitle(entry.title);
    setEditBody(entry.bodyMd);
    setEditError(null);
  }, [entry.title, entry.bodyMd]);
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
          onEdit={onEdit && !editing ? handleStartEdit : undefined}
          publishButton={
            contentId ? (
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={publishing || published || !personaId || editing}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-semibold transition disabled:opacity-50 ${
                  published
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100"
                }`}
                title={
                  editing
                    ? 'Finish editing before publishing'
                    : !personaId
                      ? 'Sign in to publish'
                      : 'Publish to KNYT / Qriptopian community tabs'
                }
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
        {editing ? (
          <div className="space-y-3">
            {editError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {editError}
              </div>
            )}
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Title</span>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={savingEdit}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-900/60 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Body</span>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                disabled={savingEdit}
                rows={16}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-900/60 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50 font-mono disabled:opacity-50"
              />
            </label>
            {imageUrl && (
              <img
                src={imageUrl}
                alt={entry.title}
                className="w-full rounded-xl border border-white/10 object-cover max-h-56"
                loading="lazy"
              />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={savingEdit || editTitle.trim().length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-40"
              >
                {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save edits
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
              >
                Cancel
              </button>
              <span className="text-[10px] text-slate-500 ml-auto">DVN-receipted on save</span>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
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
