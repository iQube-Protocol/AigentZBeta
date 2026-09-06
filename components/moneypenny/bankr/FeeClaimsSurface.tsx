"use client";

/**
 * FeeClaimsSurface — item 10: fee accrual/claim status. Per
 * `inspectFeeClaims`'s own honest limitation, `claimableAmountKnown` is
 * always `false` today — this surface never invents a claim amount or a
 * claim button; it only ever surfaces the honest note the handler already
 * returns, plus the confirmed token address (when present) for the operator
 * to check directly in the Bankr dashboard.
 */

import type { FeeClaimInspection } from "@/services/factor/bankrCapabilityHandlers";
import { BankrSection, BankrActionButton, BankrErrorNote } from "./bankrSurfaceKit";

interface Props {
  feeClaims: FeeClaimInspection | null;
  busy: boolean;
  error: string | null;
  onInspect: () => void;
  disabled?: boolean;
}

export function FeeClaimsSurface({ feeClaims, busy, error, onInspect, disabled }: Props) {
  return (
    <BankrSection title="Fee accrual / claims">
      {feeClaims ? (
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          {feeClaims.tokenAddress && <span className="font-mono text-slate-400">token: {feeClaims.tokenAddress}</span>}
          <span className="text-slate-500">{feeClaims.note}</span>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Not inspected yet.</p>
      )}
      <BankrActionButton label="Inspect fee claims" onClick={onInspect} busy={busy} disabled={disabled} />
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}
