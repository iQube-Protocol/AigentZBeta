/**
 * Canonical read for a persona's own Passport application status rows.
 *
 * Extracted (Use Case Zero reconciliation, 2026-09-06) from
 * app/api/passport/applications/status/route.ts, which previously ran this
 * exact query inline with no exported/reusable function — a second caller
 * (services/factor/useCaseZeroReadinessProjection.ts) needing the SAME data
 * would otherwise have had to duplicate the query rather than reuse it
 * (CLAUDE.md "Extend, Don't Duplicate" / source-of-truth parity). The route
 * now calls this function too, so there is exactly one place this query is
 * written.
 *
 * T1-safe fields only — no raw DIDs, no vault content ids.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PassportApplicationStatusRow {
  applicationId: string;
  passportClass: string | null;
  applicationStatus: string | null;
  passportGrade: string | null;
  personhoodProofType: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string | null;
}

/** The persona's own application rows, most recent first. Empty array means
 *  no application has ever been filed — never distinguished from "unknown"
 *  by this function; callers decide what an empty result means for them. */
export async function getPassportApplicationStatus(
  admin: SupabaseClient,
  personaId: string,
  limit = 20,
): Promise<PassportApplicationStatusRow[]> {
  const { data, error } = await admin
    .from('polity_passport_applications')
    .select('id, passport_class, application_status, passport_grade, personhood_proof_type, submitted_at, decided_at, created_at')
    .eq('persona_id', personaId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    applicationId: String(row.id),
    passportClass: row.passport_class,
    applicationStatus: row.application_status,
    passportGrade: row.passport_grade,
    personhoodProofType: row.personhood_proof_type,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  }));
}
