"use client";

import React, { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Copy, ExternalLink } from "lucide-react";
import { useCanisterHealth } from "@/hooks/ops/useCanisterHealth";
import { useBTC_Testnet } from "@/hooks/ops/useBTC_Testnet";

// Extend ChainStatus type to include latestTx if not present
type ChainStatus = {
  ok?: boolean;
  at?: string;
  anchor?: any;
  data?: any;
  latestTx?: { txid: string }; // Ensure latestTx is present for BTC and other chains
};
import { useEthereumSepolia } from "@/hooks/ops/useEthereumSepolia";
import { usePolygonAmoy } from "@/hooks/ops/usePolygonAmoy";
import { useOptimismSepolia } from "@/hooks/ops/useOptimismSepolia";
import { useArbitrumSepolia } from "@/hooks/ops/useArbitrumSepolia";
import { useBaseSepolia } from "@/hooks/ops/useBaseSepolia";
import { useSyncStatus } from "@/hooks/ops/useSyncStatus";
import { useDVNStatus } from "@/hooks/ops/useDVNStatus";
import { useDVNMonitor } from "@/hooks/ops/useDVNMonitor";
import { useSolanaTestnet } from "@/hooks/ops/useSolanaTestnet";
import { useCrossChain } from "@/hooks/ops/useCrossChain";
import { useIqbLatest } from "@/hooks/ops/useIqbLatest";
import { QCTTradingCard } from "@/components/ops/QCTTradingCard";

// Feature flags (default Solana ON unless explicitly disabled)
const FEATURE_SOLANA_OPS = process.env.NEXT_PUBLIC_FEATURE_SOLANA_OPS !== "false";

// Simple Card wrapper to match AigentZ Beta look & feel
function Card({ title, children, actions, className }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6 ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        {children}
      </div>
    </div>
  );
}

function IconRefresh({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      aria-label="Refresh"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
    >
      <RefreshCw size={16} />
    </button>
  );
}

