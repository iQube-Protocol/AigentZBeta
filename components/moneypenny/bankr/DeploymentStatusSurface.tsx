"use client";

/**
 * DeploymentStatusSurface — items 8+9: deployment status (bankr_job_id,
 * transaction_hash, token/pool address) and the transaction/contract
 * receipt display (explorer link). Hard PRD rule (Phase 7): a
 * submitted-but-unconfirmed launch must NEVER be visually presented as a
 * live token — 'submitting'/'submitted' render as a distinct amber
 * "pending" state, only 'confirmed' renders as green "on-chain". The
 * explorer link is rendered ONLY when `explorer_url` is actually present —
 * never fabricated from a chain/address guess.
 */

import type { TokenLaunchRow } from "@/services/factor/tokenLaunchService";
import { BankrSection, BankrBadge, BankrActionButton, BankrErrorNote } from "./bankrSurfaceKit";

interface Props {
  launch: TokenLaunchRow | null;
  submitBusy: boolean;
  submitError: string | null;
  onSubmit: () => void;
  inspectBusy: boolean;
  inspectError: string | null;
  onInspectStatus: () => void;
}

export function DeploymentStatusSurface({ launch, submitBusy, submitError, onSubmit, inspectBusy, inspectError, onInspectStatus }: Props) {
  const state = launch?.state;
  const isPendingOnChain = state === "submitting" || state === "submitted";
  const isConfirmed = state === "confirmed";

  return (
    <BankrSection title="Deployment status">
      {!launch?.bankr_job_id ? (
        <>
          <p className="text-xs text-slate-500">Not yet submitted to Bankr.</p>
          <BankrActionButton
            label="Submit approved launch to Bankr"
            onClick={onSubmit}
            busy={submitBusy}
            disabled={!launch || launch.state !== "approved"}
            tone="primary"
          />
        </>
      ) : (
        <div className="flex flex-col gap-1.5 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            {isConfirmed && <BankrBadge label="Confirmed on-chain" tone="good" />}
            {isPendingOnChain && <BankrBadge label="Submitted — pending on-chain confirmation" tone="warn" />}
            {!isConfirmed && !isPendingOnChain && <BankrBadge label={state ?? "unknown"} tone="neutral" />}
            <span className="font-mono text-slate-500">job {launch.bankr_job_id}</span>
          </div>
          {launch.transaction_hash && <span className="font-mono text-slate-400">tx: {launch.transaction_hash}</span>}
          {launch.token_address && <span className="font-mono text-slate-400">token: {launch.token_address}</span>}
          {launch.pool_address && <span className="font-mono text-slate-400">pool: {launch.pool_address}</span>}
          {launch.explorer_url ? (
            <a href={launch.explorer_url} target="_blank" rel="noreferrer" className="w-fit text-violet-300 underline hover:text-violet-100">
              View on explorer
            </a>
          ) : (
            !isConfirmed && <span className="text-slate-600">No explorer link yet — not confirmed on-chain.</span>
          )}
          <BankrActionButton label="Inspect deployment status" onClick={onInspectStatus} busy={inspectBusy} disabled={isConfirmed} />
        </div>
      )}
      <BankrErrorNote message={submitError} />
      <BankrErrorNote message={inspectError} />
    </BankrSection>
  );
}
