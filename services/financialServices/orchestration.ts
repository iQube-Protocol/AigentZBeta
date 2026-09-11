/**
 * MoneyPenny Financial Services Runtime — orchestration assembly (Phase 3,
 * Stage 3.1).
 *
 * A read-only projection over `FinancialServiceOutcome`s already produced by
 * `requestFinancialService()` — mirrors `causalChain.ts`'s own discipline
 * one layer up: this computes nothing new and holds no parallel authority or
 * authorisation state. `nextServiceId` names what a caller MAY request next;
 * it is never itself invoked here.
 */

import { createHash } from 'crypto';
import type { FinancialServiceOrchestration, FinancialServiceOutcome } from '@/types/financialServices';

function ref(namespace: string, value: string): string {
  return createHash('sha256').update(namespace).update(value).digest('hex').slice(0, 32);
}

export function assembleFinancialServiceOrchestration(
  consumerAgentId: string,
  outcomes: FinancialServiceOutcome[],
  nextServiceId: string | null = null,
): FinancialServiceOrchestration {
  return {
    orchestrationRef: ref('fsvc-orchestration:', `${consumerAgentId}|${outcomes.map((o) => o.requestRef).join(',')}`),
    consumerAgentId,
    steps: outcomes.map((outcome) => ({ outcome })),
    nextServiceId,
  };
}
