/**
 * Execution Return — the cybernetic return path (Homecoming Phase II WP-B,
 * operator-directed 2026-08-16).
 *
 * The Implementation Pack sends bounded intent OUTWARD to an executing actor
 * (Claude Code under the operator's subscription, or any other actor working
 * from a copied pack). Execution Return brings EVIDENCE of what actually
 * executed back IN — qualitative, human-reviewed fields (branch, commits,
 * PR, files changed, validation results, deviations, failures, discoveries,
 * consequence observations), never a numeric telemetry stream. Deliberately
 * NOT `ExecutionTelemetry` (services/constitutional/executionTelemetry.ts) —
 * that module is the observation ledger for an automated CI dispatch's own
 * terminal result JSON (tokens, cost, turns); this one is the manual/
 * external-actor counterpart for a human-reviewed handoff, mirrored in
 * shape and spirit but never imported/reused, per the audited WP-B plan.
 *
 * An Execution Return NEVER becomes a new authority mechanism. It describes
 * what executed and what evidence came back — it does not grant, widen, or
 * imply any delegation authority (the three-axis model from WP-A is
 * unaffected), and it never itself authorizes deployment: no
 * `deployment_authorized` receipt is ever written by this path. The ONLY
 * thing an accepted Execution Return does downstream is satisfy
 * `canEnterValidation()` (services/devCommandCenter/devLoop.ts) — a
 * necessary, not sufficient, condition to leave the Implementation stage.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export interface ExecutionReturnValidationResult {
  name: string;
  status: 'passed' | 'failed' | 'not-run';
  detail?: string;
}

export interface ExecutionReturn {
  packId: string;
  /** The identity of the actor that executed the pack — a label (e.g.
   *  "claude-code", "operator-manual"), never a persona/root/kybe identifier.
   *  Preserved verbatim; never attributed to "DevOn" — DevOn orchestrates
   *  the handoff, it does not itself execute. */
  actor: string;
  branch?: string | null;
  commits?: string[];
  pullRequest?: { number?: number; url?: string } | null;
  filesChanged: string[];
  validationResults: ExecutionReturnValidationResult[];
  deviationsFromPack: string[];
  failuresOrEscalations: string[];
  discoveries: string[];
  consequenceObservations: string[];
  completedAt: string;
}

/**
 * Three-valued, same discipline as `getActivityReceiptActionInput`: `true` =
 * a matching `implementation_pack_generated` receipt was found — the packId
 * is real; `false` = queried successfully, no match; `null` = the query
 * itself could not be completed (missing config, network/DB error).
 *
 * Callers MUST treat `false` and `null` identically — FAIL CLOSED on any
 * doubt. An Execution Return is refused unless the pack's existence is
 * POSITIVELY confirmed; "could not check" is never treated as "exists".
 */
export async function verifyPackExists(packId: string): Promise<boolean | null> {
  if (!packId) return false;
  const client = getSupabaseServer();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('activity_receipts')
      .select('id')
      .eq('action_type', 'implementation_pack_generated')
      .eq('action_input->>pack_id', packId)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data != null;
  } catch {
    return null;
  }
}

/**
 * The existing, ALREADY-ACCEPTED Execution Return receipt id for this
 * packId, if any — the deterministic-replay check. Same three-valued
 * discipline as `verifyPackExists`; a caller unable to check for an existing
 * return must NOT proceed to record a new one (fail closed, never risk a
 * silent duplicate).
 */
export async function findAcceptedExecutionReturn(packId: string): Promise<string | null | undefined> {
  if (!packId) return null;
  const client = getSupabaseServer();
  if (!client) return undefined;
  try {
    const { data, error } = await client
      .from('activity_receipts')
      .select('id')
      .eq('action_type', 'implementation_execution_returned')
      .eq('action_input->>pack_id', packId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return undefined;
    return data ? (data as { id: string }).id : null;
  } catch {
    return undefined;
  }
}

/**
 * Persists an Execution Return via the existing receipt framework.
 * T2-safe: `actingPersonaId` is the receipt's required owning persona (the
 * operator submitting the evidence, not the external actor); the
 * `ExecutionReturn`'s own `actor` field is a plain label, never a
 * persona/root/kybe identifier. Never writes `deployment_authorized` or any
 * other authority-bearing receipt — this is evidence only.
 */
export async function recordExecutionReturn(input: {
  actingPersonaId: string;
  ret: ExecutionReturn;
}): Promise<string | null> {
  const { actingPersonaId, ret } = input;
  try {
    const failedCount = ret.validationResults.filter((v) => v.status === 'failed').length;
    const receipt = await createActivityReceipt({
      personaId: actingPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'implementation_execution_returned',
      summary:
        `Execution Return for pack ${ret.packId} — actor ${ret.actor}: ` +
        `${ret.filesChanged.length} files changed, ${ret.validationResults.length} validation results ` +
        `(${failedCount} failed), ${ret.failuresOrEscalations.length} failures/escalations reported. ` +
        `Evidence only — does not itself authorize deployment.`,
      actionInput: {
        pack_id: ret.packId,
        actor: ret.actor,
        branch: ret.branch ?? null,
        commits: ret.commits ?? [],
        pull_request: ret.pullRequest ?? null,
        files_changed: ret.filesChanged,
        validation_results: ret.validationResults,
        deviations_from_pack: ret.deviationsFromPack,
        failures_or_escalations: ret.failuresOrEscalations,
        discoveries: ret.discoveries,
        consequence_observations: ret.consequenceObservations,
        completed_at: ret.completedAt,
      },
    });
    return receipt?.id ?? null;
  } catch {
    return null;
  }
}
