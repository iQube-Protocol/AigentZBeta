"use client";

/**
 * RuntimePanel — PRD-MPY-001 Phase 4, Runtime mode.
 *
 * Increment P4-1: MoneyPenny becomes a driving agent of the built
 * constitutional service pipeline (`/api/moneypenny/runtime`), starting
 * inert-safe — domain limited to Financial Intelligence (Domain 3,
 * read-only), and the route itself hard-clamps `mode` to 'shadow'
 * regardless of what this panel sends. No settlement is possible on this
 * domain (step 9 always 'skipped' for intelligence).
 *
 * Investment/Market are shown but disabled in this increment — they unlock
 * in later increments (P4-2 agreement lifecycle, P4-3 authoritative flip)
 * behind their own gates, never silently.
 *
 * Trace-viewer styling mirrors FinancialServicesTab.tsx's STATUS_STYLE
 * pattern exactly (Extend, Don't Duplicate) — the reference integration
 * this route's server side already mirrors.
 *
 * Spine discipline: personaFetch only (this route resolves the caller's
 * persona — a spine endpoint).
 */

import { useCallback, useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";

interface StepTrace {
  step: number;
  name: string;
  status: "ok" | "skipped" | "refused" | "shadow-block" | "observed";
  detail: string;
}

interface RuntimeResult {
  ok: boolean;
  mode: string;
  domain?: string;
  executed: boolean;
  blockedAtStep: number | null;
  agreementId: string | null;
  trace: StepTrace[];
  clamped?: boolean;
  clampReason?: string;
  error?: string;
}

const STATUS_STYLE: Record<StepTrace["status"], string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  observed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "shadow-block": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  refused: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  skipped: "bg-slate-700/40 text-slate-400 border-slate-700",
};

const PANEL = "rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm";

type Domain = "intelligence" | "investment" | "market";
const DOMAIN_LABEL: Record<Domain, string> = {
  intelligence: "Financial Intelligence",
  investment: "Investment Operations",
  market: "Market Operations",
};

// P4-2: MoneyPenny's own capability/agent refs, matching the route's
// defaults (app/api/moneypenny/runtime/route.ts) -- so the agreement formed
// here is the one the runtime route's step-3 gate actually looks up.
const MONEYPENNY_CAPABILITY_REF = "cap-moneypenny-financial-services";
const MONEYPENNY_AGENT_REF = "agent-moneypenny";
const MONEYPENNY_AGREEMENT_ID = `agr-${MONEYPENNY_CAPABILITY_REF}-${MONEYPENNY_AGENT_REF}`;

interface AgreementRow {
  agreementId: string;
  displayLabel: string;
  status: string;
  capabilityRef: string | null;
  selectedAgentRef: string | null;
}

