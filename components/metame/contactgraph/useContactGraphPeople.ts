"use client";

/**
 * useContactGraphPeople — the shared ContactGraph People data/logic layer.
 *
 * Extracted from aigentMe's PeopleLayout.tsx (QubeTalk Fast-Follow, priority
 * step 3) so a compact surface (aigentMe's PeopleLayout) and a richer
 * surface (metaMe Runtime's People workbench) can consume the SAME
 * fetching/mutation logic against the SAME /api/contactgraph/* routes,
 * rather than forking a second implementation (per the operator's explicit
 * "fan out, do not fork" instruction and C13: ContactGraph is a contained
 * capability, not owned by any one surface).
 *
 * This hook owns state and network calls only — zero JSX. Every consumer
 * renders its own presentation (aigentMe's two-pane compact layout, or
 * Runtime's richer workbench) from the SAME underlying data/actions, so a
 * mutation made from either surface is immediately reflected by the other
 * on next read — there is one ContactGraph, not two.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";
import type {
  ContactEndpoint,
  ContactEndpointPlatform,
  ContactGraphProjectionPersonSummary,
  ContactPersona,
  ContactPerson,
} from "@/types/contactGraph";

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await personaFetch(url, init);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) return { ok: false, error: body?.error ?? `request failed (${res.status})` };
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

export interface ContactGraphImportSourceStats {
  source: string;
  importedRecords: number;
  confirmedRecords: number;
  projectedRecords: number;
}

export interface ContactGraphPeopleStats {
  graphPeople: number;
  importedRecords: number;
  confirmedRecords: number;
  projectedRecords: number;
  importedBySource: ContactGraphImportSourceStats[];
}

export type PersonaWithEndpoints = ContactPersona & { endpoints: ContactEndpoint[] };

export interface PersonDetail {
  person: ContactPerson;
  personas: PersonaWithEndpoints[];
  linkedQubeTalkParticipants: unknown[];
}

export const CONTACT_PLATFORM_LABEL: Record<ContactEndpointPlatform, string> = {
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

export function useContactGraphPeople() {
  const [people, setPeople] = useState<ContactGraphProjectionPersonSummary[]>([]);
  const [stats, setStats] = useState<ContactGraphPeopleStats | null>(null);
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
    const result = await fetchJson<{
      people: ContactGraphProjectionPersonSummary[];
      stats: ContactGraphPeopleStats | null;
    }>("/api/contactgraph/people");
    if (result.ok) {
      setPeople(result.data.people);
      setStats(result.data.stats ?? null);
    } else {
      setListError(result.error);
    }
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

  return {
    // list
    people,
    stats,
    filteredPeople,
    listLoading,
    listError,
    query,
    setQuery,
    loadPeople,
    creatingPerson,
    newPersonName,
    setNewPersonName,
    handleCreatePerson,
    // selection + detail
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    detailError,
    loadDetail,
    // endpoint mutation
    busyEndpointId,
    handleEndpointAction,
    // add persona/context
    addingContextFor,
    setAddingContextFor,
    newContextLabel,
    setNewContextLabel,
    handleAddContext,
    // add handle
    addingHandleFor,
    setAddingHandleFor,
    newHandlePlatform,
    setNewHandlePlatform,
    newHandleIdentifier,
    setNewHandleIdentifier,
    handleAddHandle,
  };
}

export type ContactGraphPeopleState = ReturnType<typeof useContactGraphPeople>;
