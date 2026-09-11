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

import { useCallback, useEffect, useState } from "react";
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

/** Page size for the People list — kept small so a single request stays
 *  fast regardless of address-book size; more pages load on demand via
 *  loadMore(). */
const PAGE_SIZE = 100;
/** How long to wait after the last keystroke before the search term hits
 *  the server — avoids firing a request per character typed. */
const SEARCH_DEBOUNCE_MS = 300;

export function useContactGraphPeople() {
  const [people, setPeople] = useState<ContactGraphProjectionPersonSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<ContactGraphPeopleStats | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // The term actually sent to the server — debounced off `query` so typing
  // doesn't fire a request per keystroke. Search runs server-side over the
  // FULL ContactGraph, never just the currently loaded page.
  const [debouncedQuery, setDebouncedQuery] = useState("");
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

type PeoplePageResponse = {
    people: ContactGraphProjectionPersonSummary[];
    totalCount: number;
    hasMore: boolean;
    stats: ContactGraphPeopleStats | null;
  };

  const fetchPeoplePage = useCallback(async (offset: number, search: string) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (search) params.set("search", search);
    return fetchJson<PeoplePageResponse>(`/api/contactgraph/people?${params.toString()}`);
  }, []);

  // Reset to page 1 for the given search term — used both for the initial
  // load and every time the (debounced) search term changes, since search
  // runs server-side over the FULL ContactGraph rather than filtering
  // whatever page happens to be loaded.
  const loadPeople = useCallback(
    async (search = debouncedQuery) => {
      setListLoading(true);
      setListError(null);
      const result = await fetchPeoplePage(0, search);
      if (result.ok) {
        setPeople(result.data.people);
        setTotalCount(result.data.totalCount);
        setHasMore(result.data.hasMore);
        setStats(result.data.stats ?? null);
      } else {
        setListError(result.error);
      }
      setListLoading(false);
    },
    [debouncedQuery, fetchPeoplePage],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || listLoading || !hasMore) return;
    setLoadingMore(true);
    const result = await fetchPeoplePage(people.length, debouncedQuery);
    if (result.ok) {
      setPeople((prev) => [...prev, ...result.data.people]);
      setTotalCount(result.data.totalCount);
      setHasMore(result.data.hasMore);
    } else {
      setListError(result.error);
    }
    setLoadingMore(false);
  }, [loadingMore, listLoading, hasMore, people.length, debouncedQuery, fetchPeoplePage]);

  const loadDetail = useCallback(async (personId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    const result = await fetchJson<PersonDetail>(`/api/contactgraph/people/${personId}`);
    if (result.ok) setDetail(result.data);
    else setDetailError(result.error);
    setDetailLoading(false);
  }, []);

  // Debounce query -> debouncedQuery. Resets on every keystroke; only the
  // value settled on for SEARCH_DEBOUNCE_MS actually triggers a server call.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Initial load, and every time the settled search term changes — always
  // resets to page 1 (a new search invalidates whatever pages were loaded
  // for the previous term/browse view).
  useEffect(() => {
    void loadPeople(debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  // The server already applies search (debouncedQuery) — `people` IS the
  // filtered result. Kept as `filteredPeople` for existing consumers.
  const filteredPeople = people;

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
    totalCount,
    hasMore,
    loadingMore,
    loadMore,
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
