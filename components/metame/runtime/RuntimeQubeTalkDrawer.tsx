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

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Loader2, MessagesSquare, Plus, Star, User, Users, X, X as XIcon } from "lucide-react";
import { useContactGraphPeople, CONTACT_PLATFORM_LABEL } from "@/components/metame/contactgraph/useContactGraphPeople";
import type { ContactEndpointPlatform } from "@/types/contactGraph";
import { CONTACT_ENDPOINT_PLATFORMS } from "@/types/contactGraph";

const QubeTalkInboxTab = dynamic(() => import("@/components/composer/QubeTalkInboxTab"), {
  ssr: false,
  loading: () => <span className="text-xs text-slate-500">Loading conversations…</span>,
});

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which tab to land on when the drawer opens — e.g. the Share seam
   *  opening straight into Conversations for a specific person. */
  initialTab?: "people" | "conversations";
}

function confidenceBadgeClass(confidence: string): string {
  if (confidence === "verified" || confidence === "user_confirmed") return "bg-emerald-500/15 text-emerald-400";
  if (confidence === "high_confidence") return "bg-sky-500/15 text-sky-400";
  return "bg-slate-800 text-slate-500";
}

function RuntimePeoplePanel() {
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
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-slate-100">{detail.person.displayName}</div>
                {detail.person.linkedPersonhoodRef && <div className="text-[11px] text-slate-500">Linked to a platform persona</div>}
              </div>
            </div>

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

export function RuntimeQubeTalkDrawer({ open, onClose, initialTab = "people" }: Props) {
  const [tab, setTab] = useState<"people" | "conversations">(initialTab);

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
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === "people" ? <RuntimePeoplePanel /> : <QubeTalkInboxTab domainFilter="runtime" />}
        </div>
      </div>
    </>
  );
}
