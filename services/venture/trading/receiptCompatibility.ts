/**
 * VL-CT-001 — the deployment/runtime compatibility check (operator RULING 5).
 *
 *   > Relying on an insert failure is too quiet for a consequential pipeline.
 *
 * ─── The failure this replaces ──────────────────────────────────────────────
 *
 * The nine venture action types are declared twice: once in the TypeScript
 * `ActivityActionType` union, once in the `activity_receipts` CHECK constraint.
 * With the migration unapplied, everything typechecks, every canary passes, the
 * deploy is green — and the FIRST live receipt fails a CHECK violation deep
 * inside a write that several call sites in this repo wrap in an empty catch.
 * The row is lost, the DVN anchor with it, and the deployment is broken with
 * nothing saying so. The symptom surfaces later as an unexplained gap in the
 * provenance trail, which is exactly the evidence that would be needed to
 * diagnose it.
 *
 * ─── What this does instead ─────────────────────────────────────────────────
 *
 * A probe function in the database (`venture_receipt_action_type_constraint`,
 * added by `supabase/migrations/20260929000100_venture_receipt_constraint_probe.sql`)
 * returns the constraint's definition. Its PRESENCE is the version marker; its
 * RETURN VALUE is the vocabulary. The application refuses to emit a live venture
 * receipt unless both check out, and the refusal names the exact SQL to run.
 *
 * FAIL CLOSED, ALWAYS. Probe missing, probe erroring, constraint absent,
 * vocabulary short — every one of them refuses. A compatibility check that
 * proceeds on "couldn't tell" is the quiet failure again, one layer up.
 *
 * ─── Where it runs ──────────────────────────────────────────────────────────
 *
 *  - `persistVentureReceipt` / `anchorVentureReceipt` (`./receipts.ts`) call it
 *    before the writer, so no live emission path can skip it.
 *  - `ventureReceiptDeploymentCheck()` is the same evaluation without the throw,
 *    for a deploy step or an ops route that wants the diagnosis rather than the
 *    exception.
 *
 * Phase 1 emits nothing live — the fixture guard refuses first — so today this
 * is a gate in front of a door nobody opens yet. That is the point: it is in
 * place BEFORE Phase 2 opens the door, not added after the first silent loss.
 */

import { VENTURE_RECEIPT_ACTION_TYPES } from './receipts';

/**
 * The constraint version this build requires. Bump when a later migration adds
 * venture action types, so a deploy carrying new types against an old database
 * is refused rather than discovered.
 */
export const VENTURE_RECEIPT_CONSTRAINT_VERSION = 'venture-substrate-receipt-types/1';

/** The migration that installs the vocabulary. */
export const VENTURE_RECEIPT_ACTION_TYPE_MIGRATION =
  'supabase/migrations/20260929000000_venture_substrate_receipt_types.sql';

/** The migration that installs the probe this module calls. */
export const VENTURE_RECEIPT_PROBE_MIGRATION =
  'supabase/migrations/20260929000100_venture_receipt_constraint_probe.sql';

/** The database function that reports the constraint definition. */
export const VENTURE_RECEIPT_CONSTRAINT_PROBE = 'venture_receipt_action_type_constraint';

export type VentureReceiptIncompatibility =
  | 'probe-unavailable'
  | 'constraint-absent'
  | 'action-types-missing';

export interface VentureReceiptCompatibility {
  compatible: boolean;
  requiredVersion: string;
  reason?: VentureReceiptIncompatibility;
  /** Which of the nine the deployed constraint does not accept. */
  missingActionTypes: string[];
  /** Operator-facing instruction, naming the exact files to run. */
  remedy?: string;
}

/**
 * The probe's result as the application sees it.
 *  - a string  → the constraint definition
 *  - `null`    → the probe ran and found no such constraint
 *  - a throw   → the probe itself is unavailable (function missing, no client,
 *                network failure). Treated as incompatible.
 */
export type VentureConstraintLoader = () => Promise<string | null>;

function remedyFor(reason: VentureReceiptIncompatibility, missing: readonly string[]): string {
  const base =
    `Venture receipt emission is REFUSED: the activity_receipts action_type constraint is not at ` +
    `${VENTURE_RECEIPT_CONSTRAINT_VERSION}. Apply, in order, ${VENTURE_RECEIPT_ACTION_TYPE_MIGRATION} ` +
    `then ${VENTURE_RECEIPT_PROBE_MIGRATION}, in the Supabase SQL editor.`;
  if (reason === 'probe-unavailable') {
    return `${base} The probe function public.${VENTURE_RECEIPT_CONSTRAINT_PROBE}() is missing or unreadable, so the deployed vocabulary cannot be verified at all.`;
  }
  if (reason === 'constraint-absent') {
    return `${base} The constraint activity_receipts_action_type_check does not exist on this database.`;
  }
  return `${base} The deployed constraint rejects: ${missing.join(', ')}.`;
}

