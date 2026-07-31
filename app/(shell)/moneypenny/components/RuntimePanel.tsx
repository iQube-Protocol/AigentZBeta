"use client";

/**
 * RuntimePanel — PRD-MPY-001 Phase 4, Runtime mode.
 *
 * MoneyPenny becomes a driving agent of the built constitutional service
 * pipeline (`/api/moneypenny/runtime`).
 *
 * P4-5/P4-6 — THE MONEY-MOVING GATE, real flip (operator-authorised
 * 2026-07-24). Investment/Market are now selectable. Each domain has its
 * OWN Constitutional Agreement: Domain 3 keeps the original agreement
 * (`settlementTerms: null`, unchanged); Investment/Market share a SECOND,
 * settlement-tier agreement carrying real `settlementTerms` + a
 * `valueCeiling` + `verificationRequirements: [world-id-verified-authorizer]`.
 * `authorizeAgreement` now REFUSES to authorize that second agreement unless
 * the human holds a live, World-ID-verified Polity Passport — that is the
 * real safety boundary, not this panel. `settlementExecutor` only ever binds
 * a hash-committed settlement INTENT; it never signs or broadcasts a
 * transfer (see its own file header) — actual fund movement stays a
 * separate, operator-supervised wallet step.
 *
 * The authoritative toggle is offered once the DOMAIN-APPROPRIATE agreement
 * is authorized; the route independently re-enforces the real gate
 * server-side regardless — this toggle is a convenience, not the safety
 * boundary.
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
import { PROOF_REQUIREMENT } from "@/services/constitutional/guidedOnboarding";

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

// P4-6: a SECOND, distinct capabilityRef + agreement for the money-moving
// domains (Investment/Market) -- matches the route's
// MONEYPENNY_SETTLEMENT_CAPABILITY_REF exactly. Keeping it separate from the
// Domain-3 agreement above means the two risk tiers are gated independently
// (see the route's file header for why sharing one capabilityRef would be
// unsafe).
const MONEYPENNY_SETTLEMENT_CAPABILITY_REF = "cap-moneypenny-financial-services-settlement";
const MONEYPENNY_SETTLEMENT_AGREEMENT_ID = `agr-${MONEYPENNY_SETTLEMENT_CAPABILITY_REF}-${MONEYPENNY_AGENT_REF}`;

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
  const [domain, setDomain] = useState<Domain>("intelligence");
  const [authoritative, setAuthoritative] = useState(false);

  // P4-6: the settlement-tier agreement's declared amount/ceiling -- an
  // operator-set, real (but conservative-by-default) value, never a
  // silently-invented one. Defaults to a zero-value settlement intent (the
  // safest possible first real flip: proves the whole 409 → world-id →
  // settlement-intent chain end to end with no economic stake) with a small
  // non-zero ceiling available for a deliberate next test. Q¢ convention:
  // integer cents ($1 = 100 Q¢, CLAUDE.md).
  const [settlementAmountQc, setSettlementAmountQc] = useState(0);
  const [valueCeilingQc, setValueCeilingQc] = useState(1000);

  // P4-6: which agreement gates the CURRENTLY SELECTED domain -- Domain 3
  // keeps its own (unchanged) agreement; Investment/Market share the
  // settlement-tier agreement (see the route's file header for why these
  // must be two distinct capabilityRefs/agreements, never one).
  const activeAgreementId = domain === "intelligence" ? MONEYPENNY_AGREEMENT_ID : MONEYPENNY_SETTLEMENT_AGREEMENT_ID;

  // P4-3/P4-6: the authoritative toggle is only offered once the
  // DOMAIN-APPROPRIATE agreement is authorized -- the route re-enforces this
  // (and, for money-moving, the World-ID grade) server-side regardless, but
  // there is no point offering a toggle that will 409.
  const hasAuthorizedAgreement = agreements.some(
    (a) => a.agreementId === activeAgreementId && a.status === "authorized",
  );

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
        const isMoneyMoving = domain !== "intelligence";
        const body: Record<string, unknown> =
          action === "form"
            ? isMoneyMoving
              ? {
                  action,
                  agreementId: MONEYPENNY_SETTLEMENT_AGREEMENT_ID,
                  displayLabel: `MoneyPenny Runtime — ${MONEYPENNY_SETTLEMENT_CAPABILITY_REF}`,
                  capabilityRef: MONEYPENNY_SETTLEMENT_CAPABILITY_REF,
                  selectedAgentRef: MONEYPENNY_AGENT_REF,
                  delegatedAuthority: {
                    band: "L2",
                    allowedActions: ["knowledge_retrieval", "analysis", "settlement"],
                    forbiddenActions: [],
                    allowedSurfaces: ["financial-services"],
                    ttlHours: 8,
                    maxActions: 5,
                    valueCeiling: valueCeilingQc,
                  },
                  settlementTerms: { rail: "qc", amount: settlementAmountQc, currency: "QC" },
                  // Money-moving grade (CFS-043 §6 / PRD-MPY-001 §7): authorize
                  // will REFUSE unless the human holds a live, World-ID-verified
                  // Polity Passport (constitutionalAgreement.ts).
                  verificationRequirements: [PROOF_REQUIREMENT.world_id],
                  governingInvariants: ["PRD-MPY-001", "CRP-003a"],
                }
              : {
                  action,
                  agreementId: MONEYPENNY_AGREEMENT_ID,
                  displayLabel: `MoneyPenny Runtime — ${MONEYPENNY_CAPABILITY_REF}`,
                  capabilityRef: MONEYPENNY_CAPABILITY_REF,
                  selectedAgentRef: MONEYPENNY_AGENT_REF,
                  delegatedAuthority: {
                    band: "L2",
                    allowedActions: ["knowledge_retrieval", "analysis"],
                    // Domain 3 is read-only -- fund transfer stays forbidden on
                    // this agreement, unchanged since P4-1.
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
            : { action, agreementId: activeAgreementId };
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
    [loadAgreements, domain, activeAgreementId, settlementAmountQc, valueCeilingQc],
  );

  const canRunAuthoritative = authoritative && hasAuthorizedAgreement;

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await personaFetch("/api/moneypenny/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, domain, mode: canRunAuthoritative ? "authoritative" : "shadow" }),
      });
      const data = (await res.json()) as RuntimeResult;
      if (!res.ok) setError(data?.error || `runtime call failed (${res.status})`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "runtime call error");
    } finally {
      setRunning(false);
    }
  }, [intent, domain, canRunAuthoritative]);

  return (
    <div className="space-y-4 text-white/90">
      <div className={`${PANEL} p-4`}>
        <h3 className="text-sm font-medium text-white/90">MoneyPenny Runtime — Constitutional Preview</h3>
        <p className="mt-1 text-xs text-white/60">
          Runs the same built 12-step constitutional service pattern the platform's Financial Services suite uses,
          with MoneyPenny as the driving agent. Shadow mode observes every step with no side effects. An authoritative
          run on Financial Intelligence accrues real Reach but never carries settlement terms. An authoritative run on
          Investment/Market binds a hash-committed settlement <em>intent</em> once the settlement-tier agreement below
          is authorized — authorizing that agreement requires a World-ID-verified Polity Passport (money-moving grade).
          Settlement never signs or broadcasts a transfer; actual fund movement stays a separate, supervised wallet step.
        </p>
      </div>

      <div className={`${PANEL} space-y-3 p-4`}>
        <div className="flex items-center gap-1.5">
          {(["intelligence", "investment", "market"] as Domain[]).map((d) => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className={
                domain === d
                  ? "rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200"
                  : "rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60 hover:bg-white/10"
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
        {domain !== "intelligence" && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-black/20 p-2">
            <label className="text-xs text-white/60">
              Settlement amount (Q¢)
              <input
                type="number"
                min={0}
                value={settlementAmountQc}
                onChange={(e) => setSettlementAmountQc(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 block w-24 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white/90"
              />
            </label>
            <label className="text-xs text-white/60">
              Spend ceiling (Q¢)
              <input
                type="number"
                min={0}
                value={valueCeilingQc}
                onChange={(e) => setValueCeilingQc(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 block w-24 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-white/90"
              />
            </label>
            <span className="text-[11px] text-white/40">
              rail qc — Form the agreement below to bind these terms (a 0-amount run proves the chain with no economic stake)
            </span>
          </div>
        )}
        <label
          className={`flex items-center gap-1.5 text-xs ${hasAuthorizedAgreement ? "text-white/70" : "text-white/30"}`}
          title={hasAuthorizedAgreement ? undefined : "Authorize the agreement below first"}
        >
          <input
            type="checkbox"
            checked={authoritative}
            disabled={!hasAuthorizedAgreement}
            onChange={(e) => setAuthoritative(e.target.checked)}
          />
          Authoritative
          {domain === "intelligence" ? " (real Reach accrual — no settlement possible on this domain)" : " (binds a settlement intent — requires World ID)"}
        </label>
        <button
          onClick={() => void run()}
          disabled={running || !intent.trim()}
          className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-sm text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
        >
          {running ? "Running…" : canRunAuthoritative ? "Run (authoritative)" : "Run (shadow)"}
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
        <div className="text-sm font-medium text-white/90">
          Constitutional Agreement <span className="text-white/40">— {DOMAIN_LABEL[domain]}</span>
        </div>
        <p className="text-xs text-white/60">
          MoneyPenny may form and accept her own side of the agreement for the selected domain — only a human
          clicking Authorize below binds it. Financial Intelligence and Investment/Market use two SEPARATE
          agreements (each with its own capability ref), so authorizing one never opens the other. The delegated
          call above stays a shadow-block until the agreement for the selected domain is authorized — and for
          Investment/Market, Authorize itself refuses unless you hold a World-ID-verified Polity Passport.
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
                <span className={a.agreementId === activeAgreementId ? "text-white/90" : "text-white/50"}>
                  {a.displayLabel}
                  {a.agreementId === activeAgreementId ? " (active for this domain)" : ""}
                </span>
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
