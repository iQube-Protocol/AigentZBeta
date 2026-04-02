"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { ValidationQube, ValidationStageResult, ValidationStageStatus } from "@/types/registryIngestion";

interface ValidationPanelProps {
  validation: ValidationQube | null;
  loading?: boolean;
  onRunValidation?: () => void;
  running?: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  license_check:        "License Check",
  dependency_inventory: "Dependency Inventory",
  secret_scan:          "Secret Scan",
  sandbox_smoke:        "Sandbox Smoke Test",
  interface_conformance:"Interface Conformance",
  reproducibility:      "Reproducibility",
};

function StageIcon({ status }: { status: ValidationStageStatus }) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-400" />;
  if (status === "warn")   return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
  if (status === "running") return <Clock className="h-4 w-4 text-cyan-400 animate-spin" />;
  return <Clock className="h-4 w-4 text-slate-500" />;
}

function StageRow({ result }: { result: ValidationStageResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
      >
        <StageIcon status={result.status} />
        <span className="flex-1 text-sm text-slate-200">
          {STAGE_LABELS[result.stage] ?? result.stage}
        </span>
        {result.capTrustBand && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 ring-1 ring-red-500/30">
            cap: {result.capTrustBand}
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
      </button>
      {open && result.summary && (
        <div className="px-4 pb-3 pt-0 text-xs text-slate-400 border-t border-white/5">
          {result.summary}
        </div>
      )}
    </div>
  );
}

export function ValidationPanel({ validation, loading, onRunValidation, running }: ValidationPanelProps) {
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-10 rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  const overallColor =
    validation?.overallResult === "pass"
      ? "text-emerald-300"
      : validation?.overallResult === "fail"
      ? "text-red-300"
      : "text-yellow-300";

  return (
    <div className="space-y-4">
      {/* Header + action */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          {validation ? (
            <>
              <div className="text-xs text-slate-400">
                {new Date(validation.startedAt).toLocaleString()}
                {validation.completedAt && (
                  <span className="ml-2 text-slate-500">
                    → {new Date(validation.completedAt).toLocaleString()}
                  </span>
                )}
              </div>
              {validation.overallResult && (
                <div className={`text-sm font-semibold ${overallColor}`}>
                  Overall: {validation.overallResult.toUpperCase()}
                  {validation.trustBandCap && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      (capped at {validation.trustBandCap})
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-slate-400">No validation run yet</div>
          )}
        </div>
        {onRunValidation && (
          <button
            type="button"
            onClick={onRunValidation}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30 disabled:opacity-50 transition-colors"
          >
            {running ? (
              <>
                <Clock className="h-3.5 w-3.5 animate-spin" />
                Running…
              </>
            ) : (
              "Run Validation"
            )}
          </button>
        )}
      </div>

      {/* Summary */}
      {validation?.summary && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-400">
          {validation.summary}
        </div>
      )}

      {/* Stage results */}
      {validation && validation.stagesCompleted.length > 0 ? (
        <div className="space-y-1.5">
          {validation.stagesCompleted.map((r) => (
            <StageRow key={r.stage} result={r} />
          ))}
        </div>
      ) : validation ? (
        <div className="text-sm text-slate-500">No stage results yet</div>
      ) : null}
    </div>
  );
}
