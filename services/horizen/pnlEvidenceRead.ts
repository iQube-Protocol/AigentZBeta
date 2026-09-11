/**
 * Canonical, agent-scoped read of Pulse/P&L registration/verification
 * evidence — composed from EXISTING canonical exports only
 * (`listActivityReceiptsForAgent`, the canonical receipt reader, and
 * `bestReceiptStatus`, the canonical DVN-status reducer both
 * app/api/journey/moneypenny-horizen/state/route.ts's own `pnlEvidence`
 * projection and the consequence fork already use) — never a second
 * receipt-reading mechanism or a second DVN-status reduction.
 *
 * The route computes the SAME facts inline today (over receipts it already
 * fetched for other reasons in one larger batch query); this function exists
 * so a caller with no reason to run that whole route's pipeline (e.g. Use
 * Case Zero's readiness projection) can get just this shape without
 * duplicating the `hasReceipt`/`bestReceiptStatus` predicate a second time.
 */

import { listActivityReceiptsForAgent } from '@/services/receipts/activityReceiptService';
import { bestReceiptStatus } from '@/services/journey/consequenceForkProjection';

export interface PnlEvidence {
  serviceRegistered: boolean;
  serviceRegisteredDvnStatus: ReturnType<typeof bestReceiptStatus>;
  serviceVerified: boolean;
  serviceVerifiedDvnStatus: ReturnType<typeof bestReceiptStatus>;
}

export async function resolvePnlEvidenceForAgent(runtimeAgentId: string): Promise<PnlEvidence> {
  const receipts = await listActivityReceiptsForAgent(runtimeAgentId, {
    actionTypes: ['pnl_service_registered', 'pnl_service_verified'],
    limit: 50,
  });
  const registered = receipts.filter((r) => r.actionType === 'pnl_service_registered');
  const verified = receipts.filter((r) => r.actionType === 'pnl_service_verified');

  return {
    serviceRegistered: registered.length > 0,
    serviceRegisteredDvnStatus: bestReceiptStatus(registered.map((r) => r.receiptStatus)),
    serviceVerified: verified.length > 0,
    serviceVerifiedDvnStatus: bestReceiptStatus(verified.map((r) => r.receiptStatus)),
  };
}
