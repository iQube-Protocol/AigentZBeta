"use client";

/**
 * RuntimeQubeTalkDrawer — metaMe Runtime's People + Conversations workbench
 * (QubeTalk Fast-Follow, Runtime fan-out: "Runtime becomes the QubeTalk
 * workbench" — richer/full versions of the surfaces already established
 * compactly in aigentMe).
 *
 * FAN-OUT, NOT A FORK: the People tab consumes the exact same
 * `useContactGraphPeople` hook aigentMe's PeopleLayout uses
 * (components/metame/contactgraph/useContactGraphPeople.ts) — same
 * /api/contactgraph/* routes, same ContactGraph state. The Conversations
 * tab mounts the SAME QubeTalkInboxTab aigentMe's ConversationsLayout
 * mounts, with its own `domainFilter` scope. There is no
 * RuntimeContacts/AigentMeContacts split — one capability, two
 * presentations (C13: ContactGraph/QubeTalk are contained capabilities,
 * not owned by any one surface).
 *
 * Follows this repo's existing drawer idiom (see
 * components/iqube/ConnectionsIQubeDrawer.tsx / MemoryIQubeDrawer.tsx) —
 * fixed backdrop + right-entering panel — rather than aigentMe's
 * Capsule/LayoutShell chrome, matching how Runtime's own UI shell already
 * works (drawers, not a split-pane Capsule system). Wider than a compact
 * iQube drawer (`max-w-3xl` vs `max-w-sm`) — Runtime has the layout
 * latitude to show the full two-pane list/detail surface at readable
 * width, per the operator's explicit "Runtime may provide richer/full
 * versions... because it has considerably more layout freedom."
 *
 * SLATE house style throughout (border-slate-800, bg-slate-900/40 — never
 * the residual white-hairline pattern still present in some neighboring
 * drawer files).
 */

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Loader2, Megaphone, MessageCircle, MessagesSquare, Plus, Radio, Star, User, Users, X, X as XIcon } from "lucide-react";
import { useContactGraphPeople, CONTACT_PLATFORM_LABEL, fetchJson } from "@/components/metame/contactgraph/useContactGraphPeople";
import type { ContactEndpointPlatform } from "@/types/contactGraph";
import { CONTACT_ENDPOINT_PLATFORMS } from "@/types/contactGraph";
import type { PendingShareArtifact } from "@/components/composer/QubeTalkInboxTab";

const QubeTalkInboxTab = dynamic(() => import("@/components/composer/QubeTalkInboxTab"), {
  ssr: false,
  loading: () => <span className="text-xs text-slate-500">Loading conversations…</span>,
});

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which tab to land on when the drawer opens — e.g. the Share seam
   *  opening straight into Conversations for a specific person. */
  initialTab?: "people" | "conversations" | "publishing" | "engagement";
  /** A content item in context when the drawer was opened (Runtime's Share
   *  menu invoked while a capsule/content item was active). Threaded to
   *  QubeTalkInboxTab's own pending-share banner — reuses the EXISTING
   *  shareArtifact machinery, never a second sharing mechanism (§9). */
  pendingShareArtifact?: PendingShareArtifact | null;
  onShareArtifactHandled?: () => void;
  /** Content in context when Publish was invoked — pre-fills the Publishing
   *  tab's draft form (Share -> Publish, mirroring pendingShareArtifact). */
  pendingPublishArtifact?: { title: string; body?: string | null; sourceContentRef?: string | null } | null;
  onPublishArtifactHandled?: () => void;
}

function confidenceBadgeClass(confidence: string): string {
  if (confidence === "verified" || confidence === "user_confirmed") return "bg-emerald-500/15 text-emerald-400";
  if (confidence === "high_confidence") return "bg-sky-500/15 text-sky-400";
  return "bg-slate-800 text-slate-500";
}