// QCT Rekey (Phase 2) Card Component - Multi-Chain Key Rotation
function QCTRekeyCard({ title }: { title: string }) {
  const [selectedChains, setSelectedChains] = React.useState<string[]>(['evm']);
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>(['wallet']);
  const [dryRun, setDryRun] = React.useState<boolean>(true);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [result, setResult] = React.useState<any>(null);
  const [keyFingerprints, setKeyFingerprints] = React.useState<any>({});
  const [showConfirmModal, setShowConfirmModal] = React.useState<boolean>(false);

  const chains = [
    { id: 'evm', name: 'EVM Chains', icon: '🔗', status: 'active' },
    { id: 'bitcoin', name: 'Bitcoin', icon: '₿', status: 'active' },
    { id: 'solana', name: 'Solana', icon: '◎', status: 'pda_proxy' }, // or 'threshold' or 'unavailable'
  ];

  const scopes = [
    { id: 'wallet', name: 'Wallet Keys', description: 'User wallet signing keys' },
    { id: 'validator', name: 'DVN Validator', description: 'Cross-chain validator keys' },
    { id: 'bridge', name: 'Bridge Keys', description: 'Cross-chain bridge signing keys' },
  ];

  // Load current key fingerprints on mount
  React.useEffect(() => {
    loadKeyFingerprints();
  }, []);

  async function loadKeyFingerprints() {
    try {
      const response = await fetch('/api/qct/rekey?action=fingerprints');
      const data = await response.json();
      if (data.ok) {
        setKeyFingerprints(data.fingerprints);
      }
    } catch (error) {
      console.warn('Failed to load key fingerprints:', error);
    }
  }

  function toggleChain(chainId: string) {
    setSelectedChains(prev => 
      prev.includes(chainId) 
        ? prev.filter(id => id !== chainId)
        : [...prev, chainId]
    );
  }

  function toggleScope(scopeId: string) {
    setSelectedScopes(prev => 
      prev.includes(scopeId) 
        ? prev.filter(id => id !== scopeId)
        : [...prev, scopeId]
    );
  }

  async function onInitiateRekey() {
    if (selectedChains.length === 0 || selectedScopes.length === 0) {
      alert('Please select at least one chain and one scope');
      return;
    }

    if (!dryRun) {
      setShowConfirmModal(true);
      return;
    }

    await executeRekey();
  }

  async function executeRekey() {
    try {
      setBusy(true);
      setResult(null);
      setShowConfirmModal(false);

      const payload = {
        chains: selectedChains,
        scopes: selectedScopes,
        dryRun,
        timestamp: Date.now(),
      };

      const response = await fetch('/api/qct/rekey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Rekey operation failed');
      }

      setResult(data);
      
      // Refresh key fingerprints after successful rekey (Firefox-compatible)
      if (!dryRun) {
        // Use Promise-based delay for better Firefox compatibility
        Promise.resolve().then(async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            await loadKeyFingerprints();
          } catch (error) {
            console.warn('Key fingerprints refresh failed:', error);
          }
        });
      }

    } catch (error: any) {
      alert(error.message || 'Rekey operation failed');
    } finally {
      setBusy(false);
    }
  }

  function getChainFingerprint(chainId: string): string {
    const fp = keyFingerprints[chainId];
    if (!fp) return '—';
    
    switch (chainId) {
      case 'evm':
        return fp.address ? `${fp.address.slice(0, 6)}...${fp.address.slice(-4)}` : '—';
      case 'bitcoin':
        return fp.address ? `${fp.address.slice(0, 8)}...${fp.address.slice(-6)}` : '—';
      case 'solana':
        return fp.pubkey ? `${fp.pubkey.slice(0, 8)}...${fp.pubkey.slice(-6)}` : '—';
      default:
        return '—';
    }
  }

  function getChainStatus(chainId: string): string {
    const chain = chains.find(c => c.id === chainId);
    if (!chain) return 'unknown';
    
    if (chainId === 'solana') {
      return chain.status === 'pda_proxy' ? 'PDA Proxy' : 
             chain.status === 'threshold' ? 'Threshold' : 'Unavailable';
    }
    
    return chain.status === 'active' ? 'Active' : 'Inactive';
  }

  return (
    <Card title={title}>
      <div className="space-y-4">
        <div className="text-xs text-slate-400">
          Cross-chain key rotation with DVN verification. Bitcoin + Solana integrated.
        </div>

        {/* Current Key Fingerprints */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">Current Key Fingerprints</div>
          <div className="space-y-1">
            {chains.map(chain => (
              <div key={chain.id} className="flex items-center justify-between bg-slate-800/30 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{chain.icon}</span>
                  <span className="text-xs text-slate-300">{chain.name}</span>
                  <span className={`text-xs px-1 rounded ${
                    getChainStatus(chain.id) === 'Active' ? 'bg-emerald-500/20 text-emerald-300' :
                    getChainStatus(chain.id) === 'PDA Proxy' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {getChainStatus(chain.id)}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {getChainFingerprint(chain.id)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chain Selection */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">Target Chains</div>
          <div className="flex flex-wrap gap-2">
            {chains.map(chain => (
              <button
                key={chain.id}
                onClick={() => toggleChain(chain.id)}
                disabled={chain.status === 'unavailable'}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  selectedChains.includes(chain.id)
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span>{chain.icon}</span>
                <span>{chain.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scope Selection */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">Rekey Scope</div>
          <div className="space-y-1">
            {scopes.map(scope => (
              <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.id)}
                  onChange={() => toggleScope(scope.id)}
                  className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                />
                <div className="flex-1">
                  <div className="text-xs text-slate-300">{scope.name}</div>
                  <div className="text-xs text-slate-500">{scope.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Safety Controls */}
        <div className="space-y-2 border-t border-slate-700 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/20"
            />
            <div className="text-xs text-slate-300">
              Dry Run Mode <span className="text-slate-500">(plan only, no actual rotation)</span>
            </div>
          </label>
        </div>

        {/* Action Button */}
        <button
          onClick={onInitiateRekey}
          disabled={busy || selectedChains.length === 0 || selectedScopes.length === 0}
          className="w-full px-3 py-2 bg-amber-500/10 text-amber-300 rounded-md hover:bg-amber-500/20 border border-amber-500/30 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Processing...' : dryRun ? 'Plan Rekey' : 'Execute Rekey'}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-2 border-t border-slate-700 pt-3">
            <div className="text-xs font-medium text-slate-300">
              {dryRun ? 'Rekey Plan' : 'Rekey Result'}
            </div>
            <div className="space-y-1 text-xs">
              {result.messageId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">DVN Message ID:</span>
                  <span className="text-slate-300 font-mono truncate max-w-[60%]" title={result.messageId}>
                    {result.messageId}
                  </span>
                </div>
              )}
              {result.receiptId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">PoS Receipt ID:</span>
                  <span className="text-slate-300 font-mono truncate max-w-[60%]" title={result.receiptId}>
                    {result.receiptId}
                  </span>
                </div>
              )}
              {result.plan && (
                <div className="bg-slate-800/30 rounded p-2 space-y-1">
                  <div className="text-slate-400">Planned Actions:</div>
                  {result.plan.map((action: string, i: number) => (
                    <div key={i} className="text-slate-300">• {action}</div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                <span className={`text-xs ${result.status === 'completed' ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {result.status || 'pending'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">At:</span>
                <span className="text-slate-300">{result.at}</span>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
              <div className="space-y-4">
                <div className="text-lg font-medium text-slate-100">Confirm Key Rotation</div>
                <div className="text-sm text-slate-300">
                  You are about to rotate keys for:
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Chains:</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedChains.map(chainId => {
                      const chain = chains.find(c => c.id === chainId);
                      return chain ? (
                        <span key={chainId} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                          {chain.icon} {chain.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div className="text-xs text-slate-400">Scopes:</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedScopes.map(scopeId => {
                      const scope = scopes.find(s => s.id === scopeId);
                      return scope ? (
                        <span key={scopeId} className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs">
                          {scope.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="text-sm text-red-300 bg-red-500/10 rounded p-2 border border-red-500/30">
                  ⚠️ This action cannot be undone. Ensure you have backup access to all affected systems.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeRekey}
                    className="flex-1 px-3 py-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 border border-red-500/30 text-sm"
                  >
                    Confirm Rotation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Format an ISO timestamp to relative time (e.g., 23s ago)
function timeSince(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function badgeClassFor(key: string): string {
  // Registry-style badge: bg-<color>-500/20 text-<color>-300 ring-1 ring-<color>-500/30
  switch (key) {
    case "btc_testnet":
      return "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"; // Bitcoin = Amber
    case "eth_sepolia":
      return "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"; // Sepolia = Indigo
    case "polygon_amoy":
      return "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"; // Amoy = Purple
    case "optimism_sepolia":
      return "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"; // Optimism = Red
    case "arbitrum_sepolia":
      return "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"; // Arbitrum = Blue
    case "base_sepolia":
      return "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30"; // Base = Cyan
    case "solana_testnet":
      return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"; // Solana = Emerald
    case "sync_status":
      return "bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30"; // Sync = Teal
    default:
      return "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30"; // Default = Slate
  }
}

export default function OpsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [icpHealth, setIcpHealth] = useState<{ ok: boolean; host?: string } | null>(null);

  // Hooks per card
  const icp = useCanisterHealth(30000);
  const btc = useBTC_Testnet(30000);
  const sepolia = useEthereumSepolia(30000);
  const amoy = usePolygonAmoy(30000);
  const optimismSepolia = useOptimismSepolia(30000);
  const arbitrumSepolia = useArbitrumSepolia(30000);
  const baseSepolia = useBaseSepolia(30000);
  const syncStatus = useSyncStatus(30000);
  const dvn = useDVNStatus(30000);
  const xchain = useCrossChain(30000);
  const solTest = useSolanaTestnet(30000);
  const dvnMon = useDVNMonitor();
  const [dvnTxHash, setDvnTxHash] = useState("");
  const [dvnChainId, setDvnChainId] = useState<number>(80002); // default Amoy
  const [testTxBusy, setTestTxBusy] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // After DVN monitor/query changes, refresh dependent cards
  useEffect(() => {
    try {
      dvn.refresh?.();
      syncStatus.refresh?.();
      xchain.refresh?.();
    } catch {}
  }, [dvnMon.messageId, dvnMon.txHash, dvnMon.attestations?.length]);

  // Poll ICP health to show local connection indicator
  useEffect(() => {
    let timer: any;
    const probe = async () => {
      try {
        const res = await fetch('/api/ops/icp/health', { cache: 'no-store' });
        const json = await res.json();
        setIcpHealth({ ok: !!json?.ok, host: json?.host });
      } catch {
        setIcpHealth({ ok: false });
      }
    };
    probe();
    timer = setInterval(probe, 30000);
    return () => timer && clearInterval(timer);
  }, []);

  // Persist DVN/Amoy tx hash across refreshes without modifying createTestTx
  useEffect(() => {
    try {
      const key = `last_tx_${dvnChainId}`;
      const saved = localStorage.getItem(key);
      if (saved && typeof saved === 'string' && saved.startsWith('0x')) {
        setDvnTxHash(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (dvnTxHash && dvnTxHash.startsWith('0x')) {
        const key = `last_tx_${dvnChainId}`;
        localStorage.setItem(key, dvnTxHash);
      }
    } catch {}
  }, [dvnTxHash]);

  // When DVN monitor/query state changes, refresh dependent cards (DVN status, Sync, Cross-Chain)
  useEffect(() => {
    try {
      // Refresh DVN Status
      dvn.refresh?.();
      // Refresh Sync Status
      syncStatus.refresh?.();
      // Refresh Cross-Chain aggregated status
      xchain.refresh?.();
    } catch {}
    // Trigger on message id, attestations length, or tx hash changes
  }, [dvnMon.messageId, dvnMon.attestations?.length, dvnMon.txHash]);

  // IQB/DVN latest per EVM chain (prefer DVN, fallback to provided txHash)
  const iqbSepolia = useIqbLatest(11155111, dvnChainId === 11155111 ? dvnTxHash : undefined, 30000);
  const iqbAmoy = useIqbLatest(80002, dvnChainId === 80002 ? dvnTxHash : undefined, 30000);
  const iqbOptimism = useIqbLatest(11155420, dvnChainId === 11155420 ? dvnTxHash : undefined, 30000);
  const iqbArbitrum = useIqbLatest(421614, dvnChainId === 421614 ? dvnTxHash : undefined, 30000);
  const iqbBase = useIqbLatest(84532, dvnChainId === 84532 ? dvnTxHash : undefined, 30000);

  const cards = useMemo(() => [
    { key: "icp_health", title: "ICP Canister Health" },
    { key: "btc_anchor", title: "BTC Anchor Status" },
    { key: "cross_chain", title: "Cross-Chain Status" },
    { key: "sync_status", title: "Canister Sync Status" },
    { key: "icp_dvn", title: "ICP DVN" },
    { key: "dvn_mint_tests", title: "DVN Mint Tests" },
    { key: "qct_trading", title: "QCT Cross-Chain Trading" },
    { key: "qct_rekey", title: "QCT Rekey (Stage 1A)" },
    { key: "btc_testnet", title: "BTC Testnet" },
    { key: "eth_sepolia", title: "Ethereum Sepolia" },
    { key: "polygon_amoy", title: "Polygon Amoy" },
    { key: "optimism_sepolia", title: "Optimism Sepolia" },
    { key: "arbitrum_sepolia", title: "Arbitrum Sepolia" },
    { key: "base_sepolia", title: "Base Sepolia" },
    ...(FEATURE_SOLANA_OPS ? [{ key: "solana_testnet", title: "Solana Testnet" } as const] : []),
  ], []);

  // Show loading state until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Network Operations</h1>
          <p className="text-sm text-slate-300 mt-1">Admin area for protocol health and cross-chain test flows.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {cards.map(({ key, title }) => (
            <Card key={key} title={title} actions={<IconRefresh disabled={true} />}>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-slate-500">Loading...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Last Check:</span>
                <span className="text-xs text-slate-500">—</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Network Operations</h1>
          {icpHealth && (
            <span
              className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs ${icpHealth.ok ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/30'}`}
              title={icpHealth.host || ''}
            >
              <span className={icpHealth.ok ? 'text-emerald-400' : 'text-slate-400'}>●</span>
              {icpHealth.ok && icpHealth.host?.includes('127.0.0.1:4943') ? 'Local ICP connected' : 'ICP status' }
            </span>
          )}
        </div>
        <p className="text-sm text-slate-300 mt-1">Admin area for protocol health and cross-chain test flows.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {cards.map(({ key, title }) => {
          if (key === "icp_health") {
            const ok = icp.data?.ok ?? false;
            const at = icp.data?.at ?? "—";
            const canisters = (icp.data as any)?.canisters?.items ?? [];
            return (
              <Card key={key} title={title} actions={<IconRefresh onClick={icp.refresh} disabled={icp.loading} />}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">Overall Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                {canisters.map((canister: any) => (
                  <div key={canister.name} className="flex items-center justify-between">
                    <span className="text-slate-400 capitalize text-xs">
                      {canister.name.replace(/_/g, ' ')}:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={canister.ok ? "text-emerald-400" : "text-red-400"}>●</span>
                      <span className="text-xs text-slate-500" title={canister.at}>
                        {timeSince(canister.at)}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500" title={at}>{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          if (key === "btc_testnet") {
            const ok = btc.data?.ok ?? false;
            const at = btc.data?.at ?? "—";
            const rpcApi = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET || '';
            // Show the actual API being used, not just the configured one
            const actualEndpoint = (btc.data as any)?.details?.includes('blockstream.info') ? 'blockstream.info/testnet' : 
                                  (btc.data as any)?.details?.includes('mempool.space') ? 'mempool.space/testnet' : 
                                  rpcApi ? rpcApi.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '') : '—';
            const rpcHost = actualEndpoint;
            // Get block height from testnet data, not anchor data
            const blockHeight = typeof (btc.data as any)?.blockHeight === 'number' ? (btc.data as any).blockHeight : '—';
            const displayTx = btc.anchor?.txid;
            const explorerBase = (process.env.NEXT_PUBLIC_RPC_BTC_TESTNET?.replace(/\/$/, '') || 'https://mempool.space/testnet/api').replace('/api','');
            const txUrl = displayTx ? `${explorerBase}/tx/${displayTx}` : undefined;
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={btc.refresh} disabled={btc.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">RPC:</span>
                  <span className="text-xs text-slate-300">{rpcHost}</span>
                </div>
                {displayTx && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest TX:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={txUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={displayTx}>
                        <span className="truncate font-mono">{displayTx}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                      <button
                        aria-label="Copy TX Hash"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => displayTx && navigator.clipboard.writeText(displayTx)}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block Height:</span>
                  <span className="text-xs text-slate-300">{blockHeight}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          if (key === "eth_sepolia") {
            const ok = sepolia.data?.ok ?? false;
            const at = sepolia.data?.at ?? "—";
            const chainId = sepolia.data?.chainId ?? "11155111";
            const latestTx = iqbSepolia.data?.txHash
              || ((dvnChainId === 11155111 && dvnTxHash && dvnTxHash.startsWith('0x')) ? dvnTxHash : undefined)
              || sepolia.data?.latestTx
              || "—";
            const blockNumber = (typeof iqbSepolia.data?.blockNumber === 'number')
              ? iqbSepolia.data.blockNumber.toLocaleString()
              : (sepolia.data?.blockNumber ?? "—");
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={() => { sepolia.refresh(); iqbSepolia.refresh(); }} disabled={sepolia.loading || iqbSepolia.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="text-xs text-slate-300">{chainId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Latest TX:</span>
                  <span className="flex items-center gap-1 max-w-[60%] justify-end">
                    <a href={`https://sepolia.etherscan.io/tx/${latestTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx}>
                      <span className="truncate font-mono">{latestTx}</span>
                      <ExternalLink size={12} className="flex-shrink-0" />
                    </a>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block:</span>
                  <span className="text-xs text-slate-300">{blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          if (key === "polygon_amoy") {
            const ok = amoy.data?.ok ?? false;
            const at = amoy.data?.at ?? "—";
            const chainId = amoy.data?.chainId ?? "80002";
            const latestTx = iqbAmoy.data?.txHash
              || ((dvnChainId === 80002 && dvnTxHash && dvnTxHash.startsWith('0x')) ? dvnTxHash : undefined)
              || amoy.data?.latestTx
              || "—";
            const blockNumber = (typeof iqbAmoy.data?.blockNumber === 'number')
              ? iqbAmoy.data.blockNumber.toLocaleString()
              : (amoy.data?.blockNumber ?? "—");
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={() => { amoy.refresh(); iqbAmoy.refresh(); }} disabled={amoy.loading || iqbAmoy.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="text-xs text-slate-300">{chainId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Latest TX:</span>
                  <span className="flex items-center gap-1 max-w-[60%] justify-end">
                    <a href={`https://amoy.polygonscan.com/tx/${latestTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx}>
                      <span className="truncate font-mono">{latestTx}</span>
                      <ExternalLink size={12} className="flex-shrink-0" />
                    </a>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block:</span>
                  <span className="text-xs text-slate-300">{blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // Optimism Sepolia card
          if (key === "optimism_sepolia") {
            const ok = optimismSepolia.data?.ok ?? false;
            const at = optimismSepolia.data?.at ?? "—";
            const latestTx = iqbOptimism.data?.txHash || optimismSepolia.data?.latestTx || "—";
            const blockNumber = (typeof iqbOptimism.data?.blockNumber === 'number')
              ? iqbOptimism.data.blockNumber.toLocaleString()
              : (optimismSepolia.data?.blockNumber ?? "—");
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={() => { optimismSepolia.refresh(); iqbOptimism.refresh(); }} disabled={optimismSepolia.loading || iqbOptimism.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="text-xs text-slate-300">11155420</span>
                </div>
                {latestTx && latestTx !== "—" && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest TX:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={`https://sepolia-optimism.etherscan.io/tx/${latestTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx}>
                        <span className="truncate font-mono">{latestTx}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block:</span>
                  <span className="text-xs text-slate-300">{blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // Arbitrum Sepolia card
          if (key === "arbitrum_sepolia") {
            const ok = arbitrumSepolia.data?.ok ?? false;
            const at = arbitrumSepolia.data?.at ?? "—";
            const latestTx = iqbArbitrum.data?.txHash || arbitrumSepolia.data?.latestTx || "—";
            const blockNumber = (typeof iqbArbitrum.data?.blockNumber === 'number')
              ? iqbArbitrum.data.blockNumber.toLocaleString()
              : (arbitrumSepolia.data?.blockNumber ?? "—");
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={() => { arbitrumSepolia.refresh(); iqbArbitrum.refresh(); }} disabled={arbitrumSepolia.loading || iqbArbitrum.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="text-xs text-slate-300">421614</span>
                </div>
                {latestTx && latestTx !== "—" && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest TX:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={`https://sepolia.arbiscan.io/tx/${latestTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx}>
                        <span className="truncate font-mono">{latestTx}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block:</span>
                  <span className="text-xs text-slate-300">{blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // Base Sepolia card
          if (key === "base_sepolia") {
            const ok = baseSepolia.data?.ok ?? false;
            const at = baseSepolia.data?.at ?? "—";
            const latestTx = iqbBase.data?.txHash || baseSepolia.data?.latestTx || "—";
            const blockNumber = (typeof iqbBase.data?.blockNumber === 'number')
              ? iqbBase.data.blockNumber.toLocaleString()
              : (baseSepolia.data?.blockNumber ?? "—");
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={() => { baseSepolia.refresh(); iqbBase.refresh(); }} disabled={baseSepolia.loading || iqbBase.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chain ID:</span>
                  <span className="text-xs text-slate-300">84532</span>
                </div>
                {latestTx && latestTx !== "—" && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest TX:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={`https://sepolia.basescan.org/tx/${latestTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx}>
                        <span className="truncate font-mono">{latestTx}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block:</span>
                  <span className="text-xs text-slate-300">{blockNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // BTC Anchor Status card
          if (key === "btc_anchor") {
            const ok = btc.anchor?.ok ?? false;
            const at = btc.anchor?.at ?? "—";
            const lastAnchorId = btc.anchor?.lastAnchorId ?? '—';
            const pending = btc.anchor?.pending ?? 0;
            const txid = btc.anchor?.txid;
            const confirmations = btc.anchor?.confirmations;
            const blockHeight = btc.anchor?.blockHeight;
            const anchorStatus = btc.anchor?.status;
            const details = btc.anchor?.details ?? '';
            const latestTx = btc.latestTx;
            const explorer = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET?.replace(/\/$/, '') || 'https://mempool.space/testnet/api';
            const displayTx = txid || (lastAnchorId !== '—' ? String(lastAnchorId) : undefined);
            const txUrl = displayTx ? `${explorer.replace('/api','')}/tx/${displayTx}` : undefined;
            const latestTxUrl = latestTx?.txid ? `${explorer.replace('/api','')}/tx/${latestTx.txid}` : undefined;
            async function doAnchor() {
              try {
                const response = await fetch('/api/ops/btc/anchor', { method: 'POST' });
                const result = await response.json();
                
                if (!response.ok) {
                  // Show detailed error message to user
                  if (result.availableMethods) {
                    alert(`Anchor functionality not yet implemented.\n\nAvailable methods: ${result.availableMethods.join(', ')}\n\nThe proof_of_state canister may need redeployment with full anchor functionality.`);
                  } else {
                    alert(`Failed to create anchor: ${result.error || 'Unknown error'}`);
                  }
                  return;
                }
                
                // Success - refresh the data
                alert('Anchor created successfully!');
                await btc.refresh();
              } catch (e: any) {
                alert(`Network error: ${e.message || 'Failed to connect to anchor API'}`);
              }
            }
            async function doBatchNow() {
              try {
                const response = await fetch('/api/ops/btc/batch-now', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) {
                  alert(`Batch failed: ${result.error || 'Unknown error'}`);
                  return;
                }
                alert(`Batch created: ${result.batchRoot}`);
                await btc.refresh();
              } catch (e: any) {
                alert(`Network error: ${e.message || 'Failed to connect to batch API'}`);
              }
            }
            async function doFastAnchor() {
              try {
                const response = await fetch('/api/ops/btc/fast-anchor', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) {
                  alert(`Fast anchor failed: ${result.error || 'Unknown error'}`);
                  return;
                }
                alert('Fast anchor executed successfully!');
                await btc.refresh();
              } catch (e: any) {
                alert(`Network error: ${e.message || 'Failed to connect to fast-anchor API'}`);
              }
            }
            return (
              <Card key={key} title={title} actions={<IconRefresh onClick={btc.refresh} disabled={btc.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                {anchorStatus === 'pending' && (
                  <div className="mt-1 text-xs rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-200 px-2 py-1">
                    Anchor transaction pending confirmations
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Anchor:</span>
                  <span className="flex items-center gap-1 max-w-[60%] justify-end">
                    {lastAnchorId !== '—' ? (
                      <a href={`https://mempool.space/testnet/tx/${lastAnchorId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={String(lastAnchorId)}>
                        <span className="truncate">{String(lastAnchorId)}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300 truncate" title={String(lastAnchorId)}>{String(lastAnchorId)}</span>
                    )}
                    {lastAnchorId !== '—' && (
                      <button
                        aria-label="Copy Last Anchor"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => navigator.clipboard.writeText(String(lastAnchorId))}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </span>
                </div>
                {displayTx && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">TX Hash:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={txUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={displayTx}>
                        <span className="truncate">{displayTx.slice(0, 8)}...</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                      <button
                        aria-label="Copy TX Hash"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => navigator.clipboard.writeText(String(displayTx))}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    </span>
                  </div>
                )}
                {displayTx && typeof confirmations !== 'undefined' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Confirmations:</span>
                    <span className="text-xs text-slate-300">{confirmations}</span>
                  </div>
                )}
                {displayTx && typeof blockHeight !== 'undefined' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Block Height:</span>
                    <span className="text-xs text-slate-300">{blockHeight}</span>
                  </div>
                )}
                {displayTx && anchorStatus && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={`text-xs ${anchorStatus === 'confirmed' ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {anchorStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </span>
                  </div>
                )}
                {latestTx && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest Tx:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={latestTxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx.txid}>
                        <span className="truncate font-mono">{latestTx.txid.slice(0, 8)}...</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                      <button
                        aria-label="Copy Latest TX"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => navigator.clipboard.writeText(latestTx.txid)}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pending:</span>
                  <span className="text-xs text-slate-300">{pending}</span>
                </div>
                {pending >= 10 && (
                  <div className="mt-1 text-xs rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-200 px-2 py-1">
                    Auto-batching threshold reached (10). A batch will be created automatically.
                  </div>
                )}
                {details && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Details:</span>
                    <span className="text-xs text-slate-300" title={details}>
                      {details.length > 20 ? `${details.slice(0, 20)}...` : details}
                    </span>
                  </div>
                )}
                {details === 'no batches' && (
                  <div className="mt-1 text-xs rounded-md bg-blue-500/10 ring-1 ring-blue-500/30 text-blue-200 px-2 py-1">
                    No anchor batches created yet. Click "Anchor" to create one.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
                
                {/* Divider and Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-700/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={doBatchNow}
                      className="px-3 py-2 rounded-md bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/30 text-xs hover:bg-blue-500/20"
                      title="Batch all pending receipts"
                    >
                      Batch Now
                    </button>
                    <button
                      onClick={doAnchor}
                      className="px-3 py-2 rounded-md bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 text-xs hover:bg-amber-500/20"
                      title="Create Anchor"
                    >
                      Anchor
                    </button>
                    <button
                      onClick={doFastAnchor}
                      className="px-3 py-2 rounded-md bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/30 text-xs hover:bg-pink-500/20"
                      title="Batch pending (if any) and anchor immediately"
                    >
                      Fast Track
                    </button>
                  </div>
                </div>
              </Card>
            );
          }

          // Cross-Chain Status card
          if (key === "cross_chain") {
            const ok = xchain.data?.ok ?? false;
            const at = xchain.data?.at ?? "—";
            const supportedChains = (xchain.data as any)?.supportedChains ?? 0;
            const evmChains = (xchain.data as any)?.evmChains ?? 0;
            const nonEvmChains = (xchain.data as any)?.nonEvmChains ?? 0;
            return (
              <Card key={key} title={title} actions={<IconRefresh onClick={xchain.refresh} disabled={xchain.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Chains:</span>
                  <span className="text-xs text-slate-300 font-semibold">{supportedChains}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">EVM Chains:</span>
                  <span className="text-xs text-slate-300">{evmChains}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Non-EVM:</span>
                  <span className="text-xs text-slate-300">{nonEvmChains} (BTC, Solana)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // QCT Cross-Chain Trading card
          if (key === "qct_trading") {
            return <QCTTradingCard key={key} title={title} />;
          }

          // QCT Rekey (Stage 1A) card
          if (key === "qct_rekey") {
            return <QCTRekeyCard key={key} title={title} />;
          }

          // Canister Sync Status card
          if (key === "sync_status") {
            const ok = syncStatus.data?.ok ?? false;
            const at = syncStatus.data?.at ?? "—";
            const status = syncStatus.data?.syncStatus ?? "unknown";
            const severity = syncStatus.data?.severity ?? "critical";
            const drift = syncStatus.data?.drift ?? 0;
            const isLegitimate = syncStatus.data?.isLegitimate ?? false;
            const posCount = syncStatus.data?.canisters?.proofOfState?.pendingCount ?? 0;
            const dvnCount = syncStatus.data?.canisters?.dvn?.pendingCount ?? 0;
            
            const getSeverityColor = (sev: string) => {
              switch (sev) {
                case 'info': return 'text-emerald-400';
                case 'warning': return 'text-amber-400';
                case 'critical': return 'text-red-400';
                default: return 'text-slate-400';
              }
            };

            const getSeverityIcon = (sev: string) => {
              switch (sev) {
                case 'info': return '●';
                case 'warning': return '⚠';
                case 'critical': return '⚠';
                default: return '?';
              }
            };

            async function handleRepair() {
              try {
                await syncStatus.repair('auto');
              } catch (e: any) {
                alert(`Sync repair failed: ${e.message}`);
              }
            }

            async function handleLayerZeroProcess() {
              try {
                const result = await syncStatus.processLayerZero('process_pending');
                alert(`LayerZero processing completed: ${result.message}\nProcessed: ${result.processed}/${result.total} messages`);
                
                // Firefox-compatible async refresh with proper error handling
                const refreshWithDelay = async (refreshFn: (() => Promise<void>) | undefined, delay: number = 0) => {
                  if (!refreshFn) return;
                  try {
                    if (delay > 0) {
                      await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    await refreshFn();
                  } catch (error) {
                    console.warn('Refresh failed:', error);
                  }
                };

                // Immediate refresh
                await Promise.allSettled([
                  refreshWithDelay(dvn.refresh),
                  refreshWithDelay(syncStatus.refresh)
                ]);

                // Delayed refresh for eventual consistency (Firefox-compatible)
                await Promise.allSettled([
                  refreshWithDelay(dvn.refresh, 1200),
                  refreshWithDelay(syncStatus.refresh, 1200)
                ]);
              } catch (e: any) {
                alert(`LayerZero processing failed: ${e.message}`);
              }
            }

            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>System</span>
                </span>
              } actions={<IconRefresh onClick={syncStatus.refresh} disabled={syncStatus.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={getSeverityColor(severity)}>
                    {getSeverityIcon(severity)} {status.replace('-', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Drift:</span>
                  <span className={drift === 0 ? "text-emerald-400" : "text-amber-400"}>
                    {drift} items {isLegitimate && drift > 0 ? "(legitimate)" : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">PoS Pending:</span>
                  <span className="text-xs text-slate-300">{posCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">DVN Pending:</span>
                  <span className="text-xs text-slate-300">{dvnCount}</span>
                </div>
                {drift > 0 && !isLegitimate && (
                  <div className="pt-2">
                    <button
                      onClick={handleRepair}
                      className="w-full px-3 py-1.5 text-xs bg-amber-500/10 text-amber-300 rounded-md hover:bg-amber-500/20 border border-amber-500/30"
                      disabled={syncStatus.loading}
                    >
                      Auto Repair
                    </button>
                  </div>
                )}
                {drift > 0 && isLegitimate && dvnCount > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={handleLayerZeroProcess}
                      className="w-full px-3 py-1.5 text-xs bg-blue-500/10 text-blue-300 rounded-md hover:bg-blue-500/20 border border-blue-500/30"
                      disabled={syncStatus.loading}
                    >
                      Process via LayerZero ({dvnCount})
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // ICP DVN card
          if (key === "icp_dvn") {
            const ok = dvn.data?.ok ?? false;
            const at = dvn.data?.at ?? "—";
            const evmTx = (dvn as any)?.data?.evmTx ?? "—";
            const icpReceipt = (dvn as any)?.data?.icpReceipt ?? "—";
            const lockStatus = (dvn as any)?.data?.lockStatus ?? "Unknown";
            const unlockHeight = (dvn as any)?.data?.unlockHeight ?? "—";
            const evmExplorer = dvnChainId === 80002 ? 'https://www.oklink.com/amoy/tx/' : 'https://sepolia.etherscan.io/tx/';

            return (
              <Card key={key} title={title} actions={<IconRefresh onClick={dvn.refresh} disabled={dvn.loading} />} className="relative z-10 overflow-visible">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">EVM TX:</span>
                  <span className="flex items-center gap-1 max-w-[60%] justify-end">
                    {evmTx !== '—' ? (
                      <a href={`${evmExplorer}${evmTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={evmTx}>
                        <span className="truncate font-mono">{evmTx.slice(0, 10)}...</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300">{evmTx}</span>
                    )}
                    {evmTx !== '—' && (
                      <button
                        aria-label="Copy EVM TX"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => navigator.clipboard.writeText(evmTx)}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ICP Receipt:</span>
                  <span className="flex items-center gap-1 max-w-[60%] justify-end">
                    <span className="text-xs text-slate-300 truncate font-mono" title={icpReceipt}>
                      {icpReceipt !== '—' ? `${icpReceipt.slice(0, 12)}...` : icpReceipt}
                    </span>
                    {icpReceipt !== '—' && (
                      <button
                        aria-label="Copy ICP Receipt"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => navigator.clipboard.writeText(icpReceipt)}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Lock Status:</span>
                  <span className="text-xs text-emerald-300">{lockStatus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Unlock Height:</span>
                  <span className="text-xs text-slate-300">{unlockHeight}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // DVN Mint Tests card
          if (key === "dvn_mint_tests") {
            const getExplorerUrl = (chainId: number) => {
              switch (chainId) {
                case 11155111: return 'https://sepolia.etherscan.io/tx/';
                case 80002: return 'https://www.oklink.com/amoy/tx/';
                case 11155420: return 'https://sepolia-optimism.etherscan.io/tx/';
                case 421614: return 'https://sepolia.arbiscan.io/tx/';
                case 84532: return 'https://sepolia.basescan.org/tx/';
                case 101: return 'https://explorer.solana.com/tx/';
                case 0: return 'https://blockstream.info/testnet/tx/';
                default: return 'https://sepolia.etherscan.io/tx/';
              }
            };
            const evmExplorer = getExplorerUrl(dvnChainId);

            async function onMonitor() {
              if (!dvnTxHash) return;
              try {
                const result = await dvnMon.monitor(dvnTxHash, dvnChainId);
                if (!result.ok) {
                  alert(`DVN monitoring failed: ${result.error || 'Unknown error'}`);
                  return false;
                }
                
                if (result.duplicate) {
                  console.log('Transaction already being monitored - no duplicate created');
                  // Don't show alert for duplicates, just log it
                } else if (result.fallback) {
                  console.log('DVN monitor success via fallback method:', result);
                } else {
                  console.log('DVN monitor success with blockchain verification:', result);
                }
                return true;
              } catch (e: any) {
                console.error('DVN monitor error:', e);
                alert(`DVN monitoring failed: ${e?.message || 'Network error'}`);
                return false;
              }
            }

            async function onSubmitAttestation() {
              const validator = (document.getElementById('dvn-validator-test') as HTMLInputElement)?.value;
              const signatureHex = (document.getElementById('dvn-sighex-test') as HTMLInputElement)?.value;
              if (!dvnMon.messageId || !validator || !signatureHex) return;
              await fetch('/api/ops/dvn/attest', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messageId: dvnMon.messageId, validator, signatureHex }),
              });
              await dvnMon.query(dvnMon.messageId);
            }

            async function onVerify() {
              if (!dvnMon.messageId) return;
              const response = await fetch('/api/ops/dvn/verify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ 
                  messageId: dvnMon.messageId, 
                  chainId: dvnChainId,
                  txHash: dvnTxHash // Pass txHash for cookie cleanup
                }),
              });
              
              if (response.ok) {
                console.log('LayerZero verification successful - transaction processed');
                // Refresh DVN status to show updated pending count
                await dvn.refresh?.();
              } else {
                console.warn('LayerZero verification failed');
              }
              
              await dvnMon.query(dvnMon.messageId);
            }

            async function createTestTx() {
              try {
                // Non-EVM chains can't create MetaMask transactions
                if (dvnChainId === 101 || dvnChainId === 0) {
                  alert('MetaMask transactions are only supported for EVM chains. Please use Solana/Bitcoin wallets for non-EVM chains.');
                  return;
                }

                const ethAll: any = (window as any).ethereum;
                const eth: any = ethAll?.providers?.find((p: any) => p && p.isMetaMask) ?? ethAll;
                if (!eth) throw new Error('No injected wallet found');
                
                // Get chain config with multiple RPC fallbacks
                const getChainConfig = (chainId: number) => {
                  switch (chainId) {
                    case 11155111: return { hex: '0xaa36a7', name: 'Ethereum Sepolia', symbol: 'ETH', rpc: 'https://rpc.sepolia.org', explorer: 'https://sepolia.etherscan.io' };
                    case 80002: return { 
                      hex: '0x13882', 
                      name: 'Polygon Amoy', 
                      symbol: 'MATIC', 
                      rpc: 'https://rpc-amoy.polygon.technology', // Official Polygon RPC
                      explorer: 'https://www.oklink.com/amoy' 
                    };
                    case 11155420: return { hex: '0xaa37dc', name: 'Optimism Sepolia', symbol: 'ETH', rpc: 'https://sepolia.optimism.io', explorer: 'https://sepolia-optimism.etherscan.io' };
                    case 421614: return { hex: '0x66eee', name: 'Arbitrum Sepolia', symbol: 'ETH', rpc: 'https://sepolia-rollup.arbitrum.io/rpc', explorer: 'https://sepolia.arbiscan.io' };
                    case 84532: return { hex: '0x14a34', name: 'Base Sepolia', symbol: 'ETH', rpc: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org' };
                    default: return { hex: '0xaa36a7', name: 'Ethereum Sepolia', symbol: 'ETH', rpc: 'https://rpc.sepolia.org', explorer: 'https://sepolia.etherscan.io' };
                  }
                };
                
                const chainConfig = getChainConfig(dvnChainId);
                
                try {
                  await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainConfig.hex }] });
                } catch (e: any) {
                  // Try to add then switch
                  try {
                    await eth.request({ 
                      method: 'wallet_addEthereumChain', 
                      params: [{ 
                        chainId: chainConfig.hex, 
                        chainName: chainConfig.name, 
                        nativeCurrency: { name: chainConfig.symbol, symbol: chainConfig.symbol, decimals: 18 }, 
                        rpcUrls: [chainConfig.rpc], 
                        blockExplorerUrls: [chainConfig.explorer] 
                      }] 
                    });
                    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainConfig.hex }] });
                  } catch (e2) {
                    throw e2;
                  }
                }
                const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
                const from = accounts[0];
                // Send a 0-value self-transfer to produce a tx hash
                const txHash: string = await eth.request({ method: 'eth_sendTransaction', params: [{ from, to: from, value: '0x0' }] });
                console.log('MetaMask transaction created:', txHash);
                setDvnTxHash(txHash);
                
                // Create PoS receipt for this transaction (simulating real mint flow)
                try {
                  const posResponse = await fetch('/api/ops/pos/issue-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      dataHash: `test_tx_${dvnChainId}_${txHash}_${Date.now()}`,
                      source: 'test_transaction'
                    })
                  });
                  if (posResponse.ok) {
                    const posResult = await posResponse.json();
                    console.log('PoS receipt created:', posResult.receiptId);
                  } else {
                    console.warn('PoS receipt creation failed:', await posResponse.text());
                  }
                } catch (posErr) {
                  console.warn('PoS receipt creation error:', posErr);
                }
                
                // Automatically monitor the transaction
                const monitorSuccess = await onMonitor();
                if (monitorSuccess) {
                  console.log('End-to-end DVN + PoS flow completed successfully');
                } else {
                  console.warn('MetaMask transaction created but DVN monitoring failed');
                }
              } catch (e: any) {
                console.error('createTestTx error:', e);
                alert(e?.message || 'Failed to create test transaction. Ensure MetaMask is installed and unlocked.');
              }
            }

            return (
              <Card key={key} title={title} actions={
                <button
                  onClick={async () => { try { await dvn.refresh?.(); if (dvnMon.messageId) { await dvnMon.query(dvnMon.messageId); } } catch {} }}
                  className="inline-flex items-center justify-center h-8 px-2 rounded-md text-slate-300 hover:text-white hover:bg-white/10 text-xs"
                  title="Re-check DVN and refresh message details"
                >
                  Re-check DVN
                </button>
              } className="relative z-10 overflow-visible">
                <div className="space-y-4">
                  <div className="text-xs text-slate-400">Monitor TX via DVN</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={dvnChainId}
                        onChange={(e) => setDvnChainId(Number(e.target.value))}
                        className="h-8 w-40 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2"
                        title="Chain ID"
                      >
                        <optgroup label="EVM">
                          <option value={11155111}>ETH Sepolia (11155111)</option>
                          <option value={80002}>POL Amoy (80002)</option>
                          <option value={11155420}>OP Sepolia (11155420)</option>
                          <option value={421614}>ARB Sepolia (421614)</option>
                          <option value={84532}>BASE Sepolia (84532)</option>
                        </optgroup>
                        <optgroup label="Non-EVM">
                          <option value={101}>SOL Devnet (101)</option>
                          <option value={0}>BTC Testnet (0)</option>
                        </optgroup>
                      </select>
                      <button
                        onClick={async () => { if (testTxBusy) return; setTestTxBusy(true); try { await createTestTx(); } finally { setTestTxBusy(false); } }}
                        disabled={testTxBusy}
                        className="px-2 h-8 rounded-md bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/30 text-xs hover:bg-fuchsia-500/20 disabled:opacity-50"
                        title="Use MetaMask to create a 0-value test transaction and auto-monitor it"
                      >
                        {testTxBusy ? 'Working…' : 'Test TX'}
                      </button>
                      <button
                        onClick={onMonitor}
                        disabled={!dvnTxHash || dvnMon.loading}
                        className="px-2 h-8 rounded-md bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/30 text-xs hover:bg-indigo-500/20 disabled:opacity-50"
                      >
                        Monitor
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="0x... tx hash"
                        className="flex-1 h-8 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2 font-mono"
                        value={dvnTxHash}
                        onChange={(e) => setDvnTxHash(e.target.value.trim())}
                      />
                      <button
                        onClick={() => { try { const v = localStorage.getItem('amoy_last_tx'); if (v) setDvnTxHash(v); } catch {} }}
                        className="px-1.5 h-7 rounded bg-white/5 text-slate-300 ring-1 ring-white/10 text-[10px] hover:bg-white/10"
                        title="Use last minted tx"
                      >
                        Use last
                      </button>
                      <button
                        onClick={() => { setDvnTxHash(''); try { localStorage.removeItem('amoy_last_tx'); } catch {} }}
                        className="px-1.5 h-7 rounded bg-white/5 text-slate-300 ring-1 ring-white/10 text-[10px] hover:bg-white/10"
                        title="Clear"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  {dvnMon.error && (
                    <div className="text-xs text-amber-300">{dvnMon.error}</div>
                  )}
                  
                  {(dvnMon.messageId || dvnMon.message) && (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-400">Transaction Status</div>
                      <div className="space-y-1">
                        {dvnMon.messageId && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Message ID:</span>
                            <span className="flex items-center gap-1 max-w-[60%] justify-end">
                              <span className="text-xs text-slate-300 font-mono truncate" title={dvnMon.messageId}>
                                {dvnMon.messageId.slice(0, 12)}...
                              </span>
                              <button
                                aria-label="Copy Message ID"
                                className="text-slate-400 hover:text-white flex-shrink-0"
                                onClick={() => dvnMon.messageId && navigator.clipboard.writeText(dvnMon.messageId)}
                                title="Copy"
                              >
                                <Copy size={12} />
                              </button>
                            </span>
                          </div>
                        )}
                        {dvnMon.attestations?.length ? (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Attestations:</span>
                            <span className="text-xs text-slate-300">{dvnMon.attestations.length}</span>
                          </div>
                        ) : null}
                        {dvnMon.txHash && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">TX Hash:</span>
                            <span className="flex items-center gap-1 max-w-[60%] justify-end">
                              <a href={`${evmExplorer}${dvnMon.txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={dvnMon.txHash}>
                                <span className="truncate font-mono">{dvnMon.txHash.slice(0, 10)}...</span>
                                <ExternalLink size={12} className="flex-shrink-0" />
                              </a>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {dvnMon.messageId && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400">DVN Actions</div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="validator id"
                            className="w-20 h-7 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2"
                            id="dvn-validator-test"
                          />
                          <input
                            type="text"
                            placeholder="0x signature hex"
                            className="flex-1 h-7 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2 font-mono"
                            id="dvn-sighex-test"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={onSubmitAttestation}
                            className="px-2 h-7 rounded-md bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 text-xs hover:bg-emerald-500/20"
                          >
                            Submit
                          </button>
                          <button
                            onClick={onVerify}
                            className="px-2 h-7 rounded-md bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30 text-xs hover:bg-sky-500/20"
                          >
                            Verify LayerZero
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          }

          if (key === "solana_testnet") {
            const ok = solTest.data?.ok ?? false;
            const at = solTest.data?.at ?? "—";
            const rpcUrl = solTest.data?.rpcUrl ?? "api.testnet.solana.com";
            const blockHeight = solTest.data?.blockHeight ?? "—";
            const latestBlockhash = solTest.data?.latestBlockhash ?? null;
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={solTest.refresh} disabled={solTest.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">RPC:</span>
                  <span className="text-xs text-slate-300">{rpcUrl}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block Height:</span>
                  <span className="text-xs text-slate-300">{blockHeight}</span>
                </div>
                {latestBlockhash && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest Blockhash:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <span className="truncate font-mono" title={latestBlockhash}>{latestBlockhash}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          // For any remaining placeholders
          return (
            <Card key={key} title={title} actions={<IconRefresh />}>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400">●</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Last Check:</span>
                <span className="text-xs text-slate-500">—</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Diagnostic Tools Section */}
      <div className="mt-8">
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-100">System Diagnostics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Manual Canister Calls */}
            <div className="bg-black/30 p-4 rounded-xl">
              <h4 className="font-medium mb-3 text-slate-200">Manual Canister Calls</h4>
              <div className="space-y-2">
                <button 
                  onClick={() => window.open('/test', '_blank')}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  🧪 Open Testing Dashboard
                </button>
                <button 
                  onClick={() => icp.refresh()}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  🔄 Force Canister Health Check
                </button>
                <button 
                  onClick={() => btc.refresh()}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  ⚓ Force BTC Anchor Refresh
                </button>
              </div>
            </div>

            {/* Network Diagnostics */}
            <div className="bg-black/30 p-4 rounded-xl">
              <h4 className="font-medium mb-3 text-slate-200">Network Diagnostics</h4>
              <div className="space-y-2">
                <button 
                  onClick={() => sepolia.refresh()}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  🔗 Test Ethereum Sepolia RPC
                </button>
                <button 
                  onClick={() => amoy.refresh()}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  🔗 Test Polygon Amoy RPC
                </button>
                <button 
                  onClick={() => dvn.refresh()}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  🔗 Test DVN Canister
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-black/30 p-4 rounded-xl">
              <h4 className="font-medium mb-3 text-slate-200">Quick Actions</h4>
              <div className="space-y-2">
                <button 
                  onClick={() => window.open('/iqube/mint', '_blank')}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  🪙 Open Minting Interface
                </button>
                <button 
                  onClick={() => window.open('/registry', '_blank')}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  📋 Open Registry
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                >
                  🔄 Reload Ops Console
                </button>
              </div>
            </div>
          </div>
          {/* System Status Summary */}
          <div className="bg-black/30 p-4 rounded-xl">
            <h4 className="font-medium mb-3 text-slate-200">System Status Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${icp.data?.ok ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <p className="text-slate-300">ICP Canisters</p>
                <p className="text-xs text-slate-500">{((icp.data as any)?.canisters?.items?.length) ?? 0} services</p>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${btc.data?.ok ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <p className="text-slate-300">BTC Network</p>
                <p className="text-xs text-slate-500">{btc.anchor?.pending || 0} pending</p>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${sepolia.data?.ok ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <p className="text-slate-300">Ethereum</p>
                <p className="text-xs text-slate-500">Block {sepolia.data?.blockNumber || '—'}</p>
              </div>
              <div className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${amoy.data?.ok ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <p className="text-slate-300">Polygon</p>
                <p className="text-xs text-slate-500">Block {amoy.data?.blockNumber || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
          <h3 className="text-lg font-semibold mb-3 text-slate-100">Notes</h3>
          <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
            <li>These cards are wired to services/hooks and will surface health, balances, and statuses.</li>
            <li>Solana Testnet appears only when <code>NEXT_PUBLIC_FEATURE_SOLANA_OPS=true</code>.</li>
            <li>BTC has a special relationship as the protocol anchor; other chains are treated as spokes.</li>
            <li>Use the diagnostic tools above for manual testing and system debugging.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