/**
 * Pure evaluation, separated from the I/O so the decision is testable without a
 * database and so the failure modes can be driven directly.
 */
export function evaluateVentureReceiptConstraint(
  definition: string | null,
  probeAvailable: boolean,
): VentureReceiptCompatibility {
  if (!probeAvailable) {
    return {
      compatible: false,
      requiredVersion: VENTURE_RECEIPT_CONSTRAINT_VERSION,
      reason: 'probe-unavailable',
      missingActionTypes: [...VENTURE_RECEIPT_ACTION_TYPES],
      remedy: remedyFor('probe-unavailable', VENTURE_RECEIPT_ACTION_TYPES),
    };
  }
  if (!definition) {
    return {
      compatible: false,
      requiredVersion: VENTURE_RECEIPT_CONSTRAINT_VERSION,
      reason: 'constraint-absent',
      missingActionTypes: [...VENTURE_RECEIPT_ACTION_TYPES],
      remedy: remedyFor('constraint-absent', VENTURE_RECEIPT_ACTION_TYPES),
    };
  }
  // Matched as a QUOTED LITERAL, not a substring: `'venture_opportunity_opened'`
  // must be an accepted value, not merely a sequence of characters occurring
  // somewhere in the definition text.
  const missing = VENTURE_RECEIPT_ACTION_TYPES.filter((t) => !definition.includes(`'${t}'`));
  if (missing.length > 0) {
    return {
      compatible: false,
      requiredVersion: VENTURE_RECEIPT_CONSTRAINT_VERSION,
      reason: 'action-types-missing',
      missingActionTypes: [...missing],
      remedy: remedyFor('action-types-missing', missing),
    };
  }
  return {
    compatible: true,
    requiredVersion: VENTURE_RECEIPT_CONSTRAINT_VERSION,
    missingActionTypes: [],
  };
}

/** Thrown when a live venture receipt is emitted against an incompatible schema. */
export class VentureReceiptCompatibilityError extends Error {
  readonly compatibility: VentureReceiptCompatibility;
  constructor(compatibility: VentureReceiptCompatibility) {
    super(compatibility.remedy ?? 'venture receipt constraint is incompatible');
    this.name = 'VentureReceiptCompatibilityError';
    this.compatibility = compatibility;
  }
}

/**
 * The default loader: call the probe through the service-role client. Imported
 * dynamically so this module stays importable (and the pure evaluation stays
 * testable) with no Supabase configuration present.
 */
async function defaultConstraintLoader(): Promise<string | null> {
  const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing — cannot verify the venture receipt constraint');
  const { data, error } = await client.rpc(VENTURE_RECEIPT_CONSTRAINT_PROBE);
  if (error) throw new Error(`probe ${VENTURE_RECEIPT_CONSTRAINT_PROBE}() failed: ${error.message}`);
  return typeof data === 'string' && data.length > 0 ? data : null;
}

/**
 * Diagnose without throwing — for a deploy step, a health route, or an operator
 * asking "is this database ready for venture receipts?".
 */
export async function ventureReceiptDeploymentCheck(
  load: VentureConstraintLoader = defaultConstraintLoader,
): Promise<VentureReceiptCompatibility> {
  let definition: string | null;
  try {
    definition = await load();
  } catch {
    // A probe that cannot run is not evidence of compatibility.
    return evaluateVentureReceiptConstraint(null, false);
  }
  return evaluateVentureReceiptConstraint(definition, true);
}

/**
 * The gate. Throws with the exact remedy when the deployed vocabulary is not at
 * the required version. Called before any live venture receipt write, so a
 * missing migration is loud and immediate rather than a swallowed insert
 * failure deep in the pipeline.
 */
export async function assertVentureReceiptConstraintCompatible(
  load: VentureConstraintLoader = defaultConstraintLoader,
): Promise<void> {
  const compatibility = await ventureReceiptDeploymentCheck(load);
  if (!compatibility.compatible) {
    // Escalation-level, and prefixed so it is findable in CloudWatch alongside
    // the DVN escalations it would otherwise silently precede.
    console.error('[VENTURE RECEIPT COMPATIBILITY]', compatibility.remedy);
    throw new VentureReceiptCompatibilityError(compatibility);
  }
}
