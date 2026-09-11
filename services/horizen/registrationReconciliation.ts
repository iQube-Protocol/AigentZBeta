/**
 * Registration reconciler — durable server-side liveness for the Register
 * stage's confirmation check (Horizen Pilot Closure item 1, 2026-08-09).
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 *
 * `checkAgentRegistrationStatus` (registrationClient.ts) is a single-attempt
 * check by design — "never an internal polling loop... the caller re-invokes
 * this on an interval instead" (registrationClient.ts's own header). The ONE
 * caller that re-invokes it is `RegisterAgentPanel.tsx`'s browser poll, capped
 * at `MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS` = 20 * 8s = 160s. Once that poll
 * gives up — or the tab closes, or the operator disconnects, or the server
 * restarts mid-poll — a broadcast transaction with a
 * `horizen_registration_submitted` receipt and no matching
 * `horizen_agent_registered` receipt has NOTHING left checking on it. It is
 * indistinguishable, from the outside, between "still pending" and
 * "confirmed the moment nobody was polling."
 *
 * Same defect class as DISCREPANCY-REGISTER finding O-2
 * (`finalizeReadyActivityReceipts` had exactly one caller, a manual admin
 * button) — "observability must not be the thing providing liveness." This
 * module is the SAME fix, applied here: a scheduled reconciler that repeats
 * the existing single-attempt check until it resolves, with no new
 * confirmation logic and no rebroadcast.
 *
 * ── WHAT THIS MODULE DOES NOT DO ────────────────────────────────────────────
 *
 *   - It never calls `broadcastAgentRegistration` or
 *     `approveAgentRegistryInvocation` — only `checkAgentRegistrationStatus`,
 *     step 3 of the existing three-step flow. A stranded broadcast is
 *     recovered by asking Horizen/the chain about it again, never by sending
 *     a second transaction.
 *   - It never reimplements what confirmation writes — `buildRegistrationStatusDeps()`
 *     (registrationConfirmationDeps.ts) is the SAME deps object the
 *     interactive status route uses.
 *   - It is agent-generic: which agent to check comes from the submitted
 *     receipt's own `agentsInvoked`/`resolveRegistrableAgentByRuntimeId`,
 *     never a hardcoded slug.
 *
 * ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
 *
 * A submission is "pending" only while no `horizen_agent_registered` receipt
 * exists for that (agent, txHash) pair — read via the existing
 * `findAgentRegistrationReceipts`, never a second query shape. Once
 * confirmed, the next run's pending-set no longer includes it: re-running
 * this reconciler against an already-confirmed registration is a no-op by
 * construction, the same guarantee `finalizeReadyActivityReceipts` gets from
 * its `.eq('receipt_status', 'dvn_pending')` filter.
 *
 * ── EXCEPTION ISOLATION ──────────────────────────────────────────────────────
 *
 * One agent's registration failing to reconcile (Horizen unreachable, RPC
 * timeout, unknown agent) must not stop every OTHER pending registration from
 * being checked — each item is isolated in its own try/catch and reported by
 * name, mirroring the Constitutional Execution Family's Exception Isolation
 * principle ("unsafe records are isolated; safe records continue").
 */

import {
  findReceiptsByActionType,
  findAgentRegistrationReceipts,
} from '@/services/receipts/activityReceiptService';
import { resolveRegistrableAgentByRuntimeId } from './registrableAgents';
import {
  checkAgentRegistrationStatus,
  resolveAgentOwnerWalletAddress,
} from './registrationClient';
import { buildRegistrationStatusDeps } from './registrationConfirmationDeps';
import type { HorizenNetwork } from './identity';

export interface RegistrationReconciliationItemResult {
  agentSlug: string;
  runtimeAgentId: string;
  txHash: string;
  outcome: 'confirmed' | 'still-pending' | 'unresolvable' | 'skipped';
  detail: string;
}

export interface RegistrationReconciliationResult {
  ok: boolean;
  pendingFound: number;
  confirmed: number;
  stillPending: number;
  unresolvable: number;
  skipped: number;
  items: RegistrationReconciliationItemResult[];
  error?: string;
}

/**
 * How many pending submissions one run will check. A scheduled run repeats
 * every few minutes (see the paired GitHub Actions workflow), so a backlog
 * larger than this drains over successive runs rather than risking one run
 * timing out against Horizen's MCP server for every pending agent at once.
 */
const MAX_ITEMS_PER_RUN = 25;

