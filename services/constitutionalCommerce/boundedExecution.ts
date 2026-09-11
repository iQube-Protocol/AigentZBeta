/**
 * Bounded Execution — binds an AUTHORISED ActionAuthorisation to a
 * CommerceExecution record (VELA-001, downstream of Slice 2F's
 * deriveActionAuthorisation()).
 *
 * Mirrors services/constitutional/settlementExecutor.ts's established
 * pattern exactly: a pure, deterministic function that builds an execution
 * INTENT bound to the authorisation, and NEVER signs or broadcasts anything.
 * No production execution and no fund movement is in scope for this slice —
 * actual on-chain dispatch stays a separate, human-supervised step outside
 * the constitutional layer, exactly as settlementExecutor.ts already
 * establishes for money-moving domains.
 *
 * Execution requires a SPECIFIC, CURRENT authorisation:
 *   - `authorisation.status !== 'AUTHORISED'` → refused (nothing to execute —
 *     REFUSED and UNRESOLVED authorisations are both non-executable, and are
 *     never silently treated as "close enough")
 *   - `authorisation.expiresAt` in the past relative to `now` → refused (an
 *     expired authorisation is not a current one, even though its `status`
 *     field still literally reads 'AUTHORISED' until something
 *     re-evaluates it — this is the one place that must not trust a stale
 *     status word over an actual clock comparison)
 *
 * Server-side only. Pure: node crypto only, no clock, no network — `now` is
 * always supplied by the caller so tests stay deterministic.
 */

import { createHash } from 'crypto';
import type { ActionAuthorisation, CommerceExecution } from '@/types/constitutionalCommerce';

export interface BoundedExecutionResult {
  status: 'execution_bound' | 'refused';
  execution: CommerceExecution | null;
  reason: string;
}

function ref(namespace: string, value: string): string {
  return createHash('sha256').update(namespace).update(value).digest('hex').slice(0, 32);
}

export interface BindExecutionInput {
  authorisation: ActionAuthorisation;
  signerRef: string;
  /** ISO timestamp; only ever supplied by the caller. */
  now: string;
  network?: string;
}

/** Build a deterministic execution intent bound to a current AUTHORISED
 *  authorisation. PURE. Never signs, broadcasts, or moves funds — see file
 *  docs. */
export function bindExecution(input: BindExecutionInput): BoundedExecutionResult {
  const { authorisation, signerRef, now, network } = input;

  if (authorisation.status !== 'AUTHORISED') {
    return {
      status: 'refused',
      execution: null,
      reason: `authorisation status is '${authorisation.status}', not AUTHORISED — execution requires a specific, current authorisation`,
    };
  }

  if (authorisation.expiresAt && new Date(now).getTime() > new Date(authorisation.expiresAt).getTime()) {
    return {
      status: 'refused',
      execution: null,
      reason: `authorisation expired at ${authorisation.expiresAt} (now ${now}) — a lapsed AUTHORISED record is not a current one`,
    };
  }

  const executionRef = ref(
    'execution:',
    `${authorisation.authorisationRef}|${authorisation.actionRef}|${signerRef}|${now}`,
  );

  return {
    status: 'execution_bound',
    execution: {
      executionRef,
      authorisationRef: authorisation.authorisationRef,
      actionRef: authorisation.actionRef,
      signerRef,
      network,
      // transactionRef intentionally absent — this module binds an execution
      // intent to a current authorisation; it never signs or broadcasts a
      // transaction. Real dispatch is a separate, human-supervised step, the
      // same discipline settlementExecutor.ts applies to money-moving domains.
    },
    reason: 'execution intent bound to a current AUTHORISED authorisation',
  };
}
