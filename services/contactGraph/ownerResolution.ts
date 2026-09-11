/**
 * ContactGraph ownership resolution — maps a caller's active persona to the
 * REAL owner anchor ContactGraph is scoped by (`auth_profile_id`, the
 * existing, canonicalized, multi-email-merged owner identity —
 * 20260220110000_personas_auth_profile_canonicalization.sql), never a
 * persona id. See the migration header (20260930050000_contactgraph_substrate.sql)
 * for why: scoping ContactPerson per active persona would duplicate the
 * same contact every time the owner switches their own active persona.
 *
 * Reuses the existing `PersonaRepo` rather than a second ad hoc query
 * (Extend, Don't Duplicate).
 */

import { PersonaRepo } from '@/services/wallet/personaRepo';
import type { PeerResult } from '@/services/qubetalk/peerChannel';

export async function resolveOwnerAuthProfileId(personaId: string): Promise<PeerResult<string>> {
  // Constructed per-call, not at module scope: PersonaRepo's constructor
  // eagerly resolves Supabase server config and THROWS if it's missing.
  // Callers on the live ingestion path (ingestion.ts) expect a PeerResult,
  // never an exception — a transiently unavailable/unconfigured Supabase
  // client degrades ContactGraph resolution gracefully (the caller falls
  // back to QubeTalk's own unresolved-participant behavior) rather than
  // crashing the whole ingress pipeline.
  let repo: PersonaRepo;
  try {
    repo = new PersonaRepo();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Supabase unavailable' };
  }
  const persona = await repo.getById(personaId);
  if (!persona) return { ok: false, error: 'persona not found', code: 'not_found' };
  if (!persona.auth_profile_id) {
    return { ok: false, error: 'persona has no auth_profile_id', code: 'no_owner_identity' };
  }
  return { ok: true, value: persona.auth_profile_id };
}
