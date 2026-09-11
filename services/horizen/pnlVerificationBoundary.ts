/**
 * The production wiring boundary for
 * services/horizen/pnlServiceVerification.ts's discoverAndReceiptPnlServiceEvidence
 * (Horizen Pilot Closure item 4, 2026-08-09).
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * discoverAndReceiptPnlServiceEvidence was fully built, read-only, idempotent,
 * and tested (tests/pnl-service-verification.test.ts) — but had zero
 * production callers, only a manual CLI script
 * (scripts/discover-pnl-evidence.ts). This module is the ONE production
 * caller, extracted out of the journey state route so the eligibility glue
 * (is there a subject to correlate yet? who is attributing it?) is testable
 * on its own, without mocking that route's other ~15 dependencies — same
 * reasoning as registrationStandingSeedAward.ts and
 * registrationConfirmationDeps.ts from the same closure pass.
 *
 * ── NEVER COUPLED TO PULSE OR RATIFY ─────────────────────────────────────────
 *
 * Per the operator's own already-ratified rule
 * (RES-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001 /
 * CI-2026-08-08-PNL-INDEPENDENT-EVIDENCE-001): "Pulse Verified is sufficient
 * to close Ratify. P&L verification is an independent, asynchronous
 * capability transition." This function's only precondition is a KNOWN
 * SUBJECT (a confirmed registration's own tokenId/registryAgentId) — it
 * never reads or requires Pulse authorization state, and its result is never
 * fed into any gate.
 */

import { discoverAndReceiptPnlServiceEvidence, type PnlServiceVerificationResult } from './pnlServiceVerification';
import type { RegistrableAgentConfig } from './registrableAgents';
import type { HorizenNetwork } from './identity';

/** The narrow slice of AgentRegistrationState this boundary needs — decoupled so callers don't import the full type. */
export interface RegistrationSubject {
  registered: boolean;
  tokenId: string | null;
  registryAgentId: string | null;
  network: string | null;
}

export async function attemptPnlServiceVerificationIfEligible(
  agent: RegistrableAgentConfig,
  registration: RegistrationSubject | null,
  actorPersonaId: string | null,
): Promise<PnlServiceVerificationResult | null> {
  if (!registration?.registered) return null; // nothing to correlate without a known token
  const subjectRegistryAlias = registration.registryAgentId || registration.tokenId;
  if (!subjectRegistryAlias) return null;
  if (!actorPersonaId) return null; // cannot attribute — audit gap, never guessed

  return discoverAndReceiptPnlServiceEvidence({
    aigentQubeId: agent.aigentQubeId,
    subjectRegistryAlias,
    network: (registration.network as HorizenNetwork | null) ?? 'base-sepolia',
    actorPersonaId,
    runtimeAgentId: agent.runtimeAgentId,
  });
}
