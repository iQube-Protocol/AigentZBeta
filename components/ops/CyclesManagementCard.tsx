"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Send,
  Shield,
  HelpCircle,
  Copy,
} from "lucide-react";

interface CanisterCyclesInfo {
  canisterId: string;
  name: string;
  role: string;
  cycles: number | null;
  cyclesDisplay: string;
  status: "good" | "low" | "critical" | "unknown";
  alert: string | null;
}

interface CyclesStatusResponse {
  ok: boolean;
  canisters: CanisterCyclesInfo[];
  identity: {
    configured: boolean;
    type: "ed25519" | "secp256k1" | "anonymous";
    principal: string | null;
  };
  walletCanisterId: string | null;
  thresholds: {
    critical: number;
    low: number;
    healthy: number;
  };
  at: string;
}

function Card({
  title,
  children,
  actions,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-4 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function statusIcon(status: CanisterCyclesInfo["status"], size = 14) {
  switch (status) {
    case "good":
      return <CheckCircle size={size} className="text-emerald-400" />;
    case "low":
      return <AlertTriangle size={size} className="text-amber-400" />;
    case "critical":
      return <XCircle size={size} className="text-red-400" />;
    case "unknown":
      return <HelpCircle size={size} className="text-blue-400" />;
  }
}

function statusBorder(status: CanisterCyclesInfo["status"]) {
  switch (status) {
    case "good":
      return "border-emerald-500/30 bg-emerald-500/5";
    case "low":
      return "border-amber-500/30 bg-amber-500/5";
    case "critical":
      return "border-red-500/30 bg-red-500/5";
    case "unknown":
      return "border-blue-500/30 bg-blue-500/5";
  }
}

function statusTextColor(status: CanisterCyclesInfo["status"]) {
  switch (status) {
    case "good":
      return "text-emerald-400";
    case "low":
      return "text-amber-400";
    case "critical":
      return "text-red-400";
    case "unknown":
      return "text-blue-400";
  }
}

function truncateId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function WalletAddressCopy({ walletCanisterId }: { walletCanisterId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(walletCanisterId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-slate-800/60 border border-slate-700/50">
      <Shield size={12} className="text-slate-400 flex-shrink-0" />
      <span className="text-[11px] text-slate-400 flex-shrink-0">Wallet canister:</span>
      <span className="font-mono text-[11px] text-slate-200 flex-1 truncate">{walletCanisterId}</span>
      <button
        onClick={copy}
        title="Copy wallet canister ID"
        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors flex-shrink-0"
      >
        <Copy size={10} />
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export function CyclesManagementCard({ title }: { title: string }) {
  const [data, setData] = useState<CyclesStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topUpTarget, setTopUpTarget] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [topUpSending, setTopUpSending] = useState(false);
  const [topUpResult, setTopUpResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/canisters/cycles-status", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CyclesStatusResponse;
      setData(json);
    } catch (e) {
      setError(
        (e as Error).message || "Failed to load canister cycles status"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const targetCanister = data?.canisters.find(
    (c) => c.canisterId === topUpTarget
  );

  async function handleTopUp() {
    if (!topUpTarget || !topUpAmount) return;
    setTopUpSending(true);
    setTopUpResult(null);
    try {
      const res = await fetch("/api/ops/canisters/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canisterId: topUpTarget,
          cycles: Number(topUpAmount),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setTopUpResult({
        ok: true,
        message: json?.message || "Cycles sent successfully",
      });
      setTimeout(() => {
        load();
        setTopUpResult(null);
      }, 3000);
    } catch (e) {
      setTopUpResult({
        ok: false,
        message: (e as Error).message || "Top-up failed",
      });
    } finally {
      setTopUpSending(false);
    }
  }

  const criticalCount =
    data?.canisters.filter((c) => c.status === "critical").length ?? 0;
  const lowCount =
    data?.canisters.filter((c) => c.status === "low").length ?? 0;
  const identityConfigured =
    data?.identity.configured && data.identity.type !== "anonymous";

  return (
    <Card
      title={title}
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      }
    >
      <div className="text-xs text-slate-400">
        ICP canister cycle balances and alerts. Top up canisters directly from
        the wallet canister when cycles run low.
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-xs">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {data && (
        <>
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-slate-700 bg-slate-800/40 text-xs">
            <Shield size={14} className="text-slate-400 flex-shrink-0" />
            <div className="flex-1 text-slate-300">
              <span className="text-slate-400">Server identity:</span>{" "}
              <span className="text-slate-200">{data.identity.type}</span>
              <span className="mx-1.5 text-slate-600">|</span>
              <span className="text-slate-400">Principal:</span>{" "}
              <span className="font-mono text-slate-200">
                {truncateId(data.identity.principal)}
              </span>
              <span className="mx-1.5 text-slate-600">|</span>
              <span className="text-slate-400">Wallet:</span>{" "}
              <span className="font-mono text-slate-200">
                {truncateId(data.walletCanisterId)}
              </span>
            </div>
          </div>

          {data.identity.type === "anonymous" && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-900/30 border border-amber-700/50 text-amber-200 text-xs">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                No DFX_IDENTITY_PEM configured — top-ups require a server
                identity
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.canisters.map((c) => (
              <div
                key={c.canisterId}
                className={`rounded-md border p-3 ${statusBorder(c.status)}`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  {statusIcon(c.status)}
                  <span className="text-sm font-medium text-slate-100">
                    {c.name}
                  </span>
                </div>
                <div
                  className={`text-lg font-semibold tabular-nums ${statusTextColor(c.status)}`}
                >
                  {c.cyclesDisplay}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {c.role}
                </div>
                {identityConfigured && (
                  <button
                    onClick={() => {
                      setTopUpTarget(c.canisterId);
                      setTopUpAmount("");
                      setTopUpResult(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 mt-2 text-[11px] rounded border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
                  >
                    <Zap size={10} />
                    Top up
                  </button>
                )}
                {c.alert && (
                  <div
                    className={`mt-2 text-[11px] ${c.status === "critical" ? "text-red-300" : "text-amber-300"}`}
                  >
                    {c.alert}
                  </div>
                )}
              </div>
            ))}
          </div>

          {topUpTarget && targetCanister && (
            <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Send size={14} className="text-indigo-400" />
                <span className="text-sm font-medium text-slate-100">
                  Send cycles to {targetCanister.name}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({truncateId(topUpTarget)})
                </span>
              </div>

              {data?.walletCanisterId && (
                <WalletAddressCopy walletCanisterId={data.walletCanisterId} />
              )}

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  placeholder="Cycles amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-slate-400">Presets:</span>
                <button
                  onClick={() => setTopUpAmount("500000000000")}
                  className="px-2 py-1 text-[11px] rounded border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
                >
                  500B
                </button>
                <button
                  onClick={() => setTopUpAmount("1000000000000")}
                  className="px-2 py-1 text-[11px] rounded border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
                >
                  1T
                </button>
                <button
                  onClick={() => setTopUpAmount("2000000000000")}
                  className="px-2 py-1 text-[11px] rounded border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
                >
                  2T
                </button>
              </div>

              {topUpResult && (
                <div
                  className={`flex items-start gap-2 p-2.5 rounded-md text-xs mb-3 ${
                    topUpResult.ok
                      ? "bg-emerald-900/30 border border-emerald-700/50 text-emerald-200"
                      : "bg-rose-900/30 border border-rose-700/50 text-rose-200"
                  }`}
                >
                  {topUpResult.ok ? (
                    <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={14} className="flex-shrink-0 mt-0.5" />
                  )}
                  <div>{topUpResult.message}</div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTopUp}
                  disabled={topUpSending || !topUpAmount}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    topUpAmount && !topUpSending
                      ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/40 hover:bg-indigo-500/30"
                      : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                  }`}
                >
                  <Send size={12} />
                  {topUpSending ? "Sending…" : "Send cycles"}
                </button>
                <button
                  onClick={() => {
                    setTopUpTarget(null);
                    setTopUpAmount("");
                    setTopUpResult(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {criticalCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/30 border border-red-700/50 text-red-200 text-xs">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div className="font-semibold">
                CYCLE ALERT: {criticalCount} canister
                {criticalCount > 1 ? "s" : ""} at critical levels
              </div>
            </div>
          )}

          {lowCount > 0 && criticalCount === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-900/30 border border-amber-700/50 text-amber-200 text-xs">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div className="font-semibold">
                CYCLE WARNING: {lowCount} canister{lowCount > 1 ? "s" : ""}{" "}
                running low
              </div>
            </div>
          )}

          {criticalCount > 0 && lowCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-900/30 border border-amber-700/50 text-amber-200 text-xs">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div className="font-semibold">
                CYCLE WARNING: {lowCount} canister{lowCount > 1 ? "s" : ""}{" "}
                running low
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
