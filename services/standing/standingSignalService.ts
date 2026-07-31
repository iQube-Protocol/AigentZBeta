/**
 * standingSignalService — the seam that turns work DONE into a verified Standing
 * signal that grounded progress reports read as PROGRESS from the baseline.
 *
 * The ingested VentureQube / operating model is the DECLARED BASELINE (intent).
 * Standing signals are the EVIDENCE of progress. This service records both:
 *
 *   1. An activity receipt (the canonical "actions taken" log, DVN-anchored) —
 *      this is what the Venture Progress / Brief surfaces can cite as real,
 *      traceable work instead of inventing prose.
 *   2. A best-effort Personal Standing accrual (the numeric ledger) via the
 *      existing crm standing engine.
 *
 * Two entry shapes, one seam:
 *   - operator_action_logged   — an action the operator took, on- or off-platform
 *     (produced a document, sent an email, made a call). "Not everything needs
 *     to be attested" — the operator's own log of their own work is a legitimate
 *     Personal Standing signal. (Outcome/value CLAIMS remain verification-gated
 *     via ProofOfOutcomeClaim — this is not that.)
 *   - standing_document_added  — a proof-of-work document uploaded (e.g. a
 *     partner proposal). The uploaded file is the evidence; it also becomes
 *     context aigentMe can ground follow-ups on.
 *
 * Privacy: personaId is T0 (never serialised). The activity receipt + accrual
 * are keyed server-side. The summary is operator-authored T1 text.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  createActivityReceipt,
  type ActivityReceiptRecord,
} from '@/services/receipts/activityReceiptService';
import { accrueStanding, type StandingAccrual } from '@/services/crm/standingAccrualService';

export type StandingSignalKind = 'operator_action_logged' | 'standing_document_added';

/**
 * Default Standing contribution for a single logged action / document. A modest,
 * documented constant — NOT a fabricated business metric. Callers may override
 * per the weight of the work; outcome-scale value still flows through the
 * verification-gated ProofOfOutcomeClaim path, not here.
 */
export const DEFAULT_SIGNAL_CVS = 1;

export interface LogStandingSignalInput {
  /** Auth persona id (T0). */
  personaId: string;
  kind: StandingSignalKind;
  /** Operator-authored description of the work done (T1). */
  summary: string;
  /** Optional cartridge scope for receipt categorisation. */
  activeCartridge?: string;
  /** Optional venture/portfolio public ref this work advances (T2-safe label). */
  ventureRef?: string | null;
  /** Optional persona_uploads id for a proof-of-work document. */
  uploadId?: string | null;
  /** Standing contribution; defaults to DEFAULT_SIGNAL_CVS. */
  cvs?: number;
  /**
   * When false, only the activity receipt (the action log) is written — no
   * numeric Standing accrual. Default true (operator's own work counts).
   */
  accrue?: boolean;
}

export interface LogStandingSignalResult {
  receipt: ActivityReceiptRecord | null;
  accrual: StandingAccrual | null;
}

/**
 * Resolve the CRM persona id for an auth persona. The standing ledger
 * (crm_persona_reputation) is keyed by crm_personas.id, which links to the auth
 * persona via crm_personas.identity_persona_id (see 20251129030000_crm_persona_linking).
 */
async function resolveCrmPersonaId(
  db: SupabaseClient,
  authPersonaId: string,
): Promise<string | null> {
  const { data } = await db
    .from('crm_personas')
    .select('id')
    .eq('identity_persona_id', authPersonaId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Record a unit of work as a Standing signal: an activity receipt (always) plus
 * a best-effort Personal Standing accrual. Returns both; never throws — a
 * standing-ledger failure must not lose the action-log receipt.
 */
export async function logStandingSignal(
  input: LogStandingSignalInput,
): Promise<LogStandingSignalResult> {
  const receipt = await createActivityReceipt({
    personaId: input.personaId,
    actionType: input.kind,
    summary: input.summary.slice(0, 1000),
    activeCartridge: input.activeCartridge ?? 'metame',
    artifactsCreated: input.uploadId ? [input.uploadId] : [],
    contextShared: input.ventureRef ? [input.ventureRef] : [],
  });

  let accrual: StandingAccrual | null = null;
  if (input.accrue !== false) {
    try {
      const db = getSupabaseServer();
      if (db) {
        const crmPersonaId = await resolveCrmPersonaId(db, input.personaId);
        if (crmPersonaId) {
          accrual = await accrueStanding({
            crmPersonaId,
            cvs: input.cvs ?? DEFAULT_SIGNAL_CVS,
            standingType: 'personal',
            sourceEventId: receipt?.id ?? null,
          });
        }
      }
    } catch (err) {
      // Best-effort: the action-log receipt is the durable record; a standing
      // ledger hiccup must not fail the call.
      console.warn(
        `[standingSignalService] accrual failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return { receipt, accrual };
}
