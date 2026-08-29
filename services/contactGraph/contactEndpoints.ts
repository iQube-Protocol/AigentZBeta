/**
 * ContactGraph — CommunicationEndpoint.
 *
 * A reachable handle under a ContactPersona. Endpoint identity confidence
 * reuses QubeTalk's own vocabulary verbatim (never a second scale).
 *
 * Hard invariant (C6/NC2): observed communication may SUGGEST contact
 * identity; it may never SILENTLY ASSERT it. `resolveEndpointForOwner` is
 * exact normalized-identifier match ONLY — never a display-name/fuzzy match.
 * Every propose/confirm/reject/reassign action is recorded in the endpoint's
 * own `linkHistory` (append-only, never rewritten) and reassignment moves
 * the SAME row (never delete+recreate) so first_observed_at and history
 * survive (C7).
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  ContactEndpoint,
  ContactEndpointConfidence,
  ContactEndpointLinkEvent,
  ContactEndpointPlatform,
  ContactEndpointSource,
} from '@/types/contactGraph';
import type { PeerResult } from '@/services/qubetalk/peerChannel';
import { getContactPerson } from '@/services/contactGraph/contactPersons';

const CONTACT_ENDPOINTS = 'contact_endpoints';
const CONTACT_PERSONAS = 'contact_personas';

// See services/contactGraph/contactPersonas.ts's chunkIds for why: a large
// address book's .in() list can exceed the upstream URL-length limit and
// surface as a bare "Bad Request".
const IN_FILTER_CHUNK_SIZE = 100;

function chunkIds(ids: string[], size = IN_FILTER_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

/** Deterministic, platform-aware normalization — used for exact-match
 *  resolution only. Never used to infer identity across platforms. */
export function normalizeEndpointIdentifier(platform: ContactEndpointPlatform, identifier: string): string {
  const trimmed = identifier.trim();
  if (platform === 'email' || platform === 'metame') return trimmed.toLowerCase();
  if (platform === 'whatsapp' || platform === 'signal' || platform === 'sms') {
    const digits = trimmed.replace(/[^\d+]/g, '');
    return digits.startsWith('+') ? digits : `+${digits.replace(/^0+/, '')}`;
  }
  return trimmed.toLowerCase().replace(/^@/, '');
}

