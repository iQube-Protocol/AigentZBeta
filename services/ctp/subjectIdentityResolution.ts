/**
 * ctp subject DiDQube resolution (DiDQube Phase 4 item 3, 2026-09-07,
 * execution plan §Phase 4) — the Constitutional Runtime's ONE additional
 * read, resolving "which constitutional identity is this transition's
 * subject" onto every transition/refusal receipt, additive and never a
 * gate on authority or authorization (each primitive's own concern,
 * untouched by this module).
 *
 * `subjectPersonaId` (ResolvedParticipants) names no DiDQube anchor
 * directly — CTP's own participants are persona-scoped (subjectRequirement
 * is 'PERSONHOOD' for every primitive registered so far), so this walks the
 * same already-populated FK the Passport wallet route and Factor's own
 * resolution already use: polity_passport_records.persona_id ->
 * kybe_identity_id -> resolveDiDQube({kind:'kybe_identity_id', ...}).
 * Live-verified (2026-09-07, Aigent Z project bsjhfvctmduxhohtllly): only
 * 1 of 14 citizen passport rows currently carries a populated
 * kybe_identity_id — most personas will honestly resolve as unresolved
 * today. That is expected, not a defect; this is additive evidence, never
 * a precondition for a CTP transition to proceed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveDiDQube, type DiDQubeSubjectClass } from '@/services/identity/didQubeResolver';

export interface SubjectDiDQubeSnapshot {
  subjectDidqubeId: string | null;
  subjectDidqubeClass: DiDQubeSubjectClass | null;
  subjectResolutionCommitment: string | null;
  subjectResolutionCommitmentVersion: string | null;
}

export const EMPTY_SUBJECT_DIDQUBE_SNAPSHOT: SubjectDiDQubeSnapshot = {
  subjectDidqubeId: null,
  subjectDidqubeClass: null,
  subjectResolutionCommitment: null,
  subjectResolutionCommitmentVersion: null,
};

/**
 * NEVER throws, by construction — this is additive evidence on the
 * Constitutional Runtime's single canonical seam; a failure here must never
 * abort a transition or refusal write that has nothing to do with identity
 * resolution. Any read error, an admin double that doesn't support this
 * query shape (a caller-supplied stub scoped to only what IT needs), or an
 * absent lineage all resolve to the empty snapshot, honestly, rather than
 * blocking or fabricating a resolution.
 */
export async function resolveSubjectDiDQubeSnapshot(
  admin: SupabaseClient,
  subjectPersonaId: string,
): Promise<SubjectDiDQubeSnapshot> {
  try {
    const { data, error } = await admin
      .from('polity_passport_records')
      .select('kybe_identity_id')
      .eq('persona_id', subjectPersonaId)
      .limit(5);
    if (error) return EMPTY_SUBJECT_DIDQUBE_SNAPSHOT;
    const rows = (data ?? []) as Array<{ kybe_identity_id?: string | null }>;
    const kybeIdentityId = rows.map((r) => r.kybe_identity_id).find((v): v is string => Boolean(v));
    if (!kybeIdentityId) return EMPTY_SUBJECT_DIDQUBE_SNAPSHOT;

    const resolution = await resolveDiDQube({ kind: 'kybe_identity_id', kybeIdentityId });
    if (resolution.state !== 'resolved') return EMPTY_SUBJECT_DIDQUBE_SNAPSHOT;
    return {
      subjectDidqubeId: resolution.primitive.didqubeId,
      subjectDidqubeClass: resolution.primitive.subjectClass,
      subjectResolutionCommitment: resolution.primitive.publicCommitment.value,
      subjectResolutionCommitmentVersion: resolution.primitive.publicCommitment.commitmentVersion,
    };
  } catch {
    return EMPTY_SUBJECT_DIDQUBE_SNAPSHOT;
  }
}
