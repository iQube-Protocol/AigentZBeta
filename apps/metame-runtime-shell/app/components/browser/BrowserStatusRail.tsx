"use client";

import type { BrowserBadgeState, BrowserStepState } from "@metame/browser-contracts";

type BrowserStatusRailProps = {
  badges?: BrowserBadgeState;
  step?: BrowserStepState;
};

export function BrowserStatusRail({ badges, step }: BrowserStatusRailProps) {
  if (!badges && !step) return null;

  return (
    <div className="browser-status-rail">
      {step ? (
        <span className={`browser-step-pill browser-step-${step.status}`}>
          {step.label}
          {step.message ? ` · ${step.message}` : ""}
        </span>
      ) : null}
      {badges ? (
        <>
          <span className="browser-badge-pill">{badges.activeAgentLabel}</span>
          <span className="browser-badge-pill">{badges.executionMode}</span>
          <span className="browser-badge-pill">{badges.privacyMode}</span>
          <span className="browser-badge-pill">{badges.trustMode}</span>
        </>
      ) : null}
    </div>
  );
}
