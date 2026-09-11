/**
 * Financial Services verification (Pulse + P&L) for a given agent.
 *
 * Reuses the exact receipt-existence reads
 * `app/api/journey/moneypenny-horizen/state/route.ts` already performs
 * (`hasReceipt('horizen_pulse_authorized')` / `hasReceipt('horizen_pnl_transparency_enabled')`,
 * via the canonical `findAgentReceiptRefs()` reader) and the exact formula
 * `services/journey/agentStateAxes.ts`'s `VerificationAxis` already defines
 * (`financialServicesEligible = pulse === 'complete' && pnl === 'complete'`).
 * `resolveAgentStateAxes()` itself is not called here — it also folds in
 * admission/factory/Standing axes and a `prior` journal this caller has no
 * use for; recomputing the two-input verification formula directly, from the
 * SAME receipt read, is not a second definition of the concept.
 */

import { findAgentReceiptRefs } from '@/services/receipts/activityReceiptService';
import type { RegistrableAgentConfig } from '@/services/horizen/registrableAgents';

export interface FinancialServicesVerificationState {
  pulseComplete: boolean;
  pnlComplete: boolean;
  financialServicesEligible: boolean;
}

/** `undefined` means the receipt read itself failed — an audit gap, never a false "not verified". */
export async function resolveFinancialServicesVerification(
  agent: RegistrableAgentConfig,
): Promise<FinancialServicesVerificationState | undefined> {
  try {
    const refs = await findAgentReceiptRefs(
      agent.runtimeAgentId,
      ['horizen_pulse_authorized', 'horizen_pnl_transparency_enabled'],
      { limit: 1 },
    );
    const types = new Set(refs.map((r) => r.actionType));
    const pulseComplete = types.has('horizen_pulse_authorized');
    const pnlComplete = types.has('horizen_pnl_transparency_enabled');
    return { pulseComplete, pnlComplete, financialServicesEligible: pulseComplete && pnlComplete };
  } catch {
    return undefined;
  }
}
