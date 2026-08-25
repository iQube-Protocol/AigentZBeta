"use client";

/**
 * PeopleLayout — aigentMe's first ContactGraph consumer (QubeTalk
 * Fast-Follow, priority step 3: "People + Conversations must be real").
 *
 * A self-contained two-pane list/detail surface (mirrors
 * components/composer/QubeTalkInboxTab.tsx's own shape rather than
 * threading person-list state through AigentMeWelcomeSplitTab's already
 * large layoutProps object — QubeTalkInboxTab already proves that pattern
 * for a comparably-shaped surface in this codebase).
 *
 * Every read/write goes through /api/contactgraph/* (personaFetch, spine-
 * authed) → services/contactGraph/*.ts. This component NEVER reads
 * contact_persons/contact_personas/contact_endpoints directly, and never
 * re-implements confidence/provenance logic that already lives server-side
 * — it only renders what those routes return and dispatches the operator's
 * explicit actions (confirm / reject / reassign / mark preferred / add).
 *
 * DIS template id: `people-layout-v1`.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { User, Users, Plus, Check, X as XIcon, Star, Loader2 } from "lucide-react";
import { LayoutShell } from "./LayoutShell";
import { personaFetch } from "@/utils/personaSpine";
import type { RightPaneLayoutDefinition, RightPaneLayoutProps } from "./types";
import type {
  ContactEndpoint,
  ContactEndpointPlatform,
  ContactGraphProjectionPersonSummary,
  ContactPersona,
  ContactPerson,
} from "@/types/contactGraph";
import { CONTACT_ENDPOINT_PLATFORMS } from "@/types/contactGraph";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await personaFetch(url, init);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) return { ok: false, error: body?.error ?? `request failed (${res.status})` };
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

type PersonaWithEndpoints = ContactPersona & { endpoints: ContactEndpoint[] };

interface PersonDetail {
  person: ContactPerson;
  personas: PersonaWithEndpoints[];
  linkedQubeTalkParticipants: unknown[];
}

const PLATFORM_LABEL: Record<ContactEndpointPlatform, string> = {
  metame: "metaMe",
  email: "Email",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  signal: "Signal",
  linkedin: "LinkedIn",
  discord: "Discord",
  x: "X",
  sms: "SMS",
};

function PeopleLayoutComponent(props: RightPaneLayoutProps) {
  const { theme = "dark", onRequestLayout } = props;
  const isDark = theme === "dark";

  const [people, setPeople] = useState<ContactGraphProjectionPersonSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busyEndpointId, setBusyEndpointId] = useState<string | null>(null);

  const [addingContextFor, setAddingContextFor] = useState(false);
  const [newContextLabel, setNewContextLabel] = useState("");
  const [addingHandleFor, setAddingHandleFor] = useState<string | null>(null); // contactPersonaId
  const [newHandlePlatform, setNewHandlePlatform] = useState<ContactEndpointPlatform>("email");
  const [newHandleIdentifier, setNewHandleIdentifier] = useState("");

  const loadPeople = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const result = await fetchJson<{ people: ContactGraphProjectionPersonSummary[] }>("/api/contactgraph/people");
    if (result.ok) setPeople(result.data.people);
    else setListError(result.error);
    setListLoading(false);
  }, []);

  const loadDetail = useCallback(async (personId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    const result = await fetchJson<PersonDetail>(`/api/contactgraph/people/${personId}`);
    if (result.ok) setDetail(result.data);
    else setDetailError(result.error);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [people, query]);

  const handleCreatePerson = useCallback(async () => {
    const displayName = newPersonName.trim();
    if (!displayName) return;
    setCreatingPerson(true);
    const result = await fetchJson<{ person: ContactPerson }>("/api/contactgraph/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    setCreatingPerson(false);
    if (result.ok) {
      setNewPersonName("");
      await loadPeople();
      setSelectedId(result.data.person.id);
    }
  }, [newPersonName, loadPeople]);

  const handleAddContext = useCallback(async () => {
    if (!selectedId) return;
    const label = newContextLabel.trim();
    if (!label) return;
    const result = await fetchJson(`/api/contactgraph/people/${selectedId}/personas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (result.ok) {
      setNewContextLabel("");
      setAddingContextFor(false);
      await loadDetail(selectedId);
    }
  }, [selectedId, newContextLabel, loadDetail]);

  const handleAddHandle = useCallback(
    async (contactPersonaId: string) => {
      const identifier = newHandleIdentifier.trim();
      if (!identifier || !selectedId) return;
      const result = await fetchJson(`/api/contactgraph/personas/${contactPersonaId}/endpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: newHandlePlatform, identifier }),
      });
      if (result.ok) {
        setNewHandleIdentifier("");
        setAddingHandleFor(null);
        await loadDetail(selectedId);
        await loadPeople();
      }
    },
    [newHandleIdentifier, newHandlePlatform, selectedId, loadDetail, loadPeople],
  );

  const handleEndpointAction = useCallback(
    async (endpointId: string, body: Record<string, unknown>) => {
      if (!selectedId) return;
      setBusyEndpointId(endpointId);
      const result = await fetchJson(`/api/contactgraph/endpoints/${endpointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setBusyEndpointId(null);
      if (result.ok) {
        await loadDetail(selectedId);
        await loadPeople();
      }
    },
    [selectedId, loadDetail, loadPeople],
  );

  const rowClass = (active: boolean) =>
    `w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
      active
        ? "border-indigo-500/50 bg-indigo-500/10 text-slate-100"
        : isDark
          ? "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    }`;

  const cardClass = isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50";
  const mutedClass = isDark ? "text-slate-500" : "text-slate-400";
  const inputClass = `w-full rounded-md border px-2 py-1.5 text-xs outline-none ${
    isDark ? "border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-600" : "border-slate-300 bg-white text-slate-800"
  }`;

  const body = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(200px,280px)_1fr]">
      {/* People list */}
      <div className="space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className={inputClass}
        />
        <div className="space-y-1.5">
          {listLoading && (
            <div className={`flex items-center gap-2 px-2 py-3 text-xs ${mutedClass}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading people…
            </div>
          )}
          {listError && <div className="px-2 py-3 text-xs text-rose-400">{listError}</div>}
          {!listLoading && !listError && filteredPeople.length === 0 && (
            <div className={`px-2 py-3 text-xs ${mutedClass}`}>No people yet. Add one below, or import contacts.</div>
          )}
          {filteredPeople.map((p) => (
            <button key={p.contactPersonId} onClick={() => setSelectedId(p.contactPersonId)} className={rowClass(selectedId === p.contactPersonId)}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{p.displayName}</span>
                {p.preferredEndpointPlatform && (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                    {PLATFORM_LABEL[p.preferredEndpointPlatform]}
                  </span>
                )}
              </div>
              {p.personaLabels.length > 0 && (
                <div className={`mt-1 truncate text-[10px] ${mutedClass}`}>{p.personaLabels.join(" · ")}</div>
              )}
            </button>
          ))}
        </div>
        <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${cardClass}`}>
          <input
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreatePerson()}
            placeholder="Add a person…"
            className={`flex-1 bg-transparent text-xs outline-none ${isDark ? "text-slate-200 placeholder:text-slate-600" : "text-slate-800"}`}
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

      {/* Person detail */}
      <div>
        {!selectedId && (
          <div className={`flex h-full min-h-[240px] items-center justify-center rounded-md border px-3 py-10 text-xs ${cardClass} ${mutedClass}`}>
            Select a person to view personas, handles, and relationship.
          </div>
        )}
        {selectedId && detailLoading && (
          <div className={`flex items-center gap-2 px-2 py-3 text-xs ${mutedClass}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        )}
        {selectedId && detailError && <div className="px-2 py-3 text-xs text-rose-400">{detailError}</div>}
        {selectedId && detail && !detailLoading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                <User className="h-4 w-4 text-slate-400" />
              </div>
              <div className="min-w-0">
                <div className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{detail.person.displayName}</div>
                {detail.person.linkedPersonhoodRef && (
                  <div className={`text-[10px] ${mutedClass}`}>Linked to a platform persona</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${mutedClass}`}>Personas</div>
              {detail.personas.map((persona) => (
                <div key={persona.id} className={`rounded-md border p-2.5 ${cardClass}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>{persona.label}</span>
                    <button
                      onClick={() => setAddingHandleFor(addingHandleFor === persona.id ? null : persona.id)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      + Handle
                    </button>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {persona.endpoints.length === 0 && <div className={`text-[10px] ${mutedClass}`}>No handles yet.</div>}
                    {persona.endpoints.map((ep) => (
                      <div key={ep.id} className={`flex items-center justify-between gap-1.5 rounded px-1.5 py-1 text-[11px] ${isDark ? "bg-slate-900/60" : "bg-white"}`}>
                        <div className="min-w-0 flex-1">
                          <span className={mutedClass}>{PLATFORM_LABEL[ep.platform]}: </span>
                          <span className={isDark ? "text-slate-300" : "text-slate-700"}>{ep.identifier}</span>
                          {ep.isPreferred && <Star className="ml-1 inline h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
                          <span className={`ml-1.5 rounded px-1 text-[9px] ${confidenceBadgeClass(ep.confidence, isDark)}`}>{ep.confidence.replace("_", " ")}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {busyEndpointId === ep.id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                          ) : (
                            <>
                              {ep.confidence !== "verified" && ep.confidence !== "user_confirmed" && (
                                <>
                                  <button title="Confirm" onClick={() => void handleEndpointAction(ep.id, { action: "confirm" })} className="text-emerald-400 hover:text-emerald-300">
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button title="Reject" onClick={() => void handleEndpointAction(ep.id, { action: "reject" })} className="text-rose-400 hover:text-rose-300">
                                    <XIcon className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                              {!ep.isPreferred && (
                                <button title="Mark preferred" onClick={() => void handleEndpointAction(ep.id, { action: "setPreferred" })} className="text-slate-500 hover:text-amber-400">
                                  <Star className="h-3 w-3" />
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
                                  className={`rounded border-none bg-transparent text-[10px] ${mutedClass}`}
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
                    <div className="mt-1.5 flex items-center gap-1">
                      <select
                        value={newHandlePlatform}
                        onChange={(e) => setNewHandlePlatform(e.target.value as ContactEndpointPlatform)}
                        className={`rounded border px-1 py-1 text-[10px] ${isDark ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-300 bg-white"}`}
                      >
                        {CONTACT_ENDPOINT_PLATFORMS.map((p) => (
                          <option key={p} value={p}>
                            {PLATFORM_LABEL[p]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={newHandleIdentifier}
                        onChange={(e) => setNewHandleIdentifier(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void handleAddHandle(persona.id)}
                        placeholder="handle…"
                        className={`flex-1 rounded border px-1.5 py-1 text-[10px] outline-none ${isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-300 bg-white"}`}
                      />
                      <button onClick={() => void handleAddHandle(persona.id)} className="text-indigo-400 hover:text-indigo-300">
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {addingContextFor ? (
                <div className="flex items-center gap-1">
                  <input
                    value={newContextLabel}
                    onChange={(e) => setNewContextLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleAddContext()}
                    placeholder="e.g. Professional, Horizon…"
                    className={inputClass}
                  />
                  <button onClick={() => void handleAddContext()} className="shrink-0 text-indigo-400 hover:text-indigo-300">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setAddingContextFor(true)} className="text-[10px] text-indigo-400 hover:text-indigo-300">
                  + Add persona/context
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${mutedClass}`}>Relationship</div>
              <div className={`rounded-md border p-2.5 text-[11px] ${cardClass} ${mutedClass}`}>
                {detail.linkedQubeTalkParticipants.length > 0
                  ? `${detail.linkedQubeTalkParticipants.length} linked QubeTalk conversation participant${detail.linkedQubeTalkParticipants.length === 1 ? "" : "s"}. Open Conversations to see relationship history.`
                  : "No QubeTalk conversations linked to this person yet."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <LayoutShell
      surfaceId="people"
      disTemplateId="people-layout-v1"
      theme={theme}
      headerIcon={<Users className="h-3.5 w-3.5" />}
      headerEyebrow="ContactGraph"
      headerTitle="People"
      onDismiss={() => onRequestLayout?.("stack")}
      dismissLabel="Close people"
      body={body}
    />
  );
}

function confidenceBadgeClass(confidence: string, isDark: boolean): string {
  if (confidence === "verified" || confidence === "user_confirmed") {
    return isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700";
  }
  if (confidence === "high_confidence") {
    return isDark ? "bg-sky-500/15 text-sky-400" : "bg-sky-100 text-sky-700";
  }
  return isDark ? "bg-slate-800 text-slate-500" : "bg-slate-200 text-slate-500";
}

export const PeopleLayout: RightPaneLayoutDefinition = {
  id: "people",
  label: "People",
  component: PeopleLayoutComponent,
  disTemplateId: "people-layout-v1",
};
