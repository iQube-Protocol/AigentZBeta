"use client";

/**
 * AegisReviewSurface — item 6: Aegis assessment state/decision. This
 * component never fetches the assessment itself (no parallel Aegis client)
 * — it reads the launch row's own `aegis_assessment_id` presence and
 * requests a NEW assessment through the controller hook's `requestAegis`,
 * which is the real HTTP action behind
 * `bankr_tokenization:request_aegis`. Full findings live in Aegis's own
 * panel (AegisPanel.tsx) — this surface only ever shows a summary + link
 * affordance, mirroring FactorPanel.tsx's own "Aegis assessment" block.
 */

import { useState } from "react";
import type { TokenLaunchRow } from "@/services/factor/tokenLaunchService";
import { BankrSection, BankrBadge, BankrActionButton, BankrErrorNote } from "./bankrSurfaceKit";

interface Props {
  launch: TokenLaunchRow | null;
  busy: boolean;
  error: string | null;
  onRequestAegis: (input: { policyVersion: string; evidenceSnapshot: Record<string, unknown>; requestedByAgentRef: string }) => void;
  /** Who is REQUESTING the assessment — the preparing agent, never the
   *  beneficiary when they differ (self-assessment refusal is enforced
   *  server-side; this surface just supplies the correct requester). */
  requestedByAgentRef: string;
}

export function AegisReviewSurface({ launch, busy, error, onRequestAegis, requestedByAgentRef }: Props) {
  const [policyVersion, setPolicyVersion] = useState("v1");
  const hasAssessment = Boolean(launch?.aegis_assessment_id);

  return (
    <BankrSection title="Aegis independent assessment">
      {hasAssessment ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span>Assessment {launch!.aegis_assessment_id!.slice(0, 8)}… requested.</span>
          <BankrBadge label="Open in Aegis for findings + ratification" tone="info" />
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">No assessment requested yet — Aegis must independently review this launch before approval.</p>
          <label className="flex flex-col gap-1 text-xs text-slate-300">
            Policy version
            <input
              value={policyVersion}
              onChange={(e) => setPolicyVersion(e.target.value)}
              className="w-32 rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 text-xs text-slate-100 focus:border-violet-500/60 focus:outline-none"
            />
          </label>
          <BankrActionButton
            label="Request an independent Aegis assessment"
            busy={busy}
            disabled={!launch}
            onClick={() =>
              onRequestAegis({
                policyVersion: policyVersion.trim() || "v1",
                evidenceSnapshot: launch ? { chain: launch.chain, tokenName: launch.token_name, tokenSymbol: launch.token_symbol, bankrTermsHash: launch.bankr_terms_hash } : {},
                requestedByAgentRef,
              })
            }
          />
        </>
      )}
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}