function rowToEndpoint(row: Record<string, unknown>): ContactEndpoint {
  return {
    id: String(row.id),
    contactPersonaId: String(row.contact_persona_id),
    platform: row.platform as ContactEndpointPlatform,
    identifier: String(row.identifier),
    normalizedIdentifier: String(row.normalized_identifier),
    externalAccountRef: (row.external_account_ref as string | null) ?? null,
    confidence: row.confidence as ContactEndpointConfidence,
    source: row.source as ContactEndpointSource,
    inboundCapable: Boolean(row.inbound_capable),
    outboundCapable: Boolean(row.outbound_capable),
    isPreferred: Boolean(row.is_preferred),
    state: row.state as ContactEndpoint['state'],
    firstObservedAt: String(row.first_observed_at),
    lastObservedAt: String(row.last_observed_at),
    confirmedByPersonaId: (row.confirmed_by_persona_id as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    linkHistory: (row.link_history as ContactEndpointLinkEvent[] | null) ?? [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function ownsContactPersona(
  admin: ReturnType<typeof getSupabaseServer>,
  ownerAuthProfileId: string,
  contactPersonaId: string,
): Promise<boolean> {
  if (!admin) return false;
  // contact_personas carries owner_auth_profile_id directly (denormalized
  // from its parent contact_person at creation) — a flat filter, no embed.
  const { data } = await admin
    .from(CONTACT_PERSONAS)
    .select('*')
    .eq('id', contactPersonaId)
    .eq('owner_auth_profile_id', ownerAuthProfileId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Add an endpoint under a ContactPersona. `confidence` defaults to
 * 'unresolved' — reporting a bare handle with no evidence never claims more
 * certainty than that.
 */
export async function addContactEndpoint(
  ownerAuthProfileId: string,
  contactPersonaId: string,
  input: {
    platform: ContactEndpointPlatform;
    identifier: string;
    confidence?: ContactEndpointConfidence;
    source?: ContactEndpointSource;
    externalAccountRef?: string | null;
  },
): Promise<PeerResult<ContactEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  if (!(await ownsContactPersona(admin, ownerAuthProfileId, contactPersonaId))) {
    return { ok: false, error: 'contact persona not found', code: 'not_found' };
  }

  const normalized = normalizeEndpointIdentifier(input.platform, input.identifier);
  const proposedEvent: ContactEndpointLinkEvent = {
    action: 'proposed',
    fromContactPersonaId: null,
    toContactPersonaId: contactPersonaId,
    actorPersonaId: null,
    at: new Date().toISOString(),
    reason: `observed via ${input.source ?? 'manual'}`,
  };

  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .insert({
      contact_persona_id: contactPersonaId,
      platform: input.platform,
      identifier: input.identifier,
      normalized_identifier: normalized,
      external_account_ref: input.externalAccountRef ?? null,
      confidence: input.confidence ?? 'unresolved',
      source: input.source ?? 'manual',
      link_history: [proposedEvent],
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/**
 * BATCHED read for a whole projection page — the People 504 fix
 * (2026-08-27), paired with `listContactPersonasForOwner`. `listContactEndpoints`
 * above does one ownership-check query PLUS one list query PER
 * ContactPersona; a projection fanning out over every persona of every
 * ContactPerson (see services/contactGraph/projection.ts) turned that into
 * thousands of sequential round trips for a persona with a large address
 * book, and was the dominant contributor to a live GET
 * /api/contactgraph/people 504. Ownership is enforced in the SAME single
 * query via the `contact_personas` join (mirrors `ownsContactPersona`'s
 * own filter) — no per-id ownership check needed, and no N+1. Returns ALL
 * endpoints across every requested ContactPersona in one round trip;
 * callers group by `contactPersonaId` in memory. `contactPersonaIds` MUST
 * already be ownership-filtered (e.g. via `listContactPersonasForOwner`).
 */
export async function listContactEndpointsForPersonas(
  ownerAuthProfileId: string,
  contactPersonaIds: string[],
): Promise<PeerResult<ContactEndpoint[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  if (contactPersonaIds.length === 0) return { ok: true, value: [] };

  const rows: Record<string, unknown>[] = [];
  for (const idsChunk of chunkIds(contactPersonaIds)) {
    const { data, error } = await admin
      .from(CONTACT_ENDPOINTS)
      .select('*, contact_personas!inner(owner_auth_profile_id)')
      .in('contact_persona_id', idsChunk)
      .eq('contact_personas.owner_auth_profile_id', ownerAuthProfileId)
      .order('created_at', { ascending: true });
    if (error) return { ok: false, error: error.message };
    rows.push(...(data ?? []));
  }
  // Merge-sort by created_at so the combined result still honours the
  // documented ordering, exactly as the single unchunked query did.
  rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return { ok: true, value: rows.map((r) => rowToEndpoint(r)) };
}

export async function listContactEndpoints(
  ownerAuthProfileId: string,
  contactPersonaId: string,
): Promise<PeerResult<ContactEndpoint[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  if (!(await ownsContactPersona(admin, ownerAuthProfileId, contactPersonaId))) {
    return { ok: false, error: 'contact persona not found', code: 'not_found' };
  }
  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*')
    .eq('contact_persona_id', contactPersonaId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToEndpoint(r as Record<string, unknown>)) };
}

/**
 * Fetch one endpoint by id, ownership-checked. The canonical read for
 * "the caller picked THIS specific handle in the composer" — QubeTalk
 * Fast-Follow's egress seam resolves `destination.contactEndpointId`
 * through this function rather than trusting a raw platform identifier
 * supplied directly by the client (which a caller could otherwise forge to
 * point at a channel they don't own the endpoint for).
 */
export async function getContactEndpointById(
  ownerAuthProfileId: string,
  endpointId: string,
): Promise<PeerResult<ContactEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*, contact_personas!inner(owner_auth_profile_id)')
    .eq('id', endpointId)
    .eq('contact_personas.owner_auth_profile_id', ownerAuthProfileId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'endpoint not found', code: 'not_found' };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/**
 * Exact normalized-identifier match ONLY, scoped to everything the owner
 * owns (across ALL of the owner's ContactPersons/ContactPersonas) — never a
 * name-based/fuzzy match (N4/NC2). Returns `value: null` (never an error)
 * when nothing matches.
 */
export async function resolveEndpointForOwner(
  ownerAuthProfileId: string,
  platform: ContactEndpointPlatform,
  identifier: string,
): Promise<PeerResult<ContactEndpoint | null>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const normalized = normalizeEndpointIdentifier(platform, identifier);
  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*, contact_personas!inner(owner_auth_profile_id)')
    .eq('platform', platform)
    .eq('normalized_identifier', normalized)
    .eq('contact_personas.owner_auth_profile_id', ownerAuthProfileId)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, value: null };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/**
 * Reassign an endpoint to a DIFFERENT ContactPersona under the SAME
 * ContactPerson (e.g. "move Telegram from Professional to Personal"). Moves
 * the SAME row — id, first_observed_at, and prior link_history entries are
 * preserved — and appends a 'reassigned' event (C7: re-indexes, never
 * rewrites source history).
 */
export async function reassignContactEndpoint(
  ownerAuthProfileId: string,
  endpointId: string,
  toContactPersonaId: string,
  actorPersonaId: string,
  reason?: string,
): Promise<PeerResult<ContactEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: existing, error: readError } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*, contact_personas!inner(owner_auth_profile_id)')
    .eq('id', endpointId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  const currentPersonaRow = (existing as Record<string, unknown> | null)?.contact_personas as
    | { owner_auth_profile_id?: string }
    | undefined;
  if (!existing || currentPersonaRow?.owner_auth_profile_id !== ownerAuthProfileId) {
    return { ok: false, error: 'endpoint not found', code: 'not_found' };
  }
  if (!(await ownsContactPersona(admin, ownerAuthProfileId, toContactPersonaId))) {
    return { ok: false, error: 'target contact persona not found', code: 'not_found' };
  }

  const priorHistory = ((existing as Record<string, unknown>).link_history as ContactEndpointLinkEvent[] | null) ?? [];
  const event: ContactEndpointLinkEvent = {
    action: 'reassigned',
    fromContactPersonaId: (existing as Record<string, unknown>).contact_persona_id as string,
    toContactPersonaId,
    actorPersonaId,
    at: new Date().toISOString(),
    reason: reason ?? null,
  };

  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .update({ contact_persona_id: toContactPersonaId, link_history: [...priorHistory, event] })
    .eq('id', endpointId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/** Manual operator confirmation of an endpoint — always a deliberate,
 *  undoable act, never automatic (NC2). */
export async function confirmContactEndpoint(
  ownerAuthProfileId: string,
  endpointId: string,
  confirmedByPersonaId: string,
  confidence: Extract<ContactEndpointConfidence, 'verified' | 'user_confirmed'> = 'user_confirmed',
): Promise<PeerResult<ContactEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: existing, error: readError } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*, contact_personas!inner(owner_auth_profile_id)')
    .eq('id', endpointId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  const ownerRow = (existing as Record<string, unknown> | null)?.contact_personas as
    | { owner_auth_profile_id?: string }
    | undefined;
  if (!existing || ownerRow?.owner_auth_profile_id !== ownerAuthProfileId) {
    return { ok: false, error: 'endpoint not found', code: 'not_found' };
  }

  const priorHistory = ((existing as Record<string, unknown>).link_history as ContactEndpointLinkEvent[] | null) ?? [];
  const event: ContactEndpointLinkEvent = {
    action: 'confirmed',
    fromContactPersonaId: null,
    toContactPersonaId: (existing as Record<string, unknown>).contact_persona_id as string,
    actorPersonaId: confirmedByPersonaId,
    at: new Date().toISOString(),
    reason: null,
  };

  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .update({
      confidence,
      confirmed_by_persona_id: confirmedByPersonaId,
      confirmed_at: new Date().toISOString(),
      link_history: [...priorHistory, event],
    })
    .eq('id', endpointId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/** Reject a proposed/observed endpoint link — never deletes the row (the
 *  observation itself is preserved for provenance), just marks it rejected
 *  so it stops surfacing as an active handle. */
export async function rejectContactEndpoint(
  ownerAuthProfileId: string,
  endpointId: string,
  actorPersonaId: string,
  reason?: string,
): Promise<PeerResult<ContactEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: existing, error: readError } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*, contact_personas!inner(owner_auth_profile_id)')
    .eq('id', endpointId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  const ownerRow = (existing as Record<string, unknown> | null)?.contact_personas as
    | { owner_auth_profile_id?: string }
    | undefined;
  if (!existing || ownerRow?.owner_auth_profile_id !== ownerAuthProfileId) {
    return { ok: false, error: 'endpoint not found', code: 'not_found' };
  }

  const priorHistory = ((existing as Record<string, unknown>).link_history as ContactEndpointLinkEvent[] | null) ?? [];
  const event: ContactEndpointLinkEvent = {
    action: 'rejected',
    fromContactPersonaId: null,
    toContactPersonaId: null,
    actorPersonaId,
    at: new Date().toISOString(),
    reason: reason ?? null,
  };

  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .update({ state: 'rejected', link_history: [...priorHistory, event] })
    .eq('id', endpointId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/** Mark ONE endpoint as the preferred way to reach this ContactPersona
 *  (§12: "mark preferred communication handle"). Scoped per persona/context
 *  — clearing every OTHER endpoint under the SAME contact_persona_id first,
 *  so "preferred" never means two conflicting handles at once for one
 *  context (a person can still have a different preferred handle per
 *  context, e.g. Professional vs Personal). */
export async function setPreferredContactEndpoint(
  ownerAuthProfileId: string,
  endpointId: string,
): Promise<PeerResult<ContactEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: existing, error: readError } = await admin
    .from(CONTACT_ENDPOINTS)
    .select('*, contact_personas!inner(owner_auth_profile_id)')
    .eq('id', endpointId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  const ownerRow = (existing as Record<string, unknown> | null)?.contact_personas as
    | { owner_auth_profile_id?: string }
    | undefined;
  if (!existing || ownerRow?.owner_auth_profile_id !== ownerAuthProfileId) {
    return { ok: false, error: 'endpoint not found', code: 'not_found' };
  }
  const contactPersonaId = (existing as Record<string, unknown>).contact_persona_id as string;

  const { error: clearError } = await admin
    .from(CONTACT_ENDPOINTS)
    .update({ is_preferred: false })
    .eq('contact_persona_id', contactPersonaId);
  if (clearError) return { ok: false, error: clearError.message };

  const { data, error } = await admin
    .from(CONTACT_ENDPOINTS)
    .update({ is_preferred: true })
    .eq('id', endpointId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}
