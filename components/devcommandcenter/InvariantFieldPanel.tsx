"use client";

/**
 * InvariantFieldPanel — the minimal operator-visible surface for IDE 2.0
 * (Homecoming III Phase 5, PRD §24).
 *
 * DELIBERATELY NOT A CAPSULE. The envelope is horizontal (operator ruling D2,
 * 2026-08-15) — it is never a stage of the DevOn lifecycle, so it gets no
 * entry in `DevCapsuleId` / `CAPSULE_LAYOUT` (components/devcommandcenter/
 * layouts/types.ts) and is not wired into DevCommandCenterTab's stage→capsule
 * machinery. This is a small, self-contained, collapsed-by-default panel a
 * host can mount wherever it has the session's envelope to hand — "enough
 * visibility for an operator to understand why an implementation is being
 * constrained," per the PRD, not a second cockpit.
 *
 * Backend first: this component renders what Phases 1-5 already computed. It
 * performs no retrieval, no discovery, no observation — those are the
 * services under services/devCommandCenter/. This file only projects.
 */

import { useState } from "react";
import type {
  EnvelopeInvariant,
  IntentRiskField,
  ProofOfRisk,
} from "@/types/invariantEnvelope";
import { epistemicMarker, mayBeCitedAsEstablished } from "@/types/invariantEnvelope";

export interface InvariantFieldPanelProps {
  invariants: readonly EnvelopeInvariant[];
  riskField?: IntentRiskField | null;
  proofsOfRisk?: readonly ProofOfRisk[];
  unresolvedQuestions?: readonly string[];
  /** Collapsed by default — an operator opts in to the detail. */
  defaultOpen?: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xs text-slate-300">{children}</span>
    </div>
  );
}

export function InvariantFieldPanel({
  invariants,
  riskField,
  proofsOfRisk = [],
  unresolvedQuestions = [],
  defaultOpen = false,
}: InvariantFieldPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  const establishedCount = invariants.filter((i) => mayBeCitedAsEstablished(i.lifecycle)).length;
  const signalCount = invariants.length - establishedCount;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-slate-800 bg-slate-900/40 text-slate-200"
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-300">
        Invariant Field — {establishedCount} established, {signalCount} signal
        {riskField ? `, ${riskField.vectors.length} risk vector${riskField.vectors.length === 1 ? "" : "s"}` : ""}
      </summary>

      <div className="space-y-4 border-t border-slate-800 px-3 py-3">
        <section>
          <h4 className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Invariants</h4>
          {invariants.length === 0 ? (
            <p className="text-xs text-slate-500">None retrieved yet.</p>
          ) : (
            <ul className="space-y-1">
              {invariants.map((i) => (
                <li key={i.ref} className="text-xs">
                  <span className="mr-1 text-slate-400">{epistemicMarker(i.lifecycle)}</span>
                  <span className="text-slate-300">{i.statement}</span>
                  <span className="ml-1 text-slate-600">
                    ({i.ref}, {i.provenance}
                    {i.bearing ? `, ${i.bearing}` : ""})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Risks</h4>
          {!riskField || riskField.vectors.length === 0 ? (
            <p className="text-xs text-slate-500">No risk field constructed.</p>
          ) : (
            <>
              <Row label="Origins">{riskField.originsPresent.join(", ") || "none"}</Row>
              <ul className="space-y-1">
                {riskField.vectors.map((v) => (
                  <li key={v.id} className="text-xs text-slate-300">
                    {v.label} <span className="text-slate-600">({v.id})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h4 className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Consequences</h4>
          {proofsOfRisk.length === 0 ? (
            <p className="text-xs text-slate-500">No Proof of Risk emitted yet.</p>
          ) : (
            <ul className="space-y-1">
              {proofsOfRisk.map((p) => (
                <li key={p.id} className="text-xs text-slate-300">
                  <span className="text-slate-500">[{p.status}]</span> {p.adverseConsequence}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Evidence — unresolved</h4>
          {unresolvedQuestions.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing outstanding.</p>
          ) : (
            <ul className="space-y-1">
              {unresolvedQuestions.map((q, idx) => (
                <li key={idx} className="text-xs text-amber-300/80">
                  {q}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </details>
  );
}

export default InvariantFieldPanel;
