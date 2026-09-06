"use client";

/**
 * BankrTokenLaunchCapsule — the ONE composable Bankr token-launch capsule,
 * backed by the shared `useBankrTokenLaunch()` controller hook, rendered at
 * one of three presentation depths (`compact | expanded | panel`) without
 * ever re-subscribing or resetting state when the depth changes — mirrors
 * components/smarttriad/surfaces/MarketConsoleCapsule.tsx's own contract
 * (2026-09-04 "atomic, capsule-composable surfaces" ruling, extended here to
 * Factor's Bankr workflow surfaces, Phase 6 frontend half).
 *
 * `compact` — inline in a copilot message (SpecialistResponseCard's
 *   click-through): connection + binding + a one-line launch-state summary,
 *   plus an Expand affordance that toggles THIS component's own local depth
 *   state (no navigation, no remount, no new controller instance).
 * `expanded` — the full workflow: readiness, binding, spec form (when no
 *   launch is open) or the full per-launch surface set (terms, Aegis,
 *   approval, deployment, fee claims) when one is.
 * `panel` — identical content to `expanded`, sized for a workspace/right-
 *   pane host (FactorPanel.tsx's Bankr mode) or a modal
 *   (BankrTokenLaunchModal.tsx).
 *
 * Every field shown here is one of: live/simulated/unavailable mode,
 * provenance, capability/provider status, blockers, authority requirement,
 * the exact consequential action about to run, or approval state — never
 * raw JSON (PRD requirement for every Bankr-adjacent surface).
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useBankrTokenLaunch, type UseBankrTokenLaunchOptions } from "@/services/factor/useBankrTokenLaunch";
import { BankrReadinessSurface, ProviderBindingSurface } from "./BankrReadinessSurface";
import { LaunchSpecForm } from "./LaunchSpecForm";
import { BankrTermsSurface } from "./BankrTermsSurface";
import { AegisReviewSurface } from "./AegisReviewSurface";
import { ApprovalSurface } from "./ApprovalSurface";
import { DeploymentStatusSurface } from "./DeploymentStatusSurface";
import { FeeClaimsSurface } from "./FeeClaimsSurface";
import { BankrBadge } from "./bankrSurfaceKit";

export type BankrCapsulePresentation = "compact" | "expanded" | "panel";

const LAUNCH_STATE_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  draft: "neutral",
  preparing: "neutral",
  preflighted: "info",
  aegis_review_pending: "info",
  revision_required: "warn",
  approval_pending: "warn",
  approved: "good",
  submitting: "warn",
  submitted: "warn",
  confirmed: "good",
  failed: "bad",
  cancelled: "neutral",
  superseded: "neutral",
};

export interface BankrTokenLaunchCapsuleProps extends UseBankrTokenLaunchOptions {
  initialPresentation?: BankrCapsulePresentation;
  hideToggle?: boolean;
  /** Fires once a launch is confirmed and its own token identity is known —
   *  a host embedding this capsule inline (e.g. the specialist chat card)
   *  can use this to know a launch reached its terminal success state. */
  onConfirmed?: (launchId: string) => void;
}

