/**
 * policyResolvers — per-action policy hooks for evaluateAccess.
 *
 * Phase 1.3 of the unified identity-content-access foundation plan.
 *
 * Centralises the small set of per-action decisions that should NOT be
 * scattered across surfaces:
 *   - Which actions require synchronous DVN receipt anchoring before the
 *     decision is returned (vs async fire-and-forget). Operator §11.2:
 *     async by default; sync for mint, transfer, payment-settle,
 *     policy-escalation, disclosure.
 *   - Which credential strings drive which on-chain / canister
 *     verification path. (Stub today; Phase 3 wires DVN policy hooks.)
 *
 * Routes never set sync mode themselves. They pass requireSyncReceipt as
 * a hint; this module decides whether the action actually qualifies and
 * downgrades to async with a log if not.
 */

import type { AccessAction, ReceiptMode } from '@/types/access';

/**
 * The set of actions where the receipt IS the proof and must be anchored
 * before the action is considered complete. Per operator decision §11.2.
 */
const SYNC_RECEIPT_ACTIONS: ReadonlySet<AccessAction> = new Set<AccessAction>([
  'mint',
  'transfer',
  'payment-settle',
  'policy-escalation',
  'disclosure',
]);

/**
 * Resolve the receipt mode for an action.
 *
 * @param action  The action being gated.
 * @param hint    Caller-provided hint. Honoured only if the action
 *                qualifies for sync per operator decision; otherwise
 *                downgraded to async (rate-limit + log handled by
 *                evaluateAccess, not here).
 */
export function resolveReceiptMode(
  action: AccessAction,
  hint: boolean | undefined,
): ReceiptMode {
  if (SYNC_RECEIPT_ACTIONS.has(action)) {
    // Default-sync for the consequential set, regardless of caller hint.
    // Async hint is honoured only if the action does NOT belong to the
    // consequential set; consequential actions cannot opt out of sync.
    return 'sync';
  }
  return hint ? 'async' : 'async';
}

/**
 * Returns true if the given credential string indicates a credential
 * that requires on-chain or canister verification beyond the simple
 * cartridge-flag check (admin / partner). Phase 3 wires the actual
 * verifier; today this is a classifier only.
 */
export function credentialRequiresExternalVerifier(credential: string | undefined): boolean {
  if (!credential) return false;
  return (
    credential.startsWith('cohort:') ||
    credential.startsWith('token:')
  );
}

/**
 * Cartridge-flag credentials that resolve from ActivePersonaContext
 * directly (no canister or chain lookup). Phase 1 baseline.
 */
export function credentialMatchesCartridgeFlag(
  credential: string | undefined,
  flags: { isAdmin: boolean; isPartner: boolean },
): boolean {
  if (!credential) return false;
  if (credential === 'admin')   return flags.isAdmin;
  if (credential === 'partner') return flags.isPartner;
  return false;
}