function RuntimePeoplePanel({ onMessagePerson }: { onMessagePerson: (personId: string) => void }) {
  const {
    filteredPeople,
    listLoading,
    listError,
    query,
    setQuery,
    creatingPerson,
    newPersonName,
    setNewPersonName,
    handleCreatePerson,
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    detailError,
    busyEndpointId,
    handleEndpointAction,
    addingContextFor,
    setAddingContextFor,
    newContextLabel,
    setNewContextLabel,
    handleAddContext,
    addingHandleFor,
    setAddingHandleFor,
    newHandlePlatform,
    setNewHandlePlatform,
    newHandleIdentifier,
    setNewHandleIdentifier,
    handleAddHandle,
  } = useContactGraphPeople();

  const [messaging, setMessaging] = useState(false);
  const [messagingError, setMessagingError] = useState<string | null>(null);

  const handleMessage = useCallback(async () => {
    if (!selectedId) return;
    setMessaging(true);
    setMessagingError(null);
    const result = await fetchJson<{ channel: { id: string; kind?: "platform_peer_channel" | "offplatform_contact" } }>(
      `/api/qubetalk/people/${selectedId}/channel`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    setMessaging(false);
    if (!result.ok) {
      setMessagingError(result.error);
      return;
    }
    // The Conversations tab (QubeTalkInboxTab) only knows how to render a
    // `passport_peer_channels` row — an `offplatform_contact` id is not one,
    // so navigating there would silently 404 every panel fetch. Until that
    // surface gets its own off-platform relationship view (named follow-up,
    // P0.5), surface a clear message instead of a broken navigation.
    if (result.data.channel.kind === "offplatform_contact") {
      setMessagingError("Relationship saved. This contact isn't linked to a platform persona yet, so a full conversation view isn't available for them yet.");
      return;
    }
    onMessagePerson(result.data.channel.id);
  }, [selectedId, onMessagePerson]);

  return (
    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      {/* People list */}
      <div className="space-y-2 md:border-r md:border-slate-800 md:pr-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
        />
        <div className="space-y-1.5">
          {listLoading && (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading people…
            </div>
          )}
          {listError && <div className="px-2 py-3 text-xs text-rose-400">{listError}</div>}
          {!listLoading && !listError && filteredPeople.length === 0 && (
            <div className="px-2 py-3 text-xs text-slate-500">No people yet. Add one below, or import contacts.</div>
          )}
          {filteredPeople.map((p) => (
            <button
              key={p.contactPersonId}
              onClick={() => setSelectedId(p.contactPersonId)}
              className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                selectedId === p.contactPersonId
                  ? "border-indigo-500/50 bg-indigo-500/10 text-slate-100"
                  : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{p.displayName}</span>
                {p.preferredEndpointPlatform && (
                  <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {CONTACT_PLATFORM_LABEL[p.preferredEndpointPlatform]}
                  </span>
                )}
              </div>
              {p.personaLabels.length > 0 && <div className="mt-1 truncate text-[10px] text-slate-500">{p.personaLabels.join(" · ")}</div>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1.5">
          <input
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreatePerson()}
            placeholder="Add a person…"
            className="flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
          <button
            onClick={() => void handleCreatePerson()}
            disabled={creatingPerson || !newPersonName.trim()}
            className="shrink-0 rounded p-1 text-slate-400 hover:text-indigo-400 disabled:opacity-40"
            aria-label="Add person"
          >
            {creatingPerson ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Person detail — Runtime has room for the full picture (§12): person, personas, handles, relationship */}
      <div className="overflow-y-auto">
        {!selectedId && (
          <div className="flex h-full min-h-[280px] items-center justify-center rounded-md border border-slate-800 bg-slate-950/50 px-3 py-10 text-sm text-slate-500">
            Select a person to inspect their full person / persona / handle / relationship picture.
          </div>
        )}
        {selectedId && detailLoading && (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        )}
        {selectedId && detailError && <div className="px-2 py-3 text-xs text-rose-400">{detailError}</div>}
        {selectedId && detail && !detailLoading && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-slate-100">{detail.person.displayName}</div>
                {detail.person.linkedPersonhoodRef && <div className="text-[11px] text-slate-500">Linked to a platform persona</div>}
              </div>
              <button
                onClick={() => void handleMessage()}
                disabled={messaging}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50"
              >
                {messaging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                Message
              </button>
            </div>
            {messagingError && (
              <div className="rounded-md border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                {messagingError}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Personas</div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {detail.personas.map((persona) => (
                  <div key={persona.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-200">{persona.label}</span>
                      <button
                        onClick={() => setAddingHandleFor(addingHandleFor === persona.id ? null : persona.id)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300"
                      >
                        + Handle
                      </button>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {persona.endpoints.length === 0 && <div className="text-[11px] text-slate-500">No handles yet.</div>}
                      {persona.endpoints.map((ep) => (
                        <div key={ep.id} className="flex items-center justify-between gap-1.5 rounded bg-slate-900/60 px-2 py-1.5 text-xs">
                          <div className="min-w-0 flex-1">
                            <span className="text-slate-500">{CONTACT_PLATFORM_LABEL[ep.platform]}: </span>
                            <span className="text-slate-300">{ep.identifier}</span>
                            {ep.isPreferred && <Star className="ml-1 inline h-3 w-3 fill-amber-400 text-amber-400" />}
                            <span className={`ml-1.5 rounded px-1 text-[10px] ${confidenceBadgeClass(ep.confidence)}`}>{ep.confidence.replace("_", " ")}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {busyEndpointId === ep.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                            ) : (
                              <>
                                {ep.confidence !== "verified" && ep.confidence !== "user_confirmed" && (
                                  <>
                                    <button title="Confirm" onClick={() => void handleEndpointAction(ep.id, { action: "confirm" })} className="text-emerald-400 hover:text-emerald-300">
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button title="Reject" onClick={() => void handleEndpointAction(ep.id, { action: "reject" })} className="text-rose-400 hover:text-rose-300">
                                      <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                {!ep.isPreferred && (
                                  <button title="Mark preferred" onClick={() => void handleEndpointAction(ep.id, { action: "setPreferred" })} className="text-slate-500 hover:text-amber-400">
                                    <Star className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {detail.personas.length > 1 && (
                                  <select
                                    title="Move to another persona"
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) void handleEndpointAction(ep.id, { action: "reassign", toContactPersonaId: e.target.value });
                                      e.target.value = "";
                                    }}
                                    className="rounded border-none bg-transparent text-[11px] text-slate-500"
                                  >
                                    <option value="" disabled>
                                      Move…
                                    </option>
                                    {detail.personas
                                      .filter((other) => other.id !== persona.id)
                                      .map((other) => (
                                        <option key={other.id} value={other.id}>
                                          Move to {other.label}
                                        </option>
                                      ))}
                                  </select>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {addingHandleFor === persona.id && (
                      <div className="mt-2 flex items-center gap-1">
                        <select
                          value={newHandlePlatform}
                          onChange={(e) => setNewHandlePlatform(e.target.value as ContactEndpointPlatform)}
                          className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-300"
                        >
                          {CONTACT_ENDPOINT_PLATFORMS.map((p) => (
                            <option key={p} value={p}>
                              {CONTACT_PLATFORM_LABEL[p]}
                            </option>
                          ))}
                        </select>
                        <input
                          value={newHandleIdentifier}
                          onChange={(e) => setNewHandleIdentifier(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && void handleAddHandle(persona.id)}
                          placeholder="handle…"
                          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 outline-none"
                        />
                        <button onClick={() => void handleAddHandle(persona.id)} className="text-indigo-400 hover:text-indigo-300">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {addingContextFor ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={newContextLabel}
                    onChange={(e) => setNewContextLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleAddContext()}
                    placeholder="e.g. Professional, Horizon…"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                  <button onClick={() => void handleAddContext()} className="shrink-0 text-indigo-400 hover:text-indigo-300">
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setAddingContextFor(true)} className="text-[11px] text-indigo-400 hover:text-indigo-300">
                  + Add persona/context
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Relationship</div>
              <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-500">
                {detail.linkedQubeTalkParticipants.length > 0
                  ? `${detail.linkedQubeTalkParticipants.length} linked QubeTalk conversation participant${detail.linkedQubeTalkParticipants.length === 1 ? "" : "s"}. Open the Conversations tab to see relationship history, open loops, and shared context.`
                  : "No QubeTalk conversations linked to this person yet."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PublicationRow {
  id: string;
  title: string;
  body: string | null;
  status: string;
  createdAt: string;
}
interface ProjectionRow {
  id: string;
  publicationId: string;
  channel: string;
  destinationRef: string | null;
  externalPublicationId: string | null;
  projectionStatus: string;
  url: string | null;
}

function projectionStatusClass(status: string): string {
  if (status === "published") return "bg-emerald-500/15 text-emerald-400";
  if (status === "failed") return "bg-rose-500/15 text-rose-400";
  if (status === "publishing") return "bg-sky-500/15 text-sky-400";
  return "bg-slate-800 text-slate-500";
}
function publicationStatusClass(status: string): string {
  if (status === "published") return "bg-emerald-500/15 text-emerald-400";
  if (status === "partially_published") return "bg-amber-500/15 text-amber-400";
  if (status === "failed") return "bg-rose-500/15 text-rose-400";
  if (status === "withdrawn") return "bg-slate-800 text-slate-500";
  return "bg-slate-800 text-slate-400";
}

interface PendingPublishArtifact {
  title: string;
  body?: string | null;
  sourceContentRef?: string | null;
}

/** Publishing tab — inspect canonical publication, choose destinations, see
 *  per-destination status, publish/withdraw (§3/§6/§13). Discord is the
 *  only offered channel — the only transport transportRegistry.ts actually
 *  marks 'restricted' for post.publish; offering anything else would only
 *  ever bounce off an honest 'transport_unsupported' failure. */
export function RuntimePublishingPanel({
  pendingPublishArtifact,
  onPublishArtifactHandled,
}: {
  pendingPublishArtifact?: PendingPublishArtifact | null;
  onPublishArtifactHandled?: () => void;
}) {
  const [publications, setPublications] = useState<PublicationRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projections, setProjections] = useState<ProjectionRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);

  const [destinationRef, setDestinationRef] = useState("");
  const [addingDestination, setAddingDestination] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const result = await fetchJson<{ publications: PublicationRow[] }>("/api/qubetalk/publications");
    setListLoading(false);
    if (result.ok) setPublications(result.data.publications);
    else setListError(result.error);
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);

  useEffect(() => {
    if (pendingPublishArtifact) {
      setNewTitle(pendingPublishArtifact.title);
      setNewBody(pendingPublishArtifact.body || "");
    }
  }, [pendingPublishArtifact]);

  const loadDetail = useCallback(async (publicationId: string) => {
    setSelectedId(publicationId);
    setDetailLoading(true);
    setActionError(null);
    const result = await fetchJson<{ projections: ProjectionRow[] }>(`/api/qubetalk/publications/${publicationId}`);
    setDetailLoading(false);
    if (result.ok) setProjections(result.data.projections);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setActionError(null);
    const result = await fetchJson<{ publication: PublicationRow }>("/api/qubetalk/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() || undefined, sourceContentRef: pendingPublishArtifact?.sourceContentRef }),
    });
    setCreating(false);
    if (result.ok) {
      setNewTitle("");
      setNewBody("");
      onPublishArtifactHandled?.();
      await loadList();
      await loadDetail(result.data.publication.id);
    } else {
      setActionError(result.error);
    }
  }, [newTitle, newBody, pendingPublishArtifact, onPublishArtifactHandled, loadList, loadDetail]);

  const handleAddDestination = useCallback(async () => {
    if (!selectedId || !destinationRef.trim()) return;
    setAddingDestination(true);
    setActionError(null);
    const result = await fetchJson(`/api/qubetalk/publications/${selectedId}/projections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "discord", destinationRef: destinationRef.trim() }),
    });
    setAddingDestination(false);
    if (result.ok) {
      setDestinationRef("");
      await loadDetail(selectedId);
    } else {
      setActionError(result.error);
    }
  }, [selectedId, destinationRef, loadDetail]);

  const handlePublish = useCallback(async () => {
    if (!selectedId) return;
    setPublishing(true);
    setActionError(null);
    const result = await fetchJson(`/api/qubetalk/publications/${selectedId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setPublishing(false);
    if (result.ok) {
      await loadList();
      await loadDetail(selectedId);
    } else {
      setActionError(result.error);
    }
  }, [selectedId, loadList, loadDetail]);

  const selected = publications.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <div className="space-y-2 md:border-r md:border-slate-800 md:pr-4">
        <div className="space-y-1.5">
          {listLoading && (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading publications…
            </div>
          )}
          {listError && <div className="px-2 py-3 text-xs text-rose-400">{listError}</div>}
          {!listLoading && !listError && publications.length === 0 && (
            <div className="px-2 py-3 text-xs text-slate-500">No publications yet. Draft one below.</div>
          )}
          {publications.map((p) => (
            <button
              key={p.id}
              onClick={() => void loadDetail(p.id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                selectedId === p.id ? "border-indigo-500/50 bg-indigo-500/10 text-slate-100" : "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{p.title}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${publicationStatusClass(p.status)}`}>{p.status.replace("_", " ")}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="space-y-1.5 rounded-md border border-slate-800 bg-slate-950/50 p-2.5">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title…"
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Excerpt / caption text…"
            rows={2}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
          <button
            onClick={() => void handleCreate()}
            disabled={creating || !newTitle.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-indigo-500/40 bg-indigo-500/10 px-2 py-1.5 text-[11px] text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Draft publication
          </button>
        </div>
      </div>

      <div className="overflow-y-auto">
        {!selectedId && (
          <div className="flex h-full min-h-[280px] items-center justify-center rounded-md border border-slate-800 bg-slate-950/50 px-3 py-10 text-sm text-slate-500">
            Select a publication, or draft a new one.
          </div>
        )}
        {selectedId && detailLoading && (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        )}
        {selectedId && selected && !detailLoading && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="truncate text-base font-semibold text-slate-100">{selected.title}</div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${publicationStatusClass(selected.status)}`}>{selected.status.replace("_", " ")}</span>
              </div>
              {selected.body && <div className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{selected.body}</div>}
            </div>

            {actionError && (
              <div className="rounded-md border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">{actionError}</div>
            )}

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Destinations</div>
              {projections.length === 0 && <div className="text-[11px] text-slate-500">No destinations yet.</div>}
              {projections.map((proj) => (
                <div key={proj.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-300">Discord</span>
                    <span className="ml-1.5 text-slate-500">{proj.destinationRef}</span>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${projectionStatusClass(proj.projectionStatus)}`}>{proj.projectionStatus}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={destinationRef}
                  onChange={(e) => setDestinationRef(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleAddDestination()}
                  placeholder="Discord channel id or invite…"
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
                />
                <button onClick={() => void handleAddDestination()} disabled={addingDestination || !destinationRef.trim()} className="shrink-0 text-indigo-400 hover:text-indigo-300 disabled:opacity-40">
                  {addingDestination ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => void handlePublish()}
              disabled={publishing || projections.length === 0}
              className="flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />} Publish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface EngagementRow {
  id: string;
  publicationProjectionId: string;
  engagementType: string;
  authorRawHandle: string | null;
  body: string | null;
  state: string;
  convertedConversationId: string | null;
  createdAt: string;
}

/**
 * Engagement tab — "show me responses that need me" (§10). Same
 * listEngagementsForOwner service function aigentMe's compact seam would
 * call for the same question.
 *
 * "Move to conversation" (§9) creates a REAL ConversationQube
 * (public_thread topology, origin_engagement_id set both directions for
 * provenance) — the data model is complete and tested. It is deliberately
 * NOT wired to auto-open in the Conversations tab: QubeTalkInboxTab is
 * built around passport_peer_channels-anchored threads (one channel = one
 * counterparty), and a public_thread conversation created here has no
 * channel anchor (the commenter may not even be a resolved participant
 * yet) — extending QubeTalkInboxTab to also list/display free-standing
 * public_thread conversations is real UI work, out of scope for this pass.
 * The conversation id is shown inline instead of a broken navigation.
 */
export function RuntimeEngagementPanel() {
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchJson<{ engagements: EngagementRow[] }>("/api/qubetalk/engagements");
    setLoading(false);
    if (result.ok) setEngagements(result.data.engagements);
    else setError(result.error);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleConvert = useCallback(async (engagementId: string) => {
    setBusyId(engagementId);
    const result = await fetchJson<{ conversationId: string }>(`/api/qubetalk/engagements/${engagementId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setBusyId(null);
    if (result.ok) {
      await load();
    }
  }, [load]);

  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading engagements…
        </div>
      )}
      {error && <div className="px-2 py-3 text-xs text-rose-400">{error}</div>}
      {!loading && !error && engagements.length === 0 && (
        <div className="px-2 py-3 text-xs text-slate-500">No engagements yet — comments and replies on your publications will appear here.</div>
      )}
      {engagements.map((e) => (
        <div key={e.id} className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300">{e.authorRawHandle ?? "Unknown"}</span>
            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{e.engagementType}</span>
          </div>
          {e.body && <div className="mt-1 text-slate-400">{e.body}</div>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500">{e.state.replace(/_/g, " ")}</span>
            {e.convertedConversationId ? (
              <span className="text-[10px] text-slate-500" title={e.convertedConversationId}>
                Moved to conversation {e.convertedConversationId.slice(0, 8)}
              </span>
            ) : (
              <button onClick={() => void handleConvert(e.id)} disabled={busyId === e.id} className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40">
                {busyId === e.id ? "Converting…" : "Move to conversation"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RuntimeQubeTalkDrawer({
  open,
  onClose,
  initialTab = "people",
  pendingShareArtifact,
  onShareArtifactHandled,
  pendingPublishArtifact,
  onPublishArtifactHandled,
}: Props) {
  const [tab, setTab] = useState<"people" | "conversations" | "publishing" | "engagement">(initialTab);
  // Set when the People tab's "Message" action resolves (or the operator
  // was already mid-conversation) — handed straight to QubeTalkInboxTab so
  // the operator lands on the right channel rather than the auto-selected
  // first one (surface continuity: the SAME channel/conversation, not a
  // fresh pick, per the north-star "person -> endpoint -> relationship ->
  // conversation" chain).
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);

  return (
    <>
      <div
        className={`fixed inset-0 z-[69] bg-black/40 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Communications</span>
            <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 p-0.5">
              <button
                onClick={() => setTab("people")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab === "people" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users className="h-3.5 w-3.5" /> People
              </button>
              <button
                onClick={() => setTab("conversations")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab === "conversations" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessagesSquare className="h-3.5 w-3.5" /> Conversations
              </button>
              <button
                onClick={() => setTab("publishing")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab === "publishing" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Radio className="h-3.5 w-3.5" /> Publishing
              </button>
              <button
                onClick={() => setTab("engagement")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab === "engagement" ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Megaphone className="h-3.5 w-3.5" /> Engagement
              </button>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === "people" && (
            <RuntimePeoplePanel
              onMessagePerson={(channelId) => {
                setFocusedChannelId(channelId);
                setTab("conversations");
              }}
            />
          )}
          {tab === "conversations" && (
            <QubeTalkInboxTab
              domainFilter="runtime"
              initialChannelId={focusedChannelId}
              pendingShareArtifact={pendingShareArtifact}
              onShareArtifactHandled={onShareArtifactHandled}
            />
          )}
          {tab === "publishing" && (
            <RuntimePublishingPanel pendingPublishArtifact={pendingPublishArtifact} onPublishArtifactHandled={onPublishArtifactHandled} />
          )}
          {tab === "engagement" && <RuntimeEngagementPanel />}
        </div>
      </div>
    </>
  );
}
