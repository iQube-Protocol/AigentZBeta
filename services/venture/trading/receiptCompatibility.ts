/**
 * VL-CT-001 — the deployment/runtime compatibility check.
 *
 *   > Relying on an insert failure is too quiet for a consequential pipeline.
 *     (operator ruling, 2026-07-29)
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
 * installed by `20260929000100` and locked down by `20260929000200`) returns
 * the set of `venture_*` action types the deployed constraint accepts. Its
 * PRESENCE is the version marker; its RETURN VALUE is the vocabulary. The
 * application refuses to emit a live venture receipt unless both check out, and
 * the refusal names the exact SQL to run.
 *
 * FAIL CLOSED, ALWAYS. Probe missing, probe erroring, constraint absent,
 * vocabulary short — every one of them refuses. A compatibility check that
 * proceeds on "couldn't tell" is the quiet failure again, one layer up.
 *
 * ─── TWO LAYERS, DIFFERENT FREQUENCIES (operator RULING 1, 2026-07-29) ──────
 *
 *   > Wire it into the Amplify deployment pipeline: after migrations, before
 *   > application promotion. Deployment must FAIL on incompatibility. Keep the
 *   > runtime emission guard as defence in depth — but explicitly do not run
 *   > the database probe on every request or cold start.
 *
 *  1. DEPLOY-TIME — THE GATE. `scripts/check-venture-receipt-constraint.ts`
 *     calls `ventureReceiptDeploymentCheck()` in the Amplify build phase and
 *     exits non-zero on incompatibility, so the artifact is never promoted
 *     against a database that cannot accept its receipts. Runs ONCE per deploy.
 *
 *  2. EMISSION-TIME — THE BACKSTOP. `persistVentureReceipt` /
 *     `anchorVentureReceipt` call `assertVentureReceiptConstraintCompatible`
 *     before the writer, so no live emission path can skip the check even if
 *     the database changed under a running deployment. It is MEMOISED per
 *     process (see `memoisedProbe` below): a positive answer is probed once and
 *     reused, so this is not a per-request round trip, and nothing here runs at
 *     module load, so it is not a cold-start round trip either.
 *
 * Phase 1 emits nothing live — the fixture guard refuses first — so today the
 * backstop is a gate in front of a door nobody opens yet. That is the point: it
 * is in place BEFORE Phase 2 opens the door, not added after the first silent
 * loss.
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

/**
 * The migration that locks the probe down to `service_role` and narrows its
 * return to the minimum compatibility result (RULING 2). Named in the remedy
 * because a database carrying only the first two migrations has a probe that
 * still answers — from `anon`.
 */
export const VENTURE_RECEIPT_PROBE_LOCKDOWN_MIGRATION =
  'supabase/migrations/20260929000200_venture_receipt_probe_lockdown.sql';

/** The database function that reports the accepted venture action types. */
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
 * The probe's result as the application sees it — the MINIMUM compatibility
 * result, not the whole constraint definition (RULING 2):
 *
 *  - a string[] → exactly the `venture_*` action types the deployed constraint
 *                 accepts. Empty array = the constraint exists and accepts none.
 *  - `null`     → the probe ran and found no such constraint.
 *  - a throw    → the probe itself is unavailable (function missing, revoked,
 *                 no client, network failure). Treated as incompatible.
 */
export type VentureConstraintProbe = () => Promise<readonly string[] | null>;

function remedyFor(reason: VentureReceiptIncompatibility, missing: readonly string[]): string {
  const base =
    `Venture receipt emission is REFUSED: the activity_receipts action_type constraint is not at ` +
    `${VENTURE_RECEIPT_CONSTRAINT_VERSION}. Apply, in order, ${VENTURE_RECEIPT_ACTION_TYPE_MIGRATION}, ` +
    `${VENTURE_RECEIPT_PROBE_MIGRATION}, then ${VENTURE_RECEIPT_PROBE_LOCKDOWN_MIGRATION}, in the ` +
    `Supabase SQL editor.`;
  if (reason === 'probe-unavailable') {
    return `${base} The probe function public.${VENTURE_RECEIPT_CONSTRAINT_PROBE}() is missing, revoked, or unreadable by this caller, so the deployed vocabulary cannot be verified at all.`;
  }
  if (reason === 'constraint-absent') {
    return `${base} The constraint activity_receipts_action_type_check does not exist on this database.`;
  }
  return `${base} The deployed constraint rejects: ${missing.join(', ')}.`;
}

/**
 * Pure evaluation, separated from the I/O so the decision is testable without a
 * database and so the failure modes can be driven directly.
 *
 * Membership is EXACT against the probe's set. It is not a substring test over
 * a definition string: a value that merely appears in the constraint's text
 * (in a comment, say) is not a value the database accepts, and the quoted-
 * literal extraction that establishes that now lives in the probe itself.
 */
