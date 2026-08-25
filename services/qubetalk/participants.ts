/**
 * QubeTalk Communications Membrane — ParticipantQube (§3).
 *
 * A per-owner communications projection of an existing principal/Agent/org,
 * or an unresolved off-platform correspondent. NEVER a new identity
 * authority (P6/N3): `principalRef`, when set, is a real FK to
 * `personas.public_ref` — this module cannot mint an identity, only record
 * that a Polity Passport/persona reference has been confirmed to correspond
 * to a directory entry. Identities are NEVER merged off a display-name match
 * alone (N4); endpoint confidence is always explicit
 * (`QUBETALK_ENDPOINT_CONFIDENCE`), and every confirmation is a deliberate,
 * undoable operator act.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type {
  QubeTalkParticipant,
  QubeTalkParticipantEndpoint,
  QubeTalkEndpointPlatform,
  QubeTalkEndpointConfidence,
} from '@/types/qubetalk';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

const PARTICIPANTS = 'qubetalk_participants';
const ENDPOINTS = 'qubetalk_participant_endpoints';

function rowToParticipant(row: Record<string, unknown>): QubeTalkParticipant {
  return {
    id: String(row.id),
    ownerPersonaId: String(row.owner_persona_id),
    principalRef: (row.principal_ref as string | null) ?? null,
    displayName: String(row.display_name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToEndpoint(row: Record<string, unknown>): QubeTalkParticipantEndpoint {
  return {
    id: String(row.id),
    participantId: String(row.participant_id),
    platform: row.platform as QubeTalkEndpointPlatform,
    endpointRef: String(row.endpoint_ref),
    confidence: row.confidence as QubeTalkEndpointConfidence,
    confirmedByPersonaId: (row.confirmed_by_persona_id as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

/**
 * Create a new, unresolved-by-default participant in the owner's directory.
 * Setting `principalRef` at creation is allowed (e.g. the owner already
 * knows who this is), but it is never inferred here — the caller supplies it
 * explicitly, or leaves it null for later resolution.
 */
export async function createParticipant(
  ownerPersonaId: string,
  input: { displayName: string; principalRef?: string | null },
): Promise<PeerResult<QubeTalkParticipant>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data, error } = await admin
    .from(PARTICIPANTS)
    .insert({
      owner_persona_id: ownerPersonaId,
      display_name: input.displayName,
      principal_ref: input.principalRef ?? null,
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToParticipant(data as Record<string, unknown>) };
}

export async function listParticipants(ownerPersonaId: string): Promise<PeerResult<QubeTalkParticipant[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(PARTICIPANTS)
    .select('*')
    .eq('owner_persona_id', ownerPersonaId)
    .order('display_name', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToParticipant(r as Record<string, unknown>)) };
}

export async function getParticipant(ownerPersonaId: string, participantId: string): Promise<PeerResult<QubeTalkParticipant>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await admin
    .from(PARTICIPANTS)
    .select('*')
    .eq('id', participantId)
    .eq('owner_persona_id', ownerPersonaId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'participant not found', code: 'not_found' };
  return { ok: true, value: rowToParticipant(data as Record<string, unknown>) };
}

/**
 * Add an endpoint to a participant. `confidence` defaults to 'unresolved' —
 * a caller reporting a bare platform handle with no evidence never claims
 * more certainty than that.
 */
export async function addParticipantEndpoint(
  ownerPersonaId: string,
  participantId: string,
  input: { platform: QubeTalkEndpointPlatform; endpointRef: string; confidence?: QubeTalkEndpointConfidence },
): Promise<PeerResult<QubeTalkParticipantEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const owned = await getParticipant(ownerPersonaId, participantId);
  if (!owned.ok) return owned;

  const { data, error } = await admin
    .from(ENDPOINTS)
    .insert({
      participant_id: participantId,
      platform: input.platform,
      endpoint_ref: input.endpointRef,
      confidence: input.confidence ?? 'unresolved',
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

export async function listParticipantEndpoints(
  ownerPersonaId: string,
  participantId: string,
): Promise<PeerResult<QubeTalkParticipantEndpoint[]>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const owned = await getParticipant(ownerPersonaId, participantId);
  if (!owned.ok) return owned;
  const { data, error } = await admin
    .from(ENDPOINTS)
    .select('*')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((r) => rowToEndpoint(r as Record<string, unknown>)) };
}

