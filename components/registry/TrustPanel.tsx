"use client";

import {
  TrustScore,
  TrustBand,
  TRUST_BAND_LABELS,
  TRUST_BAND_ORDER,
} from "@/types/registryIngestion";

interface TrustPanelProps {
  score: TrustScore | null;
  loading?: boolean;
}

const BAND_COLORS: Record<TrustBand, { bg: string; ring: string; text: string; bar: string }> = {
  L1_EXPERIMENTAL:        { bg: "bg-red-500/10",    ring: "ring-red-500/30",    text: "text-red-300",    bar: "bg-red-500" },
  L2_VERIFIED_COMMUNITY:  { bg: "bg-orange-500/10", ring: "ring-orange-500/30", text: "text-orange-300", bar: "bg-orange-400" },
  L3_PRODUCTION_CANDIDATE:{ bg: "bg-yellow-500/10", ring: "ring-yellow-500/30", text: "text-yellow-300", bar: "bg-yellow-400" },
  L4_PRODUCTION_APPROVED: { bg: "bg-emerald-500/10",ring: "ring-emerald-500/30",text: "text-emerald-300",bar: "bg-emerald-400" },
  L5_CORE_SOVEREIGN:      { bg: "bg-cyan-500/10",   ring: "ring-cyan-500/30",   text: "text-cyan-300",   bar: "bg-cyan-400" },
};

const FACTOR_LABELS: Record<string, string> = {
  provenanceQuality:      "Provenance Quality",
  licenseClarity:         "License Clarity",
  maintenancePosture:     "Maintenance Posture",
  dependencyRisk:         "Dependency Risk",
  privilegeFootprint:     "Privilege Footprint",
  validationPassQuality:  "Validation Pass Quality",
  reproducibility:        "Reproducibility",
  wrapperIsolationQuality:"Wrapper Isolation",
};

export function TrustPanel({ score, loading }: TrustPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 rounded-xl bg-white/5" />
        <div className="h-4 w-1/2 rounded bg-white/5" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-3 rounded bg-white/5" />
        ))}
      </div>
    );
  }

  if (!score) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
        No trust score yet. Run validation to compute trust.
      </div>
    );
  }

  const colors = BAND_COLORS[score.trustBand];
  const bandIndex = TRUST_BAND_ORDER.indexOf(score.trustBand);

  return (
    <div className="space-y-4">
      {/* Band badge + numeric score */}
      <div className={`flex items-center justify-between rounded-xl p-4 ring-1 ${colors.bg} ${colors.ring}`}>
        <div>
          <div className={`text-[10px] uppercase tracking-widest ${colors.text}`}>Trust Band</div>
          <div className={`mt-1 text-lg font-bold ${colors.text}`}>
            {TRUST_BAND_LABELS[score.trustBand]}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Score</div>
          <div className={`text-2xl font-bold tabular-nums ${colors.text}`}>
            {score.numericScore.toFixed(0)}
            <span className="text-sm font-normal text-slate-400">/100</span>
          </div>
        </div>
      </div>

      {/* Band progression */}
      <div className="flex items-center gap-1">
        {TRUST_BAND_ORDER.map((band, i) => (
          <div
            key={band}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i <= bandIndex ? BAND_COLORS[band].bar : "bg-white/10"
            }`}
            title={TRUST_BAND_LABELS[band]}
          />
        ))}
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-widest text-slate-500">Factor Breakdown</div>
        {(Object.entries(score.factors) as Array<[string, number]>).map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-xs text-slate-400">{FACTOR_LABELS[key] ?? key}</div>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-400 transition-all"
                style={{ width: `${Math.round(value * 100)}%` }}
              />
            </div>
            <div className="w-8 text-right text-[11px] tabular-nums text-slate-400">
              {Math.round(value * 100)}%
            </div>
          </div>
        ))}
      </div>

      {/* Explanation */}
      {score.explanation && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Show explanation
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-400 leading-relaxed">
            {score.explanation}
          </pre>
        </details>
      )}
    </div>
  );
}