export function evaluateVentureReceiptConstraint(
  acceptedActionTypes: readonly string[] | null,
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
  if (acceptedActionTypes === null) {
    return {
      compatible: false,
      requiredVersion: VENTURE_RECEIPT_CONSTRAINT_VERSION,
      reason: 'constraint-absent',
      missingActionTypes: [...VENTURE_RECEIPT_ACTION_TYPES],
      remedy: remedyFor('constraint-absent', VENTURE_RECEIPT_ACTION_TYPES),
    };
  }
  const accepted = new Set(acceptedActionTypes);
  const missing = VENTURE_RECEIPT_ACTION_TYPES.filter((t) => !accepted.has(t));
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
 * The default probe: call the database function through the service-role
 * client. Imported dynamically so this module stays importable (and the pure
 * evaluation stays testable) with no Supabase configuration present.
 *
 * The service role is the ONLY role that may execute it after
 * `20260929000200`; a call made with an anon or authenticated key now fails,
 * which the evaluation correctly reads as `probe-unavailable` rather than as
 * compatibility.
 */
export const defaultConstraintProbe: VentureConstraintProbe = async () => {
  const { getSupabaseServer } = await import('@/app/api/_lib/supabaseServer');
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing — cannot verify the venture receipt constraint');
  const { data, error } = await client.rpc(VENTURE_RECEIPT_CONSTRAINT_PROBE);
  if (error) throw new Error(`probe ${VENTURE_RECEIPT_CONSTRAINT_PROBE}() failed: ${error.message}`);
  if (data === null || data === undefined) return null;
  if (!Array.isArray(data)) {
    throw new Error(`probe ${VENTURE_RECEIPT_CONSTRAINT_PROBE}() returned ${typeof data}, expected text[]`);
  }
  return data.filter((v): v is string => typeof v === 'string');
};

/**
 * Diagnose without throwing — for the deploy gate, a health route, or an
 * operator asking "is this database ready for venture receipts?".
 *
 * NOT memoised. The deploy gate wants a fresh answer every time it is asked;
 * memoisation belongs to the emission backstop, which is the layer that would
 * otherwise probe per request.
 */
export async function ventureReceiptDeploymentCheck(
  probe: VentureConstraintProbe = defaultConstraintProbe,
): Promise<VentureReceiptCompatibility> {
  let accepted: readonly string[] | null;
  try {
    accepted = await probe();
  } catch {
    // A probe that cannot run is not evidence of compatibility.
    return evaluateVentureReceiptConstraint(null, false);
  }
  return evaluateVentureReceiptConstraint(accepted, true);
}

/**
 * Per-process memo for the EMISSION BACKSTOP only (RULING 1).
 *
 * Keyed on probe identity, so an injected test probe never shares a cache with
 * the default one and every canary drives the real code path.
 *
 * ONLY POSITIVE ANSWERS ARE CACHED. An incompatible answer is evicted, so a
 * process that started against an unmigrated database recovers the moment the
 * operator applies the migration — no redeploy, no restart. Caching the
 * negative would turn a five-minute fix into a deploy cycle, and caching it
 * across a fix would be a gate reporting a state that is no longer true.
 *
 * The map holds the in-flight PROMISE, so concurrent first emissions share one
 * round trip instead of stampeding the database on a cold start.
 *
 * Nothing here runs at module load. The first probe happens on the first LIVE
 * emission attempt, which in Phase 1 never occurs at all.
 */
const memoisedProbe = new WeakMap<VentureConstraintProbe, Promise<VentureReceiptCompatibility>>();

async function compatibilityForEmission(
  probe: VentureConstraintProbe,
): Promise<VentureReceiptCompatibility> {
  const cached = memoisedProbe.get(probe);
  if (cached) return cached;
  const pending = ventureReceiptDeploymentCheck(probe);
  memoisedProbe.set(probe, pending);
  const compatibility = await pending;
  if (!compatibility.compatible) memoisedProbe.delete(probe);
  return compatibility;
}

/**
 * The emission backstop. Throws with the exact remedy when the deployed
 * vocabulary is not at the required version. Called before any live venture
 * receipt write, so a missing migration is loud and immediate rather than a
 * swallowed insert failure deep in the pipeline.
 *
 * The deploy gate is the primary defence; this is defence in depth for the
 * window in which a running deployment outlives the schema it was promoted
 * against.
 */
export async function assertVentureReceiptConstraintCompatible(
  probe: VentureConstraintProbe = defaultConstraintProbe,
): Promise<void> {
  const compatibility = await compatibilityForEmission(probe);
  if (!compatibility.compatible) {
    // Escalation-level, and prefixed so it is findable in CloudWatch alongside
    // the DVN escalations it would otherwise silently precede.
    console.error('[VENTURE RECEIPT COMPATIBILITY]', compatibility.remedy);
    throw new VentureReceiptCompatibilityError(compatibility);
  }
}
