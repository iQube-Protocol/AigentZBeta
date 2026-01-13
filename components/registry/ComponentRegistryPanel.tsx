"use client";

import qubeTalkSpec from "@/docs/qubetalk/QUBETALK_SPEC_V0.json";

type RiskTierRule = {
  max_tokens?: number;
  allowed_actions?: string[];
  timeout_seconds?: number;
  requires_approval?: boolean;
  audit_required?: boolean;
};

type ComponentRule = {
  allowed_actions?: string[];
  default_risk_tier?: string;
};

const componentRules =
  (qubeTalkSpec as any)?.schemas?.component_registry_validation || {};

const riskTiers: Record<string, RiskTierRule> = componentRules.risk_tiers || {};
const componentTypes: Record<string, ComponentRule> =
  componentRules.component_type_rules || {};
const validationErrors: Record<string, { code: string; message: string; suggestion?: string }> =
  componentRules.validation_errors || {};

const formatActions = (actions?: string[]) =>
  actions && actions.length ? actions.join(", ") : "—";

export function ComponentRegistryPanel() {
  const typeCount = Object.keys(componentTypes).length;
  const tierCount = Object.keys(riskTiers).length;

  if (!typeCount && !tierCount) {
    return null;
  }

  return (
    <details className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Component Registry Rules</h3>
            <p className="text-sm text-slate-400">
              Validation tiers and allowed actions (source: QubeTalk spec).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full bg-slate-800 px-2 py-0.5">
              {tierCount} tiers
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5">
              {typeCount} types
            </span>
          </div>
        </div>
      </summary>

      <div className="mt-5 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Risk Tiers</h4>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(riskTiers).map(([tier, rule]) => (
              <div
                key={tier}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white capitalize">{tier}</span>
                  {rule.requires_approval ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      Approval
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>Max tokens: {rule.max_tokens ?? "—"}</div>
                  <div>Timeout: {rule.timeout_seconds ?? "—"}s</div>
                  <div>Actions: {formatActions(rule.allowed_actions)}</div>
                  {rule.audit_required ? (
                    <div className="text-amber-300">Audit required</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Component Types</h4>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(componentTypes).map(([type, rule]) => (
              <div
                key={type}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="text-sm font-semibold text-white mb-1">{type}</div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>Default tier: {rule.default_risk_tier ?? "—"}</div>
                  <div>Actions: {formatActions(rule.allowed_actions)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {Object.keys(validationErrors).length ? (
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-3">Validation Errors</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(validationErrors).map(([key, err]) => (
                <div
                  key={key}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="text-sm font-semibold text-slate-200">{err.code}</div>
                  <div className="text-xs text-slate-400 mt-1">{err.message}</div>
                  {err.suggestion ? (
                    <div className="text-xs text-slate-500 mt-2">{err.suggestion}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