export function RuntimePanel() {
  const [intent, setIntent] = useState("Which settlement rail best fits a recurring micro-transaction stream?");
  const [result, setResult] = useState<RuntimeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P4-2: agreement lifecycle over the EXISTING generic
  // /api/constitutional/agreement route -- no new agreement machinery. A
  // human clicks Form/Accept/Authorize here; MoneyPenny's own server code
  // never calls authorizeAgreement on her own behalf (enforced by
  // tests/moneypenny-runtime-authority-boundary.test.ts).
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [agrBusy, setAgrBusy] = useState(false);
  const [agrNote, setAgrNote] = useState<string | null>(null);

  const loadAgreements = useCallback(async () => {
    try {
      const res = await personaFetch("/api/constitutional/agreement", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.agreements)) setAgreements(data.agreements as AgreementRow[]);
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    void loadAgreements();
  }, [loadAgreements]);

  const doAgreement = useCallback(
    async (action: "form" | "accept" | "authorize") => {
      setAgrBusy(true);
      setAgrNote(null);
      try {
        const body: Record<string, unknown> =
          action === "form"
            ? {
                action,
                agreementId: MONEYPENNY_AGREEMENT_ID,
                displayLabel: `MoneyPenny Runtime — ${MONEYPENNY_CAPABILITY_REF}`,
                capabilityRef: MONEYPENNY_CAPABILITY_REF,
                selectedAgentRef: MONEYPENNY_AGENT_REF,
                delegatedAuthority: {
                  band: "L2",
                  allowedActions: ["knowledge_retrieval", "analysis"],
                  // Domain 3 only in this increment -- fund transfer stays
                  // forbidden until Runtime's later increments unlock it.
                  forbiddenActions: ["transfer"],
                  allowedSurfaces: ["financial-services"],
                  ttlHours: 8,
                  maxActions: 5,
                  valueCeiling: null,
                },
                settlementTerms: null,
                verificationRequirements: ["F-201 Source Diversity", "F-202 Evidence Attribution", "F-203 Confidence Calibration"],
                governingInvariants: ["PRD-MPY-001", "CRP-003a"],
              }
            : { action, agreementId: MONEYPENNY_AGREEMENT_ID };
        const res = await personaFetch("/api/constitutional/agreement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setAgrNote(res.ok ? `${action} ok — status now '${data?.agreement?.status ?? "?"}'` : `${action} failed: ${data?.error ?? res.status}`);
        await loadAgreements();
      } catch (e) {
        setAgrNote(e instanceof Error ? e.message : `${action} error`);
      } finally {
        setAgrBusy(false);
      }
    },
    [loadAgreements],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await personaFetch("/api/moneypenny/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, domain: "intelligence" }),
      });
      const data = (await res.json()) as RuntimeResult;
      if (!res.ok) setError(data?.error || `runtime call failed (${res.status})`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "runtime call error");
    } finally {
      setRunning(false);
    }
  }, [intent]);

  return (
    <div className="space-y-4 text-white/90">
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-medium text-white/90">MoneyPenny Runtime — Constitutional Preview</h3>
        <p className="mt-1 text-xs text-white/60">
          Runs the same built 12-step constitutional service pattern the platform's Financial Services suite uses,
          with MoneyPenny as the driving agent. This increment is shadow-only — every trace step is observed, nothing
          executes for real, and no fund movement is possible (Financial Intelligence never carries settlement
          terms).
        </p>
      </div>

      <div className={`${PANEL} space-y-3 p-4`}>
        <div className="flex items-center gap-1.5">
          {(["intelligence", "investment", "market"] as Domain[]).map((d) => (
            <button
              key={d}
              disabled={d !== "intelligence"}
              title={d !== "intelligence" ? "Not yet enabled — Runtime is Financial-Intelligence-only in this increment" : undefined}
              className={
                d === "intelligence"
                  ? "rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200"
                  : "rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/30 cursor-not-allowed"
              }
            >
              {DOMAIN_LABEL[d]}
            </button>
          ))}
        </div>
        <label className="block text-xs text-white/60">
          Intent
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-white/90 outline-none focus:border-emerald-500/30"
          />
        </label>
        <button
          onClick={() => void run()}
          disabled={running || !intent.trim()}
          className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-sm text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
        >
          {running ? "Running…" : "Run (shadow)"}
        </button>
        {error && <div className="text-xs text-rose-300">{error}</div>}
      </div>

      {result && (
        <div className={`${PANEL} space-y-2 p-4`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white/90">Constitutional service pattern — trace</div>
            <div className="text-xs text-white/50">
              {result.domain ? `${result.domain} · ` : ""}mode {result.mode} · {result.executed ? "executed" : "not executed"}
              {result.blockedAtStep ? ` · blocked@${result.blockedAtStep}` : ""}
            </div>
          </div>
          {result.clamped && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
              {result.clampReason}
            </div>
          )}
          <ol className="space-y-1">
            {(result.trace ?? []).map((s) => (
              <li key={s.step} className="flex items-start gap-2 text-xs">
                <span className="w-5 shrink-0 text-right text-white/40">{s.step}</span>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 ${STATUS_STYLE[s.status] ?? STATUS_STYLE.skipped}`}>{s.status}</span>
                <span className="font-medium text-white/90">{s.name}</span>
                <span className="text-white/50">— {s.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className={`${PANEL} space-y-3 p-4`}>
        <div className="text-sm font-medium text-white/90">Constitutional Agreement</div>
        <p className="text-xs text-white/60">
          MoneyPenny may form and accept her own side of an agreement — only a human clicking Authorize below binds
          it. The delegated call above stays a shadow-block until an agreement here is authorized.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void doAgreement("form")} disabled={agrBusy} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50">Form</button>
          <button onClick={() => void doAgreement("accept")} disabled={agrBusy} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50">Accept</button>
          <button onClick={() => void doAgreement("authorize")} disabled={agrBusy} className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">Authorize</button>
        </div>
        {agrNote && <div className="text-xs text-white/70">{agrNote}</div>}
        {agreements.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
            {agreements.map((a) => (
              <li key={a.agreementId} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{a.displayLabel}</span>
                <span className="text-white/40">{a.capabilityRef} · {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default RuntimePanel;
