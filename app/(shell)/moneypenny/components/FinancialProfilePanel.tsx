/**
 * FinancialProfilePanel — MoneyPenny MPY2-2 (SPEC-MPY-002 §5), the
 * "Understand → Financial Profile" capability.
 *
 * Upload bank-statement/account-export documents (through the EXISTING
 * generic `/api/uploads` route, `useKind: 'financial_document'` — no new
 * upload mechanism), then compute a derived financial profile
 * (`/api/moneypenny/financial-profile/compute`) from them. The result is a
 * RECOMMENDATION for the person to review, never authority to trade
 * (constraint 6) — every figure below is labelled as MoneyPenny's derived
 * read, not a live balance or a live market fact.
 *
 * Spine-authenticated via personaFetch (CLAUDE.md PARAMOUNT), same pattern
 * as ServiceOrchestrationPanel.tsx — no personaIdHint threaded through
 * props; personaFetch falls back to the spine's own localStorage record.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Upload, TrendingUp, TrendingDown, AlertCircle, Info } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface RecurringCommitment {
  label: string;
  monthlyAmount: number;
  observedMonths: number;
}
interface ConcentrationCategory {
  category: string;
  monthlyAmount: number;
  shareOfExpenditure: number;
}
interface FinancialProfileAggregates {
  incomeMonthly: number;
  expenditureMonthly: number;
  availableSurplusMonthly: number;
  cashFlowVolatility: number | null;
  liquidityBufferDays: number | null;
  recurringCommitments: RecurringCommitment[];
  topCategories: ConcentrationCategory[];
}
interface FinancialProfileEnvelope {
  candidateMaxNotional: number;
  candidateLossRiskBudget: number;
  liquidityReserve: number;
  concentrationLimits: string[];
  strategyConstraints: string[];
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
  aggregates: FinancialProfileAggregates | null;
  envelope: FinancialProfileEnvelope | null;
  computedFromMonths: string[];
  /** MPY2-2c — which input path produced the current aggregates. `null`
   *  when no profile has been computed yet. */
  inputSource?: 'uploaded_statements' | 'manual_entry' | null;
  notes?: string[];
  error?: string;
  detail?: string;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function FinancialProfilePanel() {
  const [profile, setProfile] = useState<FinancialProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualIncome, setManualIncome] = useState("");
  const [manualExpenditure, setManualExpenditure] = useState("");
  const [manualLiquidityDays, setManualLiquidityDays] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personaFetch("/api/moneypenny/financial-profile", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as FinancialProfileResponse | null;
      if (res.ok && json?.ok) {
        setProfile(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", file);
        form.append("useKind", "financial_document");
        const res = await personaFetch("/api/uploads", { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || body?.error || `upload failed (${res.status})`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }, []);

  const handleCompute = useCallback(async () => {
    setComputing(true);
    setError(null);
    setNotes([]);
    try {
      const res = await personaFetch("/api/moneypenny/financial-profile/compute", { method: "POST" });
      const json = (await res.json().catch(() => null)) as FinancialProfileResponse | null;
      if (!res.ok || !json) throw new Error(json?.detail || json?.error || `compute failed (${res.status})`);
      if (!json.ok) {
        setError(json.detail ?? json.error ?? "Could not compute a profile from the uploaded documents.");
        setNotes(json.notes ?? []);
        return;
      }
      setProfile(json);
      setNotes(json.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setComputing(false);
    }
  }, []);

  const handleManualSubmit = useCallback(async () => {
    const income = Number(manualIncome);
    const expenditure = Number(manualExpenditure);
    if (!Number.isFinite(income) || income < 0 || !Number.isFinite(expenditure) || expenditure < 0) {
      setError("Enter non-negative numbers for monthly income and expenditure.");
      return;
    }
    const liquidityBufferDays =
      manualLiquidityDays.trim() === "" ? null : Number(manualLiquidityDays);
    if (liquidityBufferDays !== null && (!Number.isFinite(liquidityBufferDays) || liquidityBufferDays < 0)) {
      setError("Liquidity buffer, if provided, must be a non-negative number of days.");
      return;
    }
    setManualSubmitting(true);
    setError(null);
    setNotes([]);
    try {
      const res = await personaFetch("/api/moneypenny/financial-profile/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incomeMonthly: income, expenditureMonthly: expenditure, liquidityBufferDays }),
      });
      const json = (await res.json().catch(() => null)) as FinancialProfileResponse | null;
      if (!res.ok || !json) throw new Error(json?.detail || json?.error || `save failed (${res.status})`);
      setProfile(json);
      setNotes(json.notes ?? []);
      setManualOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setManualSubmitting(false);
    }
  }, [manualIncome, manualExpenditure, manualLiquidityDays]);

  const aggregates = profile?.aggregates ?? null;
  const envelope = profile?.envelope ?? null;
  const inputSource = profile?.inputSource ?? null;

  return (
    <div className="space-y-4 p-4">
      <Card className="border-slate-800 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <FileText className="h-4 w-4 text-emerald-400" />
            Financial Profile
          </CardTitle>
          <CardDescription className="text-slate-400">
            Upload bank statements or account exports (CSV). MoneyPenny derives income/expenditure, cash-flow
            volatility, liquidity buffer and recurring commitments from them — a recommendation for you to review,
            never authority to trade (SPEC-MPY-002 §5).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-700 bg-slate-950 px-4 py-6 text-sm text-slate-400 hover:border-emerald-700 hover:text-emerald-300 transition">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload statement (CSV — date, amount/debit-credit, optionally balance/category columns)"}
            <input
              type="file"
              accept=".csv,text/csv,.pdf,application/pdf"
              multiple
              disabled={uploading}
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
          </label>

          <button
            type="button"
            onClick={() => void handleCompute()}
            disabled={computing}
            className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50"
          >
            {computing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {computing ? "Computing…" : "Compute financial profile"}
          </button>

          {error && (
            <div className="flex items-start gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {notes.length > 0 && (
            <div className="space-y-1 rounded border border-amber-800/50 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-300">
              {notes.map((n, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  {n}
                </div>
              ))}
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              className="text-xs text-slate-400 underline decoration-dotted hover:text-slate-200"
            >
              {manualOpen ? "Hide manual entry" : "No statement handy? Enter estimates manually"}
            </button>
          </div>

          {manualOpen && (
            <div className="space-y-2 rounded border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[11px] text-slate-500">
                A self-reported estimate — not derived from transaction data. Recurring commitments,
                expenditure concentration and cash-flow volatility require an uploaded statement and
                will not be available from this entry.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-[11px] text-slate-400">
                  Monthly income ($)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualIncome}
                    onChange={(e) => setManualIncome(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-slate-400">
                  Monthly expenditure ($)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualExpenditure}
                    onChange={(e) => setManualExpenditure(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-slate-400">
                  Liquidity buffer (days, optional)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={manualLiquidityDays}
                    onChange={(e) => setManualLiquidityDays(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void handleManualSubmit()}
                disabled={manualSubmitting}
                className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:opacity-50"
              >
                {manualSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {manualSubmitting ? "Saving…" : "Save manual estimate"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && !profile?.meta.hasProfile && !aggregates && (
        <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-4 text-center text-xs text-slate-500">
          No profile computed yet — upload one or more statements above, then compute.
        </div>
      )}

      {aggregates && (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-sm text-slate-100">
              Derived aggregates
              {inputSource === "manual_entry" ? (
                <Badge variant="outline" className="ml-2 border-amber-700 text-amber-300 text-[10px] align-middle">
                  Self-reported estimate
                </Badge>
              ) : profile?.computedFromMonths && profile.computedFromMonths.length > 0 ? (
                <span className="ml-2 text-[11px] font-normal text-slate-500">
                  from {profile.computedFromMonths.length} statement month(s): {profile.computedFromMonths.join(", ")}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Avg. monthly income</div>
              <div className="text-sm font-semibold text-emerald-300">{money(aggregates.incomeMonthly)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Avg. monthly expenditure</div>
              <div className="text-sm font-semibold text-rose-300">{money(aggregates.expenditureMonthly)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Avg. monthly surplus</div>
              <div className={`text-sm font-semibold ${aggregates.availableSurplusMonthly >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {money(aggregates.availableSurplusMonthly)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Cash-flow volatility</div>
              <div className="text-sm font-semibold text-slate-200">
                {aggregates.cashFlowVolatility === null ? "— (needs 2+ months)" : `${(aggregates.cashFlowVolatility * 100).toFixed(0)}%`}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Liquidity buffer</div>
              <div className="text-sm font-semibold text-slate-200">
                {aggregates.liquidityBufferDays === null ? "— (no balance column found)" : `${aggregates.liquidityBufferDays} days`}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {aggregates && aggregates.recurringCommitments.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader><CardTitle className="text-sm text-slate-100">Recurring commitments</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {aggregates.recurringCommitments.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{c.label} <span className="text-slate-600">· {c.observedMonths} month(s)</span></span>
                <span className="text-slate-400">{money(c.monthlyAmount)}/mo</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {aggregates && aggregates.topCategories.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader><CardTitle className="text-sm text-slate-100">Top expenditure concentration</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {aggregates.topCategories.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{c.category}</span>
                <span className="text-slate-400">{money(c.monthlyAmount)}/mo · {(c.shareOfExpenditure * 100).toFixed(0)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {envelope && (
        <Card className="border-amber-800/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-amber-200">
              <TrendingDown className="h-4 w-4" />
              Candidate risk/trading envelope
            </CardTitle>
            <CardDescription className="text-[11px] text-amber-300/80">
              A recommendation only — review before acting. MoneyPenny holds no authority to trade on this envelope;
              enforcing it against a real order requires your own explicit delegation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><div className="text-slate-500">Candidate max notional</div><div className="font-semibold text-slate-200">{money(envelope.candidateMaxNotional)}</div></div>
              <div><div className="text-slate-500">Candidate loss/risk budget</div><div className="font-semibold text-slate-200">{money(envelope.candidateLossRiskBudget)}</div></div>
              <div><div className="text-slate-500">Liquidity reserve</div><div className="font-semibold text-slate-200">{money(envelope.liquidityReserve)}</div></div>
            </div>
            {envelope.concentrationLimits.map((l, i) => (
              <Badge key={i} variant="outline" className="mr-1.5 border-amber-700 text-amber-300">{l}</Badge>
            ))}
            {envelope.strategyConstraints.map((c, i) => (
              <div key={i} className="text-[11px] text-amber-300/80">· {c}</div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default FinancialProfilePanel;