export async function reconcilePendingAgentRegistrations(): Promise<RegistrationReconciliationResult> {
  const result: RegistrationReconciliationResult = {
    ok: false,
    pendingFound: 0,
    confirmed: 0,
    stillPending: 0,
    unresolvable: 0,
    skipped: 0,
    items: [],
  };

  let submitted: Awaited<ReturnType<typeof findReceiptsByActionType>>;
  try {
    submitted = await findReceiptsByActionType('horizen_registration_submitted', { limit: MAX_ITEMS_PER_RUN });
  } catch (err) {
    result.error = `could not read horizen_registration_submitted receipts: ${err instanceof Error ? err.message : String(err)}`;
    return result;
  }

  for (const receipt of submitted) {
    const runtimeAgentId = receipt.agentsInvoked[0];
    const txHash = typeof receipt.actionInput?.txHash === 'string' ? receipt.actionInput.txHash : null;
    if (!runtimeAgentId || !txHash) {
      // A submitted receipt with no subject agent or no txHash cannot be
      // reconciled by anything — reported by name, not silently dropped from
      // the count.
      result.skipped += 1;
      result.items.push({
        agentSlug: 'unknown',
        runtimeAgentId: runtimeAgentId ?? 'unknown',
        txHash: txHash ?? 'unknown',
        outcome: 'skipped',
        detail: 'submitted receipt is missing agentsInvoked[0] or actionInput.txHash — cannot reconcile',
      });
      continue;
    }

    try {
      const agent = resolveRegistrableAgentByRuntimeId(runtimeAgentId);
      if (!agent) {
        result.skipped += 1;
        result.items.push({
          agentSlug: runtimeAgentId,
          runtimeAgentId,
          txHash,
          outcome: 'skipped',
          detail: `"${runtimeAgentId}" no longer resolves to a registrable agent`,
        });
        continue;
      }

      // Already confirmed — via the SAME reader the journey state route and
      // RegisterAgentPanel use, never a second existence check.
      const confirmedFacts = await findAgentRegistrationReceipts(agent.runtimeAgentId);
      if (confirmedFacts.some((f) => f.txHash === txHash)) {
        result.confirmed += 1; // already true before this run — counted, not re-caused
        result.items.push({
          agentSlug: agent.slug,
          runtimeAgentId: agent.runtimeAgentId,
          txHash,
          outcome: 'confirmed',
          detail: 'already confirmed by an earlier check — no-op',
        });
        continue;
      }

      const network = (typeof receipt.actionInput?.network === 'string' ? receipt.actionInput.network : 'base-sepolia') as HorizenNetwork;
      const horizenAgentId = typeof receipt.actionInput?.horizenAgentId === 'string' ? receipt.actionInput.horizenAgentId : null;
      const ownerWalletAddress = await resolveAgentOwnerWalletAddress(agent);
      if (!ownerWalletAddress) {
        result.unresolvable += 1;
        result.items.push({
          agentSlug: agent.slug,
          runtimeAgentId: agent.runtimeAgentId,
          txHash,
          outcome: 'unresolvable',
          detail: `${agent.displayName} has no custodied wallet on record — cannot reread the registry for her. The broadcast transaction is unaffected.`,
        });
        continue;
      }

      // THE ONLY CALL THAT DOES REAL WORK — the existing, unmodified,
      // single-attempt check. Never broadcast, never re-signed.
      const status = await checkAgentRegistrationStatus(
        {
          agentSlug: agent.slug,
          txHash,
          ownerWalletAddress,
          horizenAgentId,
          network,
          actorPersonaId: receipt.personaId,
          rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
        },
        buildRegistrationStatusDeps(),
      );

      if (!status.ok) {
        result.stillPending += 1;
        result.items.push({
          agentSlug: agent.slug,
          runtimeAgentId: agent.runtimeAgentId,
          txHash,
          outcome: 'still-pending',
          detail: `check refused (${status.refusalCode}): ${status.detail}`,
        });
        continue;
      }

      if (status.value.confirmed) {
        result.confirmed += 1;
        result.items.push({
          agentSlug: agent.slug,
          runtimeAgentId: agent.runtimeAgentId,
          txHash,
          outcome: 'confirmed',
          detail: `confirmed via ${status.value.confirmationSource ?? 'unknown source'} — tokenId ${status.value.tokenId ?? 'unknown'}`,
        });
      } else {
        result.stillPending += 1;
        result.items.push({
          agentSlug: agent.slug,
          runtimeAgentId: agent.runtimeAgentId,
          txHash,
          outcome: 'still-pending',
          detail: 'Horizen has not confirmed and the chain read did not independently verify — will retry next run',
        });
      }
    } catch (err) {
      // ONE agent's exception must not stop the rest of the batch.
      result.unresolvable += 1;
      result.items.push({
        agentSlug: runtimeAgentId,
        runtimeAgentId,
        txHash,
        outcome: 'unresolvable',
        detail: `threw during reconciliation: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  result.pendingFound = submitted.length;
  result.ok = true;
  return result;
}
