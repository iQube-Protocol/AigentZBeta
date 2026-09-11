"use client";

/**
 * CohortMetricsCard — workbench-side surface for Mailjet aggregate
 * metrics across the Marketa CRM cohorts. Stubbed for the alpha; reads
 * from /api/marketa/cohorts/metrics which itself reads the CRM state
 * columns the Mailjet webhook updates on every open/click/bounce/spam/
 * unsub event.
 *
 * Per operator: "We can stub to consume metrics on send from mailjet
 * API and surface them through a workbench modal or dashboard as a
 * follow on task." This is the foundational surface — extended in a
 * follow-up with per-cohort time-series, cohort comparison view, and
 * direct Mailjet API pulls (sends, deliveries) that complement the
 * webhook-tracked engagement events.
 *
 * Admin-only — gated server-side by the metrics endpoint. Non-admins
 * see nothing here (component returns null on 403).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, BarChart3, ExternalLink } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

interface Metrics {
  campaignId: string;
  campaignLabel: string;
  cohortId: string | null;
  cohortLabel: string;
  totalRecipients: number;
  states: Record<string, number>;
  rates: {
    sent: number;
    open: number;
    click: number;
    backed: number | null;
  };
  lastEventAt: string | null;
  source: string;
}

interface CampaignOption {
  id: "knyt_codex" | "knyt_partners" | "ks_prospects";
  label: string;
  cohorts: Array<{ id: string | null; label: string }>;
}

const CAMPAIGN_OPTIONS: CampaignOption[] = [
  {
    id: "knyt_codex",
    label: "KNYT Codex Investors",
    cohorts: [
      { id: "top_shelf", label: "Top shelf" },
      { id: "zero_knyt", label: "Zero KNYT" },
      { id: "reactivation", label: "Reactivation" },
      { id: "general", label: "General" },
    ],
  },
  {
    id: "knyt_partners",
    label: "KNYT Partners",
    cohorts: [
      { id: "wave_1", label: "Wave 1" },
      { id: "wave_2", label: "Wave 2" },
    ],
  },
  {
    id: "ks_prospects",
    label: "KS Prospects (active)",
    cohorts: [{ id: null, label: "All active" }],
  },
];

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function CohortMetricsCard({ personaId, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/50 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const selectClass = isDark
    ? "bg-slate-900/60 border-slate-700 text-slate-200"
    : "bg-white border-slate-300 text-slate-800";

  const [campaignId, setCampaignId] = useState<CampaignOption["id"]>("knyt_codex");
  const activeCampaign = CAMPAIGN_OPTIONS.find((c) => c.id === campaignId)!;
  const [cohortId, setCohortId] = useState<string | null>(
    activeCampaign.cohorts[0]?.id ?? null,
  );
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // Reset cohort when campaign changes.
  useEffect(() => {
    const first = activeCampaign.cohorts[0]?.id ?? null;
    setCohortId(first);
  }, [activeCampaign]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!campaignId) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ campaignId });
        if (cohortId) qs.set("cohortId", cohortId);
        const res = await personaFetch(`/api/marketa/cohorts/metrics?${qs.toString()}`, {
          personaIdHint: personaId,
        });
        if (res.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || body?.error || `metrics fetch failed (${res.status})`);
        }
        const json = (await res.json()) as Metrics;
        if (!cancelled) {
          setData(json);
          setForbidden(false);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, cohortId, personaId]);

  // Build a normalised state list — pad missing buckets with 0 so the
  // bar reads consistently across campaigns even when no events have
  // landed yet.
  const stateRows = useMemo(() => {
    if (!data) return [];
    const order = ["unsent", "sent", "opened", "clicked", "backed", "bounced", "opted_out"];
    return order.map((k) => ({ key: k, count: data.states[k] ?? 0 })).filter((r) => r.count > 0);
  }, [data]);

  // Forbidden = admin-only — hide entirely.
  if (forbidden) return null;

  return (
    <section className={`rounded-lg border p-5 ${surfaceClass}`}>
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className={`w-4 h-4 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
            <span className={`text-xs uppercase tracking-wider ${mutedClass}`}>
              Cohort metrics
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-tight">Marketa send aggregates</h3>
          <p className={`text-sm mt-1 ${mutedClass}`}>
            Per-cohort open / click / bounce counts from the Mailjet webhook. Stubbed in alpha — Phase 2 wires direct Mailjet API pulls.
          </p>
        </div>
      </header>

      {/* Picker — campaign + cohort */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className={`uppercase tracking-wider ${mutedClass}`}>Campaign</span>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value as CampaignOption["id"])}
            className={`rounded-md border px-2 py-1.5 text-sm ${selectClass}`}
          >
            {CAMPAIGN_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {activeCampaign.cohorts.length > 1 && (
          <label className="flex flex-col gap-1 text-xs">
            <span className={`uppercase tracking-wider ${mutedClass}`}>Cohort</span>
            <select
              value={cohortId ?? ""}
              onChange={(e) => setCohortId(e.target.value || null)}
              className={`rounded-md border px-2 py-1.5 text-sm ${selectClass}`}
            >
              {activeCampaign.cohorts.map((c) => (
                <option key={c.id ?? "all"} value={c.id ?? ""}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <a
          href="https://app.mailjet.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className={`ml-auto inline-flex items-center gap-1 text-[11px] underline ${isDark ? "text-violet-300" : "text-violet-700"}`}
          title="Open Mailjet dashboard for raw send / delivery analytics"
        >
          Mailjet dashboard <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {loading && (
        <div className={`flex items-center gap-2 text-sm ${mutedClass}`}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading metrics…
        </div>
      )}
      {error && !loading && (
        <p className={`text-sm ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</p>
      )}
      {!loading && !error && data && (
        <div className="space-y-4">
          {/* Headline rates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Recipients" value={data.totalRecipients.toLocaleString()} isDark={isDark} mutedClass={mutedClass} />
            <Metric label="Send rate" value={`${Math.round(data.rates.sent * 100)}%`} isDark={isDark} mutedClass={mutedClass} />
            <Metric label="Open rate" value={`${Math.round(data.rates.open * 100)}%`} isDark={isDark} mutedClass={mutedClass} />
            <Metric label="Click rate" value={`${Math.round(data.rates.click * 100)}%`} isDark={isDark} mutedClass={mutedClass} />
          </div>
          {/* State breakdown */}
          {stateRows.length > 0 && (
            <div>
              <h4 className={`text-[10px] uppercase tracking-wider mb-2 ${mutedClass}`}>State breakdown</h4>
              <ul className="space-y-1">
                {stateRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{row.key.replace(/_/g, " ")}</span>
                    <span className="font-mono">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <footer className={`text-[10px] ${mutedClass}`}>
            Source: {data.source}
            {data.lastEventAt ? ` · last event ${new Date(data.lastEventAt).toLocaleString()}` : ""}
          </footer>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  isDark,
  mutedClass,
}: {
  label: string;
  value: string;
  isDark: boolean;
  mutedClass: string;
}) {
  return (
    <div className={`rounded-md border p-3 ${isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
      <div className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

export default CohortMetricsCard;
