/**
 * RiskEnvelopePanel — MoneyPenny MPY2-3 (SPEC-MPY-002 §5/§8), the
 * "Design → Risk & Limits" capability. Operator direction (2026-09-01):
 * MoneyPenny's bounded financial-authority layer — what financial state
 * exists (Financial Profile, MPY2-2), what risks follow from it, what
 * limits should apply, and what MoneyPenny may recommend versus what
 * requires explicit authority.
 *
 * Reads the SAME `/api/moneypenny/financial-profile` owner self-view GET
 * FinancialProfilePanel.tsx uses (never a second read path) and renders the
 * `riskAssessment`/`riskLimits` fields MPY2-3 added to it. Recomputing is
 * the SAME `/compute` action Financial Profile already exposes — this panel
 * offers a shortcut to it rather than a second compute mechanism.
 *
 * Spine-authenticated via personaFetch (CLAUDE.md PARAMOUNT), same pattern
 * as ServiceOrchestrationPanel.tsx / FinancialProfilePanel.tsx.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Loader2, AlertCircle, Info, ArrowRight } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

type RiskCategory = "liquidity" | "concentration" | "volatility" | "commitment-coverage";
type RiskSeverity = "low" | "moderate" | "elevated" | "high";

interface RiskFactor {
  category: RiskCategory;
  severity: RiskSeverity;
  rationale: string;
  derivedFrom: string;
}
interface RiskAssessment {
  factors: RiskFactor[];
  unassessed: Array<{ category: RiskCategory; reason: string }>;
}
interface ConcentrationLimit {
  category: string;
  limitShare: number;
  rationale: string;
}
interface RiskLimits {
  positionNotionalLimit: number;
  lossRiskBudget: number;
  drawdownLimit: number;
  liquidityReserve: number;
  concentrationLimits: ConcentrationLimit[];
  serviceClass: "PROPOSAL";
  rationale: string[];
}
interface FinancialProfileMeta {
  hasProfile: boolean;
  lastComputedAt: string | null;
  sourceUploadCount: number;
  unreadableUploadCount: number;
}
interface FinancialProfileResponse {
  ok: boolean;
  meta: FinancialProfileMeta;
  riskAssessment: RiskAssessment | null;
  riskLimits: RiskLimits | null;
}

const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  low: "border-emerald-700 text-emerald-300",
  moderate: "border-amber-700 text-amber-300",
  elevated: "border-orange-700 text-orange-300",
  high: "border-rose-700 text-rose-300",
};

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  liquidity: "Liquidity",
  concentration: "Concentration",
  volatility: "Cash-flow volatility",
  "commitment-coverage": "Commitment coverage",
};

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function RiskEnvelopePanel() {
  const [data, setData] = useState<FinancialProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch("/api/moneypenny/financial-profile", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as FinancialProfileResponse | null;
      if (res.ok && json?.ok) setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRecompute = useCallback(async () => {
    setComputing(true);
    setError(null);
    try {
      const res = await personaFetch("/api/moneypenny/financial-profile/compute", { method: "POST" });
      const json = (await res.json().catch(() => null)) as FinancialProfileResponse | null;
      if (!res.ok || !json) throw new Error("compute failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setComputing(false);
    }
  }, []);

  const assessment = data?.riskAssessment ?? null;
  const limits = data?.riskLimits ?? null;

  return (
    <div className="space-y-4 p-4">
      <Card className="border-slate-800 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Risk &amp; Limits
          </CardTitle>
          <CardDescription className="text-slate-400">
            Derived from your Financial Profile — what risks follow from your observed financial state, and what
            limits MoneyPenny recommends as a result. A proposal for you to review, never authority to trade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && !data?.meta.hasProfile && (
            <div className="rounded border border-slate-800 bg-slate-950 px-3 py-4 text-center text-xs text-slate-500">
              No Financial Profile yet. Compute one from the Financial Profile tab first — Risk &amp; Limits builds
              directly on that state.
            </div>
          )}

          {data?.meta.hasProfile && !limits && !loading && (
            <div className="rounded border border-slate-800 bg-slate-950 px-3 py-4 text-center text-xs text-slate-500">
              No risk envelope is proposed — average monthly expenditure meets or exceeds average income across the
              observed months, so no candidate limits are offered.
            </div>
          )}

          {data?.meta.hasProfile && (
            <button
              type="button"
              onClick={() => void handleRecompute()}
              disabled={computing}
              className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 transition disabled:opacity-50"
            >
              {computing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {computing ? "Recomputing…" : "Recompute from current Financial Profile"}
            </button>
          )}

          {error && (
            <div className="flex items-start gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {assessment && (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader><CardTitle className="text-sm text-slate-100">Risk factors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {assessment.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className={SEVERITY_COLOR[f.severity]}>{f.severity}</Badge>
                <div>
                  <div className="text-slate-200 font-medium">{CATEGORY_LABEL[f.category]}</div>
                  <div className="text-slate-400">{f.rationale}</div>
                </div>
              </div>
            ))}
            {assessment.unassessed.length > 0 && (
              <div className="mt-2 space-y-1 rounded border border-slate-800 bg-slate-950 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Not assessable — reported as unknown, never assumed low risk</div>
                {assessment.unassessed.map((u, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                    <Info className="h-3 w-3 shrink-0 mt-0.5" />
                    {CATEGORY_LABEL[u.category]}: {u.reason}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {limits && (
        <Card className="border-amber-800/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-amber-200">
              <ShieldAlert className="h-4 w-4" />
              Recommended limits
              <Badge variant="outline" className="border-amber-700 text-amber-300 text-[10px]">PROPOSAL</Badge>
            </CardTitle>
            <CardDescription className="text-[11px] text-amber-300/80">
              MoneyPenny may recommend these limits; it holds no authority to enforce them. Enforcing any limit
              against a real order requires an explicitly authorized agreement — see Runtime.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div><div className="text-slate-500">Position notional limit</div><div className="font-semibold text-slate-200">{money(limits.positionNotionalLimit)}</div></div>
              <div><div className="text-slate-500">Loss/risk budget</div><div className="font-semibold text-slate-200">{money(limits.lossRiskBudget)}</div></div>
              <div><div className="text-slate-500">Drawdown limit</div><div className="font-semibold text-slate-200">{money(limits.drawdownLimit)}</div></div>
              <div><div className="text-slate-500">Liquidity reserve</div><div className="font-semibold text-slate-200">{money(limits.liquidityReserve)}</div></div>
            </div>
            {limits.concentrationLimits.length > 0 && (
              <div className="space-y-1">
                {limits.concentrationLimits.map((c, i) => (
                  <div key={i} className="text-[11px] text-amber-300/80">
                    · {c.category}: {c.rationale}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-0.5 pt-1">
              {limits.rationale.map((r, i) => (
                <div key={i} className="text-[10px] text-slate-500">{r}</div>
              ))}
            </div>
            <div className="flex items-center gap-1 pt-1 text-[10px] text-amber-300/60">
              <ArrowRight className="h-3 w-3" />
              To enforce a limit for real, authorize an agreement in Runtime — this proposal changes nothing there
              on its own.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RiskEnvelopePanel;
