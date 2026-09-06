"use client";

/**
 * UseCaseZeroReadinessCapsule — the ONE composable Use Case Zero readiness
 * capsule (2026-09-06), backed by services/factor/useUseCaseZeroReadiness.ts,
 * rendered at one of three presentation depths (`compact | expanded | panel`)
 * without ever re-subscribing or resetting state when the depth changes —
 * mirrors components/moneypenny/bankr/BankrTokenLaunchCapsule.tsx's own
 * contract exactly, so this is a host-agnostic surface from day one: the
 * SAME component mounts inside the Factor/MoneyPenny conversation (compact),
 * FactorPanel (panel), the Financial Services Bridge (panel, via a
 * journeySurfaceRegistry descriptor), or a modal (expanded).
 *
 * Shows: the two entry paths, the shared readiness sequence (every leg's
 * label + state + mode), current evidence (evidenceRefs, never raw JSON),
 * blockers, and the ONE permitted next action — never a raw JSON dump.
 */

import { useState } from "react";
import { useUseCaseZeroReadiness } from "@/services/factor/useUseCaseZeroReadiness";
import type { ReadinessLegState, ReadinessLegMode } from "@/services/factor/useCaseZeroReadinessProjection";
import { BankrActionButton, BankrBadge, BankrErrorNote, BankrSection } from "@/components/moneypenny/bankr/bankrSurfaceKit";

export type UseCaseZeroCapsulePresentation = "compact" | "expanded" | "panel";

const STATE_TONE: Record<ReadinessLegState, "neutral" | "good" | "warn" | "bad" | "info"> = {
  established: "good",
  missing: "neutral",
  blocked: "bad",
  unreadable: "warn",
};

const STATE_LABEL: Record<ReadinessLegState, string> = {
  established: "Established",
  missing: "Not yet",
  blocked: "Blocked",
  unreadable: "Unreadable",
};

function ModeBadge({ mode }: { mode: ReadinessLegMode }) {
  if (mode === "n/a") return null;
  return <BankrBadge label={mode === "live" ? "Live" : "Simulated"} tone={mode === "live" ? "good" : "warn"} />;
}

export interface UseCaseZeroReadinessCapsuleProps {
  agentSlug: string;
  tenantId?: string;
  presentation?: UseCaseZeroCapsulePresentation;
}

export function UseCaseZeroReadinessCapsule({ agentSlug, tenantId, presentation = "compact" }: UseCaseZeroReadinessCapsuleProps) {
  const { path, readiness, lastAdvance, loading, error, choosePath, advance, reset } = useUseCaseZeroReadiness({ agentSlug, tenantId });
  const [expanded, setExpanded] = useState(presentation !== "compact");

  if (!path) {
    return (
      <BankrSection title="Constitutional financial-agent establishment">
        <p className="text-xs text-slate-400">Choose how to start — both paths converge on the same readiness sequence.</p>
        <div className="flex flex-wrap gap-2">
          <BankrActionButton label="Bring my own agent" onClick={() => choosePath("bring_own_agent")} busy={loading} tone="primary" />
          <BankrActionButton label="Create and establish an agent" onClick={() => choosePath("create_and_establish")} busy={loading} tone="primary" />
        </div>
        <BankrErrorNote message={error} />
      </BankrSection>
    );
  }

  const showFull = presentation !== "compact" || expanded;

  return (
    <BankrSection title={path === "bring_own_agent" ? "Bring my own agent" : "Create and establish an agent"}>
      <div className="flex flex-wrap items-center gap-2">
        <BankrBadge label={`${readiness?.completedSteps.length ?? 0}/${readiness?.legs.length ?? 0} established`} tone="info" />
        {presentation === "compact" && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            {showFull ? "Collapse" : "Expand"}
          </button>
        )}
        <button type="button" onClick={reset} className="text-xs text-slate-500 underline hover:text-slate-300">
          Start over
        </button>
      </div>

      {showFull && readiness && (
        <ul className="flex flex-col gap-1.5">
          {readiness.legs.map((leg) => (
            <li key={leg.key} className="flex flex-col gap-0.5 rounded-md border border-slate-800 bg-slate-950/40 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-200">{leg.label}</span>
                <BankrBadge label={STATE_LABEL[leg.state]} tone={STATE_TONE[leg.state]} />
                <ModeBadge mode={leg.mode} />
              </div>
              <p className="text-[11px] text-slate-400">{leg.reason}</p>
              {leg.conditions.length > 0 && (
                <ul className="mt-0.5 list-disc pl-4 text-[11px] text-amber-200">
                  {leg.conditions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {readiness?.nextAction && (
        <div className="flex flex-col gap-1.5 rounded-md border border-violet-800/50 bg-violet-500/5 p-2">
          <p className="text-xs text-violet-200">Next: {readiness.nextAction.label}</p>
          <BankrActionButton label="Advance one step" onClick={() => void advance()} busy={loading} tone="primary" />
        </div>
      )}
      {!readiness?.nextAction && readiness?.completedSteps.length === readiness?.legs.length && (
        <BankrBadge label="Every step established" tone="good" />
      )}

      {lastAdvance && <p className="text-[11px] text-slate-400">{lastAdvance.detail}</p>}
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}
