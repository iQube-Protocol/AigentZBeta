import { useMemo, useState } from "react";
import Navbar from "../../components/Navbar";

type TxResponse = {
  ok: boolean;
  error?: string;
  message?: unknown;
  attestations?: unknown[];
  fallback?: boolean;
  pending?: boolean;
  at?: string;
};

type MonitorResponse = {
  ok: boolean;
  error?: string;
  messageId?: string;
  fallback?: boolean;
  note?: string;
  at?: string;
};

const DEFAULT_HASH = "0x1111111111111111111111111111111111111111111111111111111111111111";

export default function DVNTestPanel() {
  const [apiBase, setApiBase] = useState("http://localhost:400");
  const [txHash, setTxHash] = useState(DEFAULT_HASH);
  const [chainId, setChainId] = useState(84532);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TxResponse | null>(null);
  const [monitorResult, setMonitorResult] = useState<MonitorResponse | null>(null);

  const normalizedBase = useMemo(() => apiBase.replace(/\/$/, ""), [apiBase]);

  async function runTxQuery() {
    setLoading(true);
    setError(null);
    try {
      const url = `${normalizedBase}/api/ops/dvn/tx?id=local:${encodeURIComponent(txHash)}&chainId=${chainId}`;
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as TxResponse;
      setTxResult(json);
      if (!response.ok || !json.ok) setError(json.error || `HTTP ${response.status}`);
    } catch (e: any) {
      setError(e?.message || "Failed to query tx endpoint");
    } finally {
      setLoading(false);
    }
  }

  async function runMonitor() {
    setLoading(true);
    setError(null);
    try {
      const url = `${normalizedBase}/api/ops/dvn/monitor`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash, chainId }),
      });
      const json = (await response.json()) as MonitorResponse;
      setMonitorResult(json);
      if (!response.ok || !json.ok) setError(json.error || `HTTP ${response.status}`);
    } catch (e: any) {
      setError(e?.message || "Failed to query monitor endpoint");
    } finally {
      setLoading(false);
    }
  }

  async function runUnsupportedChainCheck() {
    setLoading(true);
    setError(null);
    try {
      const url = `${normalizedBase}/api/ops/dvn/tx?id=local:${encodeURIComponent(txHash)}&chainId=999999`;
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as TxResponse;
      setTxResult(json);
      if (!response.ok || !json.ok) setError(json.error || `HTTP ${response.status}`);
    } catch (e: any) {
      setError(e?.message || "Failed to run unsupported chain check");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="pt-28 pb-16 px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">DVN Test Panel</h1>
            <p className="text-sm text-slate-600 mt-2">
              Quick frontend smoke test for Express DVN routes.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              API Base
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Tx Hash
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Chain ID
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={chainId}
                onChange={(e) => setChainId(Number(e.target.value))}
              >
                <option value={84532}>84532 - Base Sepolia</option>
                <option value={80002}>80002 - Polygon Amoy</option>
                <option value={11155111}>11155111 - Ethereum Sepolia</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={runMonitor}
                disabled={loading}
                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                POST monitor
              </button>
              <button
                onClick={runTxQuery}
                disabled={loading}
                className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                GET tx (local)
              </button>
              <button
                onClick={runUnsupportedChainCheck}
                disabled={loading}
                className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm disabled:opacity-60"
              >
                Check unsupported chain
              </button>
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Monitor Response</h2>
            <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(monitorResult, null, 2)}
            </pre>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Tx Response</h2>
            <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(txResult, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
