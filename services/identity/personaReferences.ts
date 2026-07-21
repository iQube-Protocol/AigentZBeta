/**
 * Three-level persona reference model (2026-07-18 operator direction).
 *
 * The raw persona UUID is the PRIVATE root identifier — an owner recovery
 * handle, not a public interoperability credential. Two derived reference
 * classes serve the two public trust domains:
 *
 *  1. Private Persona UUID — T0. Surfaced ONLY in the owner-authenticated
 *     wallet self-view (masked by default). Never emitted in receipts,
 *     broadcasts, locker metadata, or third-party calls.
 *  2. Polity Public Reference — the stable governed-ecosystem handle.
 *     Same derivation as the DVN pipeline's hashPersonaRef (sha256,
 *     16-hex prefix): one-way, deterministic, T2-safe. NOT universally
 *     unlinkable — a single stable hash is correlatable across services,
 *     which is acceptable INSIDE the governed Polity environment only.
 *  3. Pairwise External Service Reference — per-audience keyed HMAC, so
 *     each third-party service sees a distinct value and no two services
 *     can correlate a persona. Keyed (not plain sha256) so knowing a UUID
 *     does not let anyone else reproduce a ref. Stored in
 *     persona_external_refs for recovery; revocable and regenerable
 *     (the generation is part of the HMAC input).
 *
 * The pairwise key is PERSONA_PAIRWISE_REF_SECRET (server env). When unset,
 * external-ref issuance is disabled (the wallet shows a hint) — levels 1
 * and 2 keep working.
 */

import { createHash, createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Level 2 — Polity Public Reference. Mirrors hashPersonaRef in
 * services/dvn/activityReceiptDvnPipeline.ts (module-private there; the
 * derivation is the contract: sha256 hex, first 16 chars). Keep the two in
 * lockstep — this IS the identifier that appears in DVN receipts today.
 */
export function personaPublicRef(personaId: string): string {
  return createHash('sha256').update(personaId).digest('hex').slice(0, 16);
}

export function pairwiseRefsEnabled(): boolean {
  return Boolean(process.env.PERSONA_PAIRWISE_REF_SECRET);
}

/** Normalise an audience label to its canonical stored form. */
export function normalizeAudience(audience: string): string {
  return audience.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 64);
}

/**
 * Level 3 — derive the pairwise ref for (persona, audience, generation).
 * Throws when the secret is unset; callers gate on pairwiseRefsEnabled().
 */
export function derivePairwiseRef(personaId: string, audience: string, generation: number): string {
  const secret = process.env.PERSONA_PAIRWISE_REF_SECRET;
  if (!secret) throw new Error('PERSONA_PAIRWISE_REF_SECRET not configured');
  const digest = createHmac('sha256', secret)
    .update(`${personaId}:${normalizeAudience(audience)}:${generation}`)
    .digest('hex');
  return `prf_${digest.slice(0, 20)}`;
}

export interface ExternalRefRow {
  id: string;
  personaId: string;
  audience: string;
  ref: string;
  generation: number;
  status: 'active' | 'revoked';
  createdAt: string;
  revokedAt: string | null;
}

function toExternalRefRow(r: Record<string, unknown>): ExternalRefRow {
  return {
    id: String(r.id),
    personaId: String(r.persona_id),
    audience: String(r.audience),
    ref: String(r.ref),
    generation: Number(r.generation),
    status: r.status === 'revoked' ? 'revoked' : 'active',
    createdAt: String(r.created_at),
    revokedAt: (r.revoked_at as string | null) ?? null,
  };
}

/** All external refs (active + revoked) for a set of persona ids. */
export async function listExternalRefs(
  admin: SupabaseClient,
  personaIds: string[],
): Promise<ExternalRefRow[]> {
  if (personaIds.length === 0) return [];
  const { data, error } = await admin
    .from('persona_external_refs')
    .select('id, persona_id, audience, ref, generation, status, created_at, revoked_at')
    .in('persona_id', personaIds)
    .order('created_at', { ascending: false });
  // Pre-migration soft-fail: no table yet → no refs, wallet still renders.
  if (error) return [];
  return (data ?? []).map(toExternalRefRow);
}

/**
 * Issue (or regenerate) the external ref for (persona, audience).
 * Idempotent when an active ref exists and regenerate=false. Regeneration
 * revokes the current active ref and inserts generation+1.
 */
export async function issueExternalRef(
  admin: SupabaseClient,
  personaId: string,
  audience: string,
  opts?: { regenerate?: boolean },
): Promise<ExternalRefRow> {
  const aud = normalizeAudience(audience);
  if (!aud) throw new Error('Audience (service name/domain) is required');

  const { data: existing } = await admin
    .from('persona_external_refs')
    .select('id, persona_id, audience, ref, generation, status, created_at, revoked_at')
    .eq('persona_id', personaId)
    .eq('audience', aud)
    .order('generation', { ascending: false })
    .limit(1);

  const latest = existing?.[0] ? toExternalRefRow(existing[0]) : null;

  if (latest?.status === 'active' && !opts?.regenerate) return latest;

  if (latest?.status === 'active' && opts?.regenerate) {
    await admin
      .from('persona_external_refs')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', latest.id);
  }

  const generation = (latest?.generation ?? 0) + 1;
  const ref = derivePairwiseRef(personaId, aud, generation);
  const { data: inserted, error } = await admin
    .from('persona_external_refs')
    .insert({ persona_id: personaId, audience: aud, ref, generation, status: 'active' })
    .select('id, persona_id, audience, ref, generation, status, created_at, revoked_at')
    .single();
  if (error || !inserted) throw new Error(error?.message ?? 'Failed to issue external reference');
  return toExternalRefRow(inserted);
}

/** Revoke one ref by id, scoped to the caller's persona inventory. */
export async function revokeExternalRef(
  admin: SupabaseClient,
  refId: string,
  ownedPersonaIds: string[],
): Promise<boolean> {
  const { data, error } = await admin
    .from('persona_external_refs')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', refId)
    .in('persona_id', ownedPersonaIds)
    .eq('status', 'active')
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}
