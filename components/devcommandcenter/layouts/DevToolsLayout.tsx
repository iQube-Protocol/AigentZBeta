"use client";

/**
 * DevToolsLayout — the diagnostics instrument cluster (CFS-020 CDE).
 *
 * One aggregator (/api/dev-command-center/devtools) composed from the existing
 * admin probes. Four instruments: Environment (present/absent + missing names),
 * Canisters (health/config), DVN pipeline (receipt status counts, dvn_failed
 * highlighted + honest retry-route note), Receipts (recent T2-safe activity).
 * Refresh button + optional 30s auto-refresh (OFF by default). personaFetch
 * only. Each refresh is observed via DCIR.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Wrench, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { LayoutShell } from "@/components/metame/welcome/layouts/LayoutShell";
import { personaFetch } from "@/utils/personaSpine";

type ReceiptStatus = "local" | "dvn_pending" | "dvn_recorded" | "dvn_failed";

interface ServerCall {
  method: string;
  path: string;
  status: number;
  ms: number;
  at: string;
}

interface DevToolsData {
  at: string;
  environment: { present: number; total: number; missing: string[]; vars: { name: string; present: boolean }[] };
  canisters: { ok: boolean; items: { name: string; ok: boolean; details: string }[] };
  receipts: {
    total: number;
    byStatus: Record<ReceiptStatus, number>;
    recent: { id: string; actionType: string; status: ReceiptStatus; createdAt: string }[];
    retryRoute: string;
  };
  platformTelemetry: {
    dvn: { ok: boolean; pendingMessages: number; validatorsOnline: number; details: string; at: string };
    requestBuffer: { instanceOnly: boolean; cap: number; calls: ServerCall[] };
  };
  escalationLog: {
    source: string;
    entries: { id: string; actionType: string; status: ReceiptStatus; createdAt: string }[];
    retryRoute: string;
    note: string;
  };
}

const AUTO_REFRESH_MS = 30_000;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{title}</div>
      {children}
    </div>
  );
}

export function DevToolsLayout({
  onBack,
  onToolUsed,
}: {
  onBack: () => void;
  onToolUsed?: (op: string) => void;
}) {
  const [data, setData] = useState<DevToolsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    onToolUsed?.("refresh");
    try {
      const res = await personaFetch("/api/dev-command-center/devtools", { cache: "no-store" });
      if (res.status === 403) {
        setError("forbidden — DevTools requires an admin persona");
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? `unexpected response (HTTP ${res.status})`);
        return;
      }
      setData(json as DevToolsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [onToolUsed]);

  useEffect(() => {
    void load();
  }, [load]);

  const savedLoad = useRef(load);
  savedLoad.current = load;
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => void savedLoad.current(), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const failed = data?.receipts.byStatus.dvn_failed ?? 0;

  const body = (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          {error}
        </div>
      )}

      {data && (
        <>
          <Section title="Environment">
            <div className="text-[12px] text-slate-300">
              {data.environment.present}/{data.environment.total} tracked vars present (presence only — values never read)
            </div>
            {data.environment.missing.length > 0 && (
              <div className="text-[11px] text-amber-300">missing: {data.environment.missing.join(", ")}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
              {data.environment.vars.map((v) => (
                <div key={v.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className={v.present ? "text-emerald-400" : "text-slate-600"}>{v.present ? "✓" : "·"}</span>
                  <span className={v.present ? "text-slate-300" : "text-slate-500"}>{v.name}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Canisters">
            <div className="space-y-0.5">
              {data.canisters.items.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className={c.ok ? "text-emerald-400" : "text-slate-600"}>{c.ok ? "✓" : "·"}</span>
                    <span className="text-slate-300">{c.name}</span>
                  </span>
                  <span className="text-slate-500 truncate max-w-[55%]">{c.details}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-500">Live cycle balances: /api/ops/canisters/cycles-status (controller identity).</div>
          </Section>

          <Section title="Platform telemetry (server↔canister↔DVN)">
            <div className="text-[10px] text-slate-500">
              The server-side view a browser&apos;s F12 can&apos;t reach — composed from the ops DVN probe + an
              in-process request buffer.
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded px-1.5 py-0.5 border ${data.platformTelemetry.dvn.ok ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                DVN {data.platformTelemetry.dvn.ok ? "reachable" : "unreachable"}
              </span>
              <span className="rounded px-1.5 py-0.5 border bg-slate-800 text-slate-300 border-slate-700">
                pending+ready: {data.platformTelemetry.dvn.pendingMessages}
              </span>
              <span className="rounded px-1.5 py-0.5 border bg-slate-800 text-slate-300 border-slate-700">
                validators: {data.platformTelemetry.dvn.validatorsOnline}
              </span>
            </div>
            {data.platformTelemetry.dvn.details && (
              <div className="text-[10px] text-slate-500 truncate">{data.platformTelemetry.dvn.details}</div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-300/80">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>
                Request buffer below reflects THIS compute instance only (cap {data.platformTelemetry.requestBuffer.cap}) — it
                resets on cold start. A complete request log is a CloudWatch follow-on (AWS SDK not a dependency).
              </span>
            </div>
            {data.platformTelemetry.requestBuffer.calls.length === 0 ? (
              <div className="text-[11px] text-slate-500">no server calls recorded on this instance yet</div>
            ) : (
              <div className="space-y-0.5 font-mono text-[10.5px]">
                {data.platformTelemetry.requestBuffer.calls.map((c, i) => (
                  <div key={`${c.at}-${i}`} className="flex items-center gap-2">
                    <span className="text-slate-600 w-14 shrink-0">{c.at.slice(11, 19)}</span>
                    <span className="text-slate-400 w-10 shrink-0">{c.method}</span>
                    <span className={`w-8 shrink-0 ${c.status >= 400 ? "text-rose-300" : "text-emerald-300"}`}>{c.status}</span>
                    <span className="text-slate-500 w-14 shrink-0 text-right">{c.ms}ms</span>
                    <span className="text-slate-300 truncate">{c.path}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="DVN pipeline">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {(["dvn_recorded", "dvn_pending", "dvn_failed", "local"] as ReceiptStatus[]).map((s) => {
                const n = data.receipts.byStatus[s] ?? 0;
                const isFailed = s === "dvn_failed" && n > 0;
                return (
                  <span
                    key={s}
                    className={`rounded px-1.5 py-0.5 border ${
                      isFailed
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : s === "dvn_recorded"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {s}: {n}
                  </span>
                );
              })}
            </div>
            {failed > 0 && (
              <div className="flex items-start gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {failed} receipt(s) in <code>dvn_failed</code> — a gap in the provenance trail. Retry from the receipts
                  view via <code>{data.receipts.retryRoute}</code>.
                </span>
              </div>
            )}
          </Section>

          <Section title={`Receipts (recent ${data.receipts.recent.length})`}>
            {data.receipts.recent.length === 0 ? (
              <div className="text-[11px] text-slate-500">no activity receipts for this persona yet</div>
            ) : (
              <div className="space-y-0.5 font-mono text-[10.5px]">
                {data.receipts.recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-300 truncate">{r.actionType}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className={r.status === "dvn_failed" ? "text-rose-300" : r.status === "dvn_recorded" ? "text-emerald-300" : "text-slate-500"}>
                        {r.status}
                      </span>
                      <span className="text-slate-600">{r.createdAt.slice(0, 10)}</span>
                      <span className="text-slate-600">{r.id.slice(0, 8)}…</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Escalation / platform log stream">
            <div className="text-[10px] text-slate-500">
              {data.escalationLog.note}
            </div>
            {data.escalationLog.entries.length === 0 ? (
              <div className="text-[11px] text-emerald-300/80">
                no <code>dvn_failed</code> receipts in the recent window — provenance trail intact
              </div>
            ) : (
              <div className="space-y-0.5 font-mono text-[10.5px]">
                {data.escalationLog.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <span className="text-slate-600 shrink-0">{e.createdAt.slice(0, 19).replace("T", " ")}</span>
                    <span className="text-rose-300 shrink-0">[{e.status}]</span>
                    <span className="text-slate-300 truncate">{e.actionType}</span>
                    <span className="text-slate-600 shrink-0">{e.id.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            )}
            {data.escalationLog.entries.length > 0 && (
              <div className="text-[10px] text-slate-500">
                retry a failed receipt via <code>{data.escalationLog.retryRoute}</code>
              </div>
            )}
          </Section>

          <div className="text-[10px] text-slate-600">last refreshed {new Date(data.at).toLocaleTimeString()}</div>
        </>
      )}

      {!data && !error && (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> loading diagnostics…
        </div>
      )}
    </div>
  );

  return (
    <LayoutShell
      surfaceId="dev-devtools"
      disTemplateId="dev-devtools-layout-v1"
      headerIcon={<Wrench className="w-4 h-4" />}
      headerEyebrow="CDE tool · diagnostics"
      headerTitle="DevTools"
      headerActions={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3 w-3 rounded border-slate-700 bg-slate-900"
            />
            auto 30s
          </label>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      }
      onDismiss={onBack}
      dismissLabel="Back to overview"
      body={body}
    />
  );
}
