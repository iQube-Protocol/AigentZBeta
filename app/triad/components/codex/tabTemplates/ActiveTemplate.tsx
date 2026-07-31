"use client";

/**
 * ActiveTemplate — cartridge-agnostic active surface (metrics + actions).
 *
 * Phase 5 reference template implementing the Active Tab pattern from
 * PRD §20. Each cartridge has at most ONE active tab; it renders the
 * top-of-mind metrics and the take-an-action CTAs that drive the
 * cartridge forward.
 *
 * Phase 5a scope: render metrics + actions read from `config`. The
 * wizard (Phase 6) writes `config.metrics` and `config.actions` arrays.
 * Phase 10 wires the cartridge_activations row → DVN receipt path so
 * an action click emits a state-change receipt.
 *
 * Expected config shape (the wizard writes this verbatim):
 *   metrics: Array<{ label: string; value: string | number; tone?: 'neutral' | 'good' | 'warn' }>
 *   actions: Array<{ label: string; href?: string; onClick?: never; description?: string }>
 *
 * Unknown config keys are ignored (forward-compatible).
 */

import React from "react";
import type { TabTemplateProps } from "./types";

interface MetricRow {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warn";
}

interface ActionRow {
  label: string;
  href?: string;
  description?: string;
}

function isMetricRow(x: unknown): x is MetricRow {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return typeof r.label === "string" && (typeof r.value === "string" || typeof r.value === "number");
}

function isActionRow(x: unknown): x is ActionRow {
  if (!x || typeof x !== "object") return false;
  return typeof (x as Record<string, unknown>).label === "string";
}

export function ActiveTemplate({ cartridgeSlug, theme, config }: TabTemplateProps) {
  const dark = theme === "dark";
  const metricsInput = Array.isArray(config?.metrics) ? config!.metrics : [];
  const actionsInput = Array.isArray(config?.actions) ? config!.actions : [];
  const metrics = metricsInput.filter(isMetricRow);
  const actions = actionsInput.filter(isActionRow);

  return (
    <div className={`space-y-6 ${dark ? "text-slate-200" : "text-slate-900"}`}>
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
          }`}
        >
          {cartridgeSlug}
        </span>
      </header>

      {metrics.length > 0 ? (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {metrics.map((m, i) => (
            <div
              key={`metric-${i}`}
              className={`p-3 rounded border ${
                dark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
              }`}
            >
              <div className={`text-xs ${dark ? "text-slate-400" : "text-slate-600"}`}>
                {m.label}
              </div>
              <div
                className={`text-xl font-semibold mt-1 ${
                  m.tone === "good"
                    ? dark ? "text-emerald-400" : "text-emerald-600"
                    : m.tone === "warn"
                      ? dark ? "text-amber-400" : "text-amber-600"
                      : ""
                }`}
              >
                {m.value}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-600"}`}>
          No metrics configured yet. The wizard writes the metrics array on cartridge creation.
        </p>
      )}

      {actions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Take action</h3>
          <ul className="space-y-2">
            {actions.map((a, i) => (
              <li
                key={`action-${i}`}
                className={`p-3 rounded border ${
                  dark ? "bg-slate-900/50 border-slate-700" : "bg-white border-slate-200"
                }`}
              >
                {a.href ? (
                  <a
                    href={a.href}
                    className={`text-sm font-medium ${
                      dark ? "text-cyan-400 hover:text-cyan-300" : "text-cyan-600 hover:text-cyan-700"
                    }`}
                  >
                    {a.label}
                  </a>
                ) : (
                  <span className="text-sm font-medium">{a.label}</span>
                )}
                {a.description && (
                  <p
                    className={`text-xs mt-1 ${
                      dark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {a.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>
        Template: active-v1 · Phase 5a. Action click emits a DVN receipt once Phase 10 lands.
      </p>
    </div>
  );
}
