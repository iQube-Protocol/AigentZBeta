"use client";

/**
 * FinancialServicesTab — the Financial Services Capability Suite surface
 * (CRP-003a Increment 3; the first Founder Office Capability Suite, PRD §6/§9).
 *
 * Surfaces the constitutional service loop built in N1 + N2: an operator can run
 * the canonical 12-step service pattern (shadow) on a Domain-3 (Financial
 * Intelligence, read-only) capability and SEE the trace, and can form → accept →
 * authorize a Constitutional Agreement (the N1 gate) so the delegated call is
 * allowed.
 *
 * Three-experience framing (PRD §9), reusing existing tiering:
 *   - Constitutional Preview — the shadow run, open to everyone (demand-gen).
 *   - Founder Office — form/accept/authorize an agreement + authoritative run.
 *   - Advanced — multi-agreement / money-moving domains (later increments).
 * The FUNCTIONAL access control in this slice is the constitutional agreement
 * gate (409); commercial tier-gating via the existing plan is Increment 3b.
 *
 * Spine discipline: all calls go through `personaFetch` (Bearer token attached);
 * raw fetch would 401 (CLAUDE.md PARAMOUNT). Slate house style, not white
 * hairlines. Self-contained + defensive — no side effects beyond the two routes.
 */

import { useCallback, useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";

interface StepTrace {
  step: number;
  name: string;
  status: "ok" | "skipped" | "refused" | "shadow-block" | "observed";
  detail: string;
}

interface PipelineResult {
  ok: boolean;
  mode: string;
  domain?: string;
  executed: boolean;
  blockedAtStep: number | null;
  agreementId: string | null;
  trace: StepTrace[];
  verification?: { passed: boolean; requirements: { requirement: string; passed: boolean; detail: string }[] } | null;
  settlement?: { status: string; intentRef: string | null; note: string } | null;
}

interface AgreementRow {
  agreementId: string;
  displayLabel: string;
  status: string;
  capabilityRef: string | null;
  selectedAgentRef: string | null;
}

const STATUS_STYLE: Record<StepTrace["status"], string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  observed: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "shadow-block": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  refused: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  skipped: "bg-slate-700/40 text-slate-400 border-slate-700",
};

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm";

const DEFAULT_CAP = "cap-financial-intelligence";
const DEFAULT_AGENT = "agent-financial-intelligence";

type Domain = "intelligence" | "investment" | "market";
const DOMAIN_LABEL: Record<Domain, string> = { intelligence: "Financial Intelligence", investment: "Investment Operations", market: "Market Operations" };
const DOMAIN_INVARIANTS: Record<Domain, string[]> = {
  intelligence: ["F-201 Source Diversity", "F-202 Evidence Attribution", "F-203 Confidence Calibration"],
  investment: ["F-001 Verifiable State Before Action", "F-002 Explainable Allocation", "F-003 Delegation Boundaries"],
  market: ["F-101 Separation of Advice & Execution", "F-102 Standing-Weighted Selection", "F-103 Verification Before Standing"],
};

