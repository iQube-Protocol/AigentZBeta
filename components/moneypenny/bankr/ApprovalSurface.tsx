"use client";

/**
 * ApprovalSurface — item 7: human/MoneyPenny approval. Deliberately
 * VISUALLY and STRUCTURALLY separate from every other Bankr action surface
 * in this directory (Phase 5/9 hard boundary: "Factor never approves its
 * own or anyone's token"). Its "Request approval" button calls
 * `requestApproval` (Factor's own action, moves the launch into the
 * approval queue); its "Approve" button calls the controller hook's
 * SEPARATE `approve()` function, which hits the SEPARATE
 * .../launches/[id]/approve route — never folded into the action dispatcher
 * above. Rendered with a distinct amber "human decision" framing so no
 * operator mistakes this for one of Factor's own action chips.
 */

import type { TokenLaunchRow } from "@/services/factor/tokenLaunchService";
import { BankrSection, BankrBadge, BankrActionButton, BankrErrorNote } from "./bankrSurfaceKit";

interface Props {
  launch: TokenLaunchRow | null;
  requestBusy: boolean;
  requestError: string | null;
  onRequestApproval: () => void;
  approveBusy: boolean;
  approveError: string | null;
  onApprove: () => void;
}

export function ApprovalSurface({ launch, requestBusy, requestError, onRequestApproval, approveBusy, approveError, onApprove }: Props) {
  return (
    <BankrSection title="Human / MoneyPenny approval — separate from Factor's own actions" tone="warning">
      <p className="text-xs text-amber-200">
        Factor can request approval, but only MoneyPenny or the human principal may approve a launch. This section never runs automatically.
      </p>
      {launch?.state === "approved" || launch?.approval_hash ? (
        <div className="flex flex-col gap-1 text-xs text-emerald-200">
          <BankrBadge label="Approved" tone="good" />
          <span className="font-mono text-slate-400">spec {launch.spec_hash?.slice(0, 16)}…</span>
          <span className="font-mono text-slate-400">approval {launch.approval_hash?.slice(0, 16)}…</span>
          {launch.approved_by_persona_id && <span>approved by {launch.approved_by_persona_id}</span>}
          {launch.approved_at && <span>at {new Date(launch.approved_at).toLocaleString()}</span>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <BankrActionButton label="Request MoneyPenny/human approval" onClick={onRequestApproval} busy={requestBusy} disabled={!launch} />
          <BankrActionButton
            label="Approve (MoneyPenny / human principal only)"
            onClick={onApprove}
            busy={approveBusy}
            disabled={!launch || launch.state !== "approval_pending"}
            tone="danger"
          />
        </div>
      )}
      <BankrErrorNote message={requestError} />
      <BankrErrorNote message={approveError} />
    </BankrSection>
  );
}
