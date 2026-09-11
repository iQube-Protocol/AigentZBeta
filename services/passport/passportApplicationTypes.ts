/**
 * `polity_passport_applications` row shape — the subset of columns the
 * auto-issuance evaluator and decision engine read. Not the full table
 * (see supabase/migrations/20260610000000_polity_passport_bureau.sql for
 * that); this is the narrow, grounded slice those two modules actually use,
 * kept as one type so they can't drift against each other's assumptions.
 */
export interface PolityPassportApplicationRow {
  id: string;
  passport_class: string;
  application_status: string;
  persona_id: string | null;
  personhood_proof_type: string | null;
  personhood_proof_ref: string | null;
  consents: Record<string, unknown> | null;
  review_priority: string | null;
  passport_grade: string | null;
}