export function FinancialServicesTab() {
  const [domain, setDomain] = useState<Domain>("intelligence");
  const [intent, setIntent] = useState("Which L2 should we integrate for treasury settlement?");
  const [capabilityRef, setCapabilityRef] = useState(DEFAULT_CAP);
  const [agentRef, setAgentRef] = useState(DEFAULT_AGENT);
  // Money-moving fields (Domains 1/2) — P3 spend cap + settlement terms.
  const [valueCeiling, setValueCeiling] = useState("500");
  const [settleRail, setSettleRail] = useState("usdc");
  const [settleAmount, setSettleAmount] = useState("300");
  const [settleCurrency, setSettleCurrency] = useState("USD");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [agrBusy, setAgrBusy] = useState(false);
  const [agrNote, setAgrNote] = useState<string | null>(null);

  // Commercial tier gating (Increment 3b) — reuses the existing plan, no
  // parallel tiering. Founder Office experience needs ventureLabAccess; Advanced
  // needs venture_tier pro/elite. Fails closed to preview-only if the plan can't
  // be read (the paid experience stays gated; the free Preview always works).
  const [plan, setPlan] = useState<{ ventureLabAccess: boolean; ventureTier: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await personaFetch("/api/billing/plan", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data?.ok) setPlan({ ventureLabAccess: data.ventureLabAccess === true, ventureTier: String(data.ventureTier ?? "none") });
      } catch {
        /* best-effort — stays preview-only */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const foEntitled = plan?.ventureLabAccess === true;
  const advancedEntitled = plan?.ventureTier === "pro" || plan?.ventureTier === "elite";

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

  const runPipeline = useCallback(
    async (mode: "shadow" | "authoritative") => {
      setRunning(true);
      setError(null);
      setResult(null);
      try {
        const res = await personaFetch("/api/constitutional/service-pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent, capabilityRef, selectedAgentRef: agentRef, domain, mode }),
        });
        const data = await res.json();
        if (!res.ok && res.status !== 409) {
          setError(data?.error || `pipeline failed (${res.status})`);
        }
        setResult(data as PipelineResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "pipeline error");
      } finally {
        setRunning(false);
      }
    },
    [intent, capabilityRef, agentRef, domain],
  );

  const moneyMoving = domain !== "intelligence";

  const agreementId = `agr-${capabilityRef}-${agentRef}`;

  const doAgreement = useCallback(
    async (action: "form" | "accept" | "authorize") => {
      setAgrBusy(true);
      setAgrNote(null);
      try {
        const settlementTerms = moneyMoving
          ? { rail: settleRail, amount: Number(settleAmount) || 0, currency: settleCurrency }
          : null;
        const body: Record<string, unknown> =
          action === "form"
            ? {
                action,
                agreementId,
                displayLabel: `${DOMAIN_LABEL[domain]} — ${capabilityRef}`,
                capabilityRef,
                selectedAgentRef: agentRef,
                delegatedAuthority: {
                  band: moneyMoving ? "L3" : "L2",
                  allowedActions: ["knowledge_retrieval", "analysis"],
                  // Executors are advice-only — fund movement stays a separate settlement step.
                  forbiddenActions: ["transfer"],
                  allowedSurfaces: ["financial-services"],
                  ttlHours: 8,
                  maxActions: 5,
                  // P3 — money-moving domains MUST declare an enforced ceiling.
                  valueCeiling: moneyMoving ? Number(valueCeiling) || 0 : null,
                },
                settlementTerms,
                verificationRequirements: DOMAIN_INVARIANTS[domain],
                governingInvariants: ["CRP-003a", "CFI-002", ...(moneyMoving ? ["CFI-001"] : [])],
              }
            : { action, agreementId };
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
    [agreementId, capabilityRef, agentRef, loadAgreements, domain, moneyMoving, valueCeiling, settleRail, settleAmount, settleCurrency],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-slate-200">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-100">Financial Services</h1>
        <p className="text-sm text-slate-400">
          The first Founder Office Capability Suite — Constitutional Financial Services Programme (CRP-003a),
          Pilot Series 001 with Horizen. Domain 3 (Financial Intelligence, read-only) first.
        </p>
      </header>

      {/* Three-experience framing */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { t: "Constitutional Preview", d: "Run the constitutional service loop in shadow — see every step. Open to all.", unlocked: true, tier: "Free" },
          { t: "Founder Office", d: "Form + authorize a Constitutional Agreement; run the delegated call under it.", unlocked: foEntitled, tier: "Founder Office" },
          { t: "Advanced", d: "Multi-agreement orchestration + money-moving domains. Later increments.", unlocked: advancedEntitled, tier: "Pro / Elite" },
        ].map((x) => (
          <div key={x.t} className={`${PANEL} p-4 ${x.unlocked ? "" : "opacity-70"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-slate-100">{x.t}</div>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${x.unlocked ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-slate-700 bg-slate-800/50 text-slate-400"}`}>
                {x.unlocked ? "Active" : x.tier}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{x.d}</div>
          </div>
        ))}
      </div>

      {/* Inputs */}
      <div className={`${PANEL} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-slate-100">{DOMAIN_LABEL[domain]} — request</div>
          <div className="flex gap-1">
            {(["intelligence", "investment", "market"] as Domain[]).map((d) => (
              <button
                key={d}
                onClick={() => setDomain(d)}
                className={`rounded border px-2 py-0.5 text-[11px] ${domain === d ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200"}`}
              >
                {d === "intelligence" ? "Intelligence" : d === "investment" ? "Investment" : "Market"}
              </button>
            ))}
          </div>
        </div>
        {moneyMoving && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            Money-moving domain — the agreement must declare an enforced spend ceiling (P3), and settlement terms
            bind a settlement intent (never an autonomous transfer). Executors remain advice-only.
          </div>
        )}
        <label className="block text-xs text-slate-400">
          Intent
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200 outline-none focus:border-slate-600"
          />
        </label>
        {moneyMoving && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block text-xs text-slate-400">
              Spend ceiling (P3)
              <input value={valueCeiling} onChange={(e) => setValueCeiling(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200 outline-none focus:border-slate-600" />
            </label>
            <label className="block text-xs text-slate-400">
              Rail
              <select value={settleRail} onChange={(e) => setSettleRail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200 outline-none focus:border-slate-600">
                <option value="usdc">USDC (Base)</option>
                <option value="qc">Q¢</option>
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Settle amount
              <input value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200 outline-none focus:border-slate-600" />
            </label>
            <label className="block text-xs text-slate-400">
              Currency
              <input value={settleCurrency} onChange={(e) => setSettleCurrency(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200 outline-none focus:border-slate-600" />
            </label>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Capability
            <input value={capabilityRef} onChange={(e) => setCapabilityRef(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200 outline-none focus:border-slate-600" />
          </label>
          <label className="block text-xs text-slate-400">
            Agent
            <input value={agentRef} onChange={(e) => setAgentRef(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200 outline-none focus:border-slate-600" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void runPipeline("shadow")} disabled={running} className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-sm text-violet-200 hover:bg-violet-500/25 disabled:opacity-50">
            {running ? "Running…" : "Run (shadow)"}
          </button>
          <button onClick={() => void runPipeline("authoritative")} disabled={running || !foEntitled} title={foEntitled ? undefined : "Founder Office tier required"} className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 disabled:opacity-50">
            Run (authoritative){foEntitled ? "" : " · Founder Office"}
          </button>
        </div>
        {error && <div className="text-xs text-rose-300">{error}</div>}
      </div>

      {/* Trace */}
      {result && (
        <div className={`${PANEL} space-y-2 p-4`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-100">Constitutional service pattern — trace</div>
            <div className="text-xs text-slate-400">
              {result.domain ? `${result.domain} · ` : ""}mode {result.mode} · {result.executed ? "executed" : "not executed"}
              {result.blockedAtStep ? ` · blocked@${result.blockedAtStep}` : ""}
              {result.agreementId ? ` · ${result.agreementId}` : ""}
            </div>
          </div>
          <ol className="space-y-1">
            {(result.trace ?? []).map((s) => (
              <li key={s.step} className="flex items-start gap-2 text-xs">
                <span className="w-5 shrink-0 text-right text-slate-500">{s.step}</span>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 ${STATUS_STYLE[s.status] ?? STATUS_STYLE.skipped}`}>{s.status}</span>
                <span className="font-medium text-slate-200">{s.name}</span>
                <span className="text-slate-400">— {s.detail}</span>
              </li>
            ))}
          </ol>
          {result.verification && (
            <div className="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-400">
              Verification {result.verification.passed ? "passed" : "observed (not passed)"} —{" "}
              {result.verification.requirements.map((r) => `${r.requirement}: ${r.passed ? "✓" : "✗"}`).join(" · ")}
            </div>
          )}
          {result.settlement && (
            <div className="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-400">
              Settlement {result.settlement.status}
              {result.settlement.intentRef ? ` · intent ${result.settlement.intentRef}` : ""} — {result.settlement.note}
            </div>
          )}
        </div>
      )}

      {/* Agreement lifecycle (Founder Office experience) */}
      <div className={`${PANEL} space-y-3 p-4`}>
        <div className="text-sm font-medium text-slate-100">Constitutional Agreement (Founder Office)</div>
        <p className="text-xs text-slate-400">
          Delegated execution refuses (409) without an authorized agreement. Form → accept → authorize for the
          capability + agent above, then run authoritative.
        </p>
        {!foEntitled && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            The Founder Office experience requires a Founder Office subscription. The Constitutional Preview (Run
            shadow) above is open to everyone.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void doAgreement("form")} disabled={agrBusy || !foEntitled} className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 disabled:opacity-50">Form</button>
          <button onClick={() => void doAgreement("accept")} disabled={agrBusy || !foEntitled} className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50 disabled:opacity-50">Accept</button>
          <button onClick={() => void doAgreement("authorize")} disabled={agrBusy || !foEntitled} className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">Authorize</button>
        </div>
        {agrNote && <div className="text-xs text-slate-300">{agrNote}</div>}
        {agreements.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
            {agreements.map((a) => (
              <li key={a.agreementId} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{a.displayLabel}</span>
                <span className="text-slate-500">{a.capabilityRef} · {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default FinancialServicesTab;