/**
 * Manual operator confirmation of an endpoint linkage (§3: "Support manual
 * operator confirmation/undo of endpoint linkage"). Always an explicit act —
 * never automatic, never inferred from a name match (N4).
 */
export async function confirmParticipantEndpoint(
  ownerPersonaId: string,
  endpointId: string,
  confirmedByPersonaId: string,
  confidence: Extract<QubeTalkEndpointConfidence, 'verified' | 'user_confirmed'> = 'user_confirmed',
): Promise<PeerResult<QubeTalkParticipantEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  // Ownership check: the endpoint's participant must belong to this owner.
  const { data: existing, error: readError } = await admin
    .from(ENDPOINTS)
    .select('*, qubetalk_participants!inner(owner_persona_id)')
    .eq('id', endpointId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  const ownerOfParticipant = (existing as Record<string, unknown> | null)?.qubetalk_participants as
    | { owner_persona_id?: string }
    | undefined;
  if (!existing || ownerOfParticipant?.owner_persona_id !== ownerPersonaId) {
    return { ok: false, error: 'endpoint not found', code: 'not_found' };
  }

  const { data, error } = await admin
    .from(ENDPOINTS)
    .update({ confidence, confirmed_by_persona_id: confirmedByPersonaId, confirmed_at: new Date().toISOString() })
    .eq('id', endpointId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/** Undo a confirmation — resets to 'tentative' (§3). Never silently deletes
 *  the endpoint itself; the correspondent is still known, just unconfirmed. */
export async function undoParticipantEndpointConfirmation(
  ownerPersonaId: string,
  endpointId: string,
): Promise<PeerResult<QubeTalkParticipantEndpoint>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };
  const { data: existing, error: readError } = await admin
    .from(ENDPOINTS)
    .select('*, qubetalk_participants!inner(owner_persona_id)')
    .eq('id', endpointId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  const ownerOfParticipant = (existing as Record<string, unknown> | null)?.qubetalk_participants as
    | { owner_persona_id?: string }
    | undefined;
  if (!existing || ownerOfParticipant?.owner_persona_id !== ownerPersonaId) {
    return { ok: false, error: 'endpoint not found', code: 'not_found' };
  }
  const { data, error } = await admin
    .from(ENDPOINTS)
    .update({ confidence: 'tentative', confirmed_by_persona_id: null, confirmed_at: null })
    .eq('id', endpointId)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: rowToEndpoint(data as Record<string, unknown>) };
}

/**
 * Resolve an inbound endpoint (e.g. "this WhatsApp number sent a message")
 * to an existing participant in the owner's directory, WITHOUT ever merging
 * on a name match. Exact endpoint match only — the deterministic, safe case.
 * Returns `value: null` (never an error) when nothing matches; the caller is
 * expected to create a new, unresolved participant in that case (§4 of the
 * ingress lifecycle, services/qubetalk/ingestion.ts).
 */
export async function resolveParticipantByEndpoint(
  admin: SupabaseClient,
  ownerPersonaId: string,
  platform: QubeTalkEndpointPlatform,
  endpointRef: string,
): Promise<PeerResult<QubeTalkParticipant | null>> {
  const { data, error } = await admin
    .from(ENDPOINTS)
    .select('*, qubetalk_participants!inner(*)')
    .eq('platform', platform)
    .eq('endpoint_ref', endpointRef)
    .eq('qubetalk_participants.owner_persona_id', ownerPersonaId)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, value: null };
  const participantRow = (data as Record<string, unknown>).qubetalk_participants as Record<string, unknown>;
  return { ok: true, value: rowToParticipant(participantRow) };
}

/**
 * Resolve a participant by their ALREADY-KNOWN Polity Public Reference — the
 * one case identity resolution is safe to do automatically, because the ref
 * itself is the platform's own authoritative identity signal, not a guess.
 * Creates a `verified`-confidence 'metame' endpoint + a resolved participant
 * row if none exists yet for this owner.
 */
export async function resolveOrCreateParticipantByPrincipalRef(
  ownerPersonaId: string,
  principalRef: string,
  displayName: string,
): Promise<PeerResult<QubeTalkParticipant>> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase unavailable' };

  const { data: existing, error: readError } = await admin
    .from(PARTICIPANTS)
    .select('*')
    .eq('owner_persona_id', ownerPersonaId)
    .eq('principal_ref', principalRef)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (existing) return { ok: true, value: rowToParticipant(existing as Record<string, unknown>) };

  return createParticipant(ownerPersonaId, { displayName, principalRef });
}
