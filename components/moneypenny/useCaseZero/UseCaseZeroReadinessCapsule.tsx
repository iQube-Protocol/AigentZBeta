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
  awaiting_external_action: "info",
};

const STATE_LABEL: Record<ReadinessLegState, string> = {
  established: "Established",
  missing: "Not yet",
  blocked: "Blocked",
  unreadable: "Unreadable",
  awaiting_external_action: "Awaiting external action",
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
  const { path, readiness, lastAdvance, loading, error, choosePath, advance, reset, journeyProfile, setJourneyProfile } = useUseCaseZeroReadiness({ agentSlug, tenantId });
  const [expanded, setExpanded] = useState(presentation !== "compact");
  // Launch-spec editor state — Factor never invents these values (manifest
  // boundary); the operator supplies them here before the rehearsal step
  // (governedOperationRehearsal) can run. Only rendered when that IS the
  // next permitted action, so it never appears as a dead control earlier
  // in the sequence (Companion Menu invariant MS-9).
  const [launchChain, setLaunchChain] = useState("base-sepolia");
  const [launchTokenName, setLaunchTokenName] = useState("");
  const [launchTokenSymbol, setLaunchTokenSymbol] = useState("");
  const [launchDescription, setLaunchDescription] = useState("");

  if (!path) {
    return (
      <BankrSection title="Constitutional financial-agent establishment">
        <p className="text-xs text-slate-400">Choose how to start — both paths converge on the same readiness sequence.</p>
        <div className="flex flex-wrap gap-2">
          <BankrActionButton label="Bring my own agent" onClick={() => choosePath("bring_own_agent")} busy={loading} tone="primary" />
          {/* Item 7 fix: "Create and establish an agent" executes IDENTICALLY
              to "Bring my own agent" today (no RootDID-minting primitive
              exists to actually create a new agent identity) — presenting it
              as a second, distinct operational path was misleading. Disabled
              and relabeled "Coming next" until a real create-path exists. */}
          <BankrActionButton label="Create and establish an agent (Coming next)" onClick={() => {}} disabled tone="primary" />
        </div>
        <p className="text-[11px] text-amber-200/80">
          "Create and establish an agent" is not available yet — no RootDID-minting primitive exists to create a wholly new agent
          identity. Use "Bring my own agent" to advance an agent slug already known to the platform (e.g. moneypenny, nakamoto, kn0w1,
          factor) through the remaining readiness steps.
        </p>
        <BankrErrorNote message={error} />
      </BankrSection>
    );
  }

  const showFull = presentation !== "compact" || expanded;
  const requiredLegs = readiness?.legs.filter((l) => l.required) ?? [];
  const requiredEstablished = requiredLegs.filter((l) => l.state === "established").length;
  const optionalLegs = readiness?.legs.filter((l) => !l.required) ?? [];

  return (
    <BankrSection title={path === "bring_own_agent" ? "Bring my own agent" : "Create and establish an agent"}>
      <div className="flex flex-wrap items-center gap-2">
        <BankrBadge label={`${requiredEstablished}/${requiredLegs.length} required established`} tone="info" />
        {optionalLegs.length > 0 && (
          <BankrBadge label={`${optionalLegs.filter((l) => l.state === "established").length}/${optionalLegs.length} optional`} tone="neutral" />
        )}
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

      {/* Item 2 (2026-09-07): an explicit operator choice — never inferred,
          never defaulted silently. Selecting 'financial_intelligence' is
          what makes the Pulse/P&L leg required (see
          useCaseZeroReadinessProjection.ts::resolvePulsePnlLeg); 'standard'
          leaves it optional. The choice persists with the resume state
          (survives a reload) and re-runs the readiness read immediately. */}
      <fieldset className="flex flex-col gap-1 rounded-md border border-slate-800 bg-slate-950/40 p-2">
        <legend className="px-1 text-[11px] text-slate-400">Journey profile</legend>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="radio"
            name="journeyProfile"
            value="standard"
            checked={journeyProfile === "standard"}
            onChange={() => setJourneyProfile("standard")}
          />
          Standard — Pulse/P&amp;L reporting optional
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="radio"
            name="journeyProfile"
            value="financial_intelligence"
            checked={journeyProfile === "financial_intelligence"}
            onChange={() => setJourneyProfile("financial_intelligence")}
          />
          Financial intelligence — Pulse/P&amp;L reporting required
        </label>
      </fieldset>

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

      {readiness?.nextAction && readiness.presentlyActionableStep === "governedOperationRehearsal" && (() => {
        // Item 4 fix: derive "simulated"/"live" from the Bankr adapter's own
        // reported mode (the bankrBinding leg's `mode`, itself derived from
        // assessIssuerReadiness's real adapter response — never a hardcoded
        // literal here).
        const bankrMode = readiness.legs.find((l) => l.key === "bankrBinding")?.mode ?? "n/a";
        const modeWord = bankrMode === "live" ? "live" : "simulated";
        return (
        <div className="flex flex-col gap-1.5 rounded-md border border-violet-800/50 bg-violet-500/5 p-2">
          <p className="text-xs text-violet-200">Next: {readiness.nextAction.label} — supply the launch spec (Factor invents none of this).</p>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Chain
            <input
              value={launchChain}
              onChange={(e) => setLaunchChain(e.target.value)}
              className="rounded-md border border-slate-800 bg-slate-950/60 p-1.5 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Token name
            <input
              value={launchTokenName}
              onChange={(e) => setLaunchTokenName(e.target.value)}
              placeholder="e.g. Test Token"
              className="rounded-md border border-slate-800 bg-slate-950/60 p-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Token symbol
            <input
              value={launchTokenSymbol}
              onChange={(e) => setLaunchTokenSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. TEST"
              className="rounded-md border border-slate-800 bg-slate-950/60 p-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Description (optional)
            <textarea
              value={launchDescription}
              onChange={(e) => setLaunchDescription(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-800 bg-slate-950/60 p-1.5 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none"
            />
          </label>
          <BankrActionButton
            label={`Prepare + preflight (${modeWord} — stops before approval)`}
            onClick={() =>
              void advance({
                chain: launchChain.trim(),
                tokenName: launchTokenName.trim(),
                tokenSymbol: launchTokenSymbol.trim(),
                description: launchDescription.trim() || undefined,
              })
            }
            busy={loading}
            disabled={!launchChain.trim() || !launchTokenName.trim() || !launchTokenSymbol.trim()}
            tone="primary"
          />
          <p className="text-[10px] text-slate-500">
            This prepares a draft and runs Bankr's deterministic preflight only — it never approves, signs, submits, or broadcasts, and no
            funds move.
          </p>
        </div>
        );
      })()}
      {readiness?.nextAction && readiness.presentlyActionableStep !== "governedOperationRehearsal" && (
        <div className="flex flex-col gap-1.5 rounded-md border border-violet-800/50 bg-violet-500/5 p-2">
          <p className="text-xs text-violet-200">Next: {readiness.nextAction.label}</p>
          <BankrActionButton label="Advance one step" onClick={() => void advance()} busy={loading} tone="primary" />
        </div>
      )}
      {/* Item 5 fix (2026-09-07): completion is `requiredStepsComplete` —
          NEVER `completedSteps.length === legs.length`. That equality
          compared established count against EVERY leg including optional
          ones (e.g. pulsePnl under the 'standard' journey profile), so the
          badge could never show while a genuinely non-blocking optional leg
          stayed unestablished — exactly the state `requiredStepsComplete`
          exists to represent correctly. */}
      {readiness?.requiredStepsComplete && (
        <BankrBadge label="Every required step established" tone="good" />
      )}

      {lastAdvance && <p className="text-[11px] text-slate-400">{lastAdvance.detail}</p>}
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}