export function BankrTokenLaunchCapsule({ initialPresentation = "compact", hideToggle = false, onConfirmed, ...options }: BankrTokenLaunchCapsuleProps) {
  // ONE controller instance for the lifetime of this component — toggling
  // `presentation` below only changes what this same controller's state is
  // rendered AS, never re-fetches or re-instantiates it.
  const controller = useBankrTokenLaunch(options);
  const [presentation, setPresentation] = useState<BankrCapsulePresentation>(initialPresentation);
  const isFull = presentation !== "compact";

  useEffect(() => {
    if (controller.beneficiaryAgentRuntimeId && !controller.readiness && !controller.readinessState.busy) {
      void controller.refreshReadiness();
    }
    if (options.launchId && !controller.launch && !controller.launchState.busy) {
      void controller.loadLaunch(options.launchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller.beneficiaryAgentRuntimeId, options.launchId]);

  useEffect(() => {
    if (controller.launch?.state === "confirmed") onConfirmed?.(controller.launch.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller.launch?.state]);

  const launch = controller.launch;

  return (
    <div
      className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/30 p-2.5"
      role="group"
      aria-label="Bankr token launch"
      data-bankr-capsule-presentation={presentation}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Bankr tokenization</span>
          {launch && <BankrBadge label={launch.state} tone={LAUNCH_STATE_TONE[launch.state] ?? "neutral"} />}
          {!launch && controller.readiness && <BankrBadge label={controller.readiness.ready ? "Issuer ready" : "Not ready"} tone={controller.readiness.ready ? "good" : "warn"} />}
        </div>
        {!hideToggle && (
          <button
            type="button"
            onClick={() => setPresentation(isFull ? "compact" : "expanded")}
            className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/60"
            aria-expanded={isFull}
          >
            {isFull ? (
              <>
                <ChevronUp className="h-3 w-3" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Open Bankr console
              </>
            )}
          </button>
        )}
      </div>

      {!isFull && (
        <p className="text-xs text-slate-500">
          {launch ? `${launch.token_name} (${launch.token_symbol}) on ${launch.chain} — ${launch.state.replace(/_/g, " ")}.` : "No launch open yet."}
        </p>
      )}

      {isFull && (
        <div className={presentation === "panel" ? "grid grid-cols-1 gap-2 md:grid-cols-2" : "space-y-2"}>
          <BankrReadinessSurface
            readiness={controller.readiness}
            loading={controller.readinessState.busy}
            error={controller.readinessState.error}
            onRefresh={() => void controller.refreshReadiness()}
          />
          <ProviderBindingSurface
            readiness={controller.readiness}
            loading={controller.readinessState.busy}
            error={controller.readinessState.error}
            onProvision={() => void controller.provisionBinding()}
          />

          {!launch ? (
            <div className="md:col-span-2">
              <LaunchSpecForm
                onSubmit={(spec) => controller.prepareLaunch(spec)}
                busy={controller.launchState.busy}
                error={controller.launchState.error}
                disabled={!controller.beneficiaryAgentRuntimeId}
                disabledReason={!controller.beneficiaryAgentRuntimeId ? "No beneficiary agent is bound to this console yet." : null}
              />
            </div>
          ) : (
            <>
              <BankrTermsSurface
                launch={launch}
                bankrTerms={controller.bankrTerms}
                busy={Boolean(controller.actions.preflight?.busy)}
                error={controller.actions.preflight?.error ?? null}
                onPreflight={() => void controller.preflight()}
              />
              <AegisReviewSurface
                launch={launch}
                busy={Boolean(controller.actions.request_aegis?.busy)}
                error={controller.actions.request_aegis?.error ?? null}
                onRequestAegis={(input) => void controller.requestAegis(input)}
                requestedByAgentRef={controller.preparingAgentRuntimeId}
              />
              <div className="md:col-span-2">
                <ApprovalSurface
                  launch={launch}
                  requestBusy={Boolean(controller.actions.request_approval?.busy)}
                  requestError={controller.actions.request_approval?.error ?? null}
                  onRequestApproval={() => void controller.requestApproval()}
                  approveBusy={Boolean(controller.actions.approve?.busy)}
                  approveError={controller.actions.approve?.error ?? null}
                  onApprove={() => void controller.approve()}
                />
              </div>
              <DeploymentStatusSurface
                launch={launch}
                submitBusy={Boolean(controller.actions.submit?.busy)}
                submitError={controller.actions.submit?.error ?? null}
                onSubmit={() => void controller.submit()}
                inspectBusy={Boolean(controller.actions.inspect_status?.busy)}
                inspectError={controller.actions.inspect_status?.error ?? null}
                onInspectStatus={() => void controller.inspectStatus()}
              />
              <FeeClaimsSurface
                feeClaims={controller.feeClaims}
                busy={Boolean(controller.actions.fee_claims?.busy)}
                error={controller.actions.fee_claims?.error ?? null}
                onInspect={() => void controller.inspectFeeClaims()}
                disabled={!launch.token_address}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default BankrTokenLaunchCapsule;
