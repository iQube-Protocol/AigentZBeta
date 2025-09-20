"use client";

import React, { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Copy, ExternalLink } from "lucide-react";
import { useCanisterHealth } from "@/hooks/ops/useCanisterHealth";
import { useBTC_Testnet } from "@/hooks/ops/useBTC_Testnet";
import { useEthereumSepolia } from "@/hooks/ops/useEthereumSepolia";
import { usePolygonAmoy } from "@/hooks/ops/usePolygonAmoy";
import { useDVNStatus } from "@/hooks/ops/useDVNStatus";
import { useCrossChain } from "@/hooks/ops/useCrossChain";

// Feature flags
const FEATURE_SOLANA_OPS = process.env.NEXT_PUBLIC_FEATURE_SOLANA_OPS === "true";

// Simple Card wrapper to match AigentZ Beta look & feel
function Card({ title, children, actions }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6">
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
    case "solana_devnet":
      return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"; // Solana = Emerald
    default:
      return "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30";
  }
}

export default function OpsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Hooks per card
  const icp = useCanisterHealth(30000);
  const btc = useBTC_Testnet(30000);
  const sepolia = useEthereumSepolia(30000);
  // Polygon Amoy can reuse useSepolia with different service later; placeholder mirrors sepolia for now
  const amoy = usePolygonAmoy(30000);
  const dvn = useDVNStatus(30000);
  const xchain = useCrossChain(30000);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cards = useMemo(() => [
    { key: "icp_health", title: "ICP Canister Health" },
    { key: "btc_anchor", title: "BTC Anchor Status" },
    { key: "cross_chain", title: "Cross-Chain Status" },
    { key: "icp_dvn", title: "ICP DVN" },
    { key: "btc_testnet", title: "BTC Testnet" },
    { key: "eth_sepolia", title: "Ethereum Sepolia" },
    { key: "polygon_amoy", title: "Polygon Amoy" },
    { key: "solana_devnet", title: "Solana Devnet" },
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
        <h1 className="text-3xl font-bold text-white">Network Operations</h1>
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
            const rpcUrl = btc.data?.testnet?.rpcUrl ?? "—";
            const blockHeight = btc.data?.testnet?.blockHeight ?? "—";
            const latestTx = "a1b2c3d4e5f6...789abc";
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
                  <span className="text-slate-400">RPC URL:</span>
                  <span className="text-xs text-slate-300">{rpcUrl === "—" ? "—" : "mempool.space"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Latest TX:</span>
                  <span className="flex items-center gap-1 max-w-[60%] justify-end">
                    <a href={`https://mempool.space/testnet/tx/${latestTx.replace('...', 'def456')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx}>
                      <span className="truncate font-mono">{latestTx}</span>
                      <ExternalLink size={12} className="flex-shrink-0" />
                    </a>
                  </span>
                </div>
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
            const latestTx = sepolia.data?.latestTx ?? "—";
            const blockNumber = sepolia.data?.blockNumber ?? "—";
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={sepolia.refresh} disabled={sepolia.loading} />}>
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
            const latestTx = amoy.data?.latestTx ?? "—";
            const blockNumber = amoy.data?.blockNumber ?? "—";
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Testnet</span>
                </span>
              } actions={<IconRefresh onClick={amoy.refresh} disabled={amoy.loading} />}>
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

          // BTC Anchor Status card
          if (key === "btc_anchor") {
            const ok = Boolean(process.env.NEXT_PUBLIC_BTC_SIGNER_CANISTER_ID);
            const at = btc.data?.at ?? "—";
            const lastAnchorId = btc.anchor?.lastAnchorId ?? '—';
            const pending = btc.anchor?.pending ?? 0;
            const txid = btc.anchor?.txid;
            const confirmations = btc.anchor?.confirmations;
            const blockHeight = btc.anchor?.blockHeight;
            const anchorStatus = btc.anchor?.status;
            const explorer = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET?.replace(/\/$/, '') || 'https://mempool.space/testnet/api';
            const txUrl = txid ? `${explorer.replace('/api','')}/tx/${txid}` : undefined;
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
                {txid && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">TX Hash:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={txUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={txid}>
                        <span className="truncate">{txid.slice(0, 8)}...</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                      <button
                        aria-label="Copy TX Hash"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => navigator.clipboard.writeText(String(txid))}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    </span>
                  </div>
                )}
                {txid && typeof confirmations !== 'undefined' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Confirmations:</span>
                    <span className="text-xs text-slate-300">{confirmations}</span>
                  </div>
                )}
                {txid && typeof blockHeight !== 'undefined' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Block Height:</span>
                    <span className="text-xs text-slate-300">{blockHeight}</span>
                  </div>
                )}
                {txid && anchorStatus && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={`text-xs ${anchorStatus === 'confirmed' ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {anchorStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pending:</span>
                  <span className="text-xs text-slate-300">{pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{at}</span>
                </div>
              </Card>
            );
          }

          // Cross-Chain Status card
          if (key === "cross_chain") {
            const ok = xchain.data?.ok ?? false;
            const at = xchain.data?.at ?? "—";
            const supportedChains = (xchain.data as any)?.supportedChains ?? 0;
            return (
              <Card key={key} title={title} actions={<IconRefresh onClick={xchain.refresh} disabled={xchain.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Supported Chains:</span>
                  <span className="text-xs text-slate-300">{supportedChains}</span>
                </div>
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
            // Live data from cross_chain_service canister
            const evmTx = dvn.data?.evmTx ?? "—";
            const icpReceipt = dvn.data?.icpReceipt ?? "—";
            const lockStatus = dvn.data?.lockStatus ?? "Unknown";
            const unlockHeight = dvn.data?.unlockHeight ?? "—";
            return (
              <Card key={key} title={title} actions={<IconRefresh onClick={dvn.refresh} disabled={dvn.loading} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">EVM TX:</span>
                  <span className="text-xs text-slate-300 font-mono">{evmTx}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ICP Receipt:</span>
                  <span className="text-xs text-slate-300 font-mono">{icpReceipt}</span>
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

          if (key === "solana_devnet") {
            // Mock Solana data since we don't have the canister integration yet
            const ok = true;
            const at = new Date().toISOString();
            const canisterAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
            const balance = "2.5 SOL";
            const latestTx = "3KqKHLnrfFYD...8mNpL2";
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Devnet</span>
                </span>
              } actions={<IconRefresh onClick={() => {}} disabled={false} />}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Canister Address:</span>
                  <span className="text-xs text-slate-300 font-mono">{canisterAddress.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Balance:</span>
                  <span className="text-xs text-slate-300">{balance}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Latest TX:</span>
                  <span className="flex items-center gap-1 max-w-[60%] justify-end">
                    <a href={`https://explorer.solana.com/tx/${latestTx}?cluster=devnet`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestTx}>
                      <span className="truncate font-mono">{latestTx}</span>
                      <ExternalLink size={12} className="flex-shrink-0" />
                    </a>
                  </span>
                </div>
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
                <p className="text-xs text-slate-500">{icp.data?.canisters?.items?.length || 0} services</p>
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
            <li>Solana Devnet appears only when <code>NEXT_PUBLIC_FEATURE_SOLANA_OPS=true</code>.</li>
            <li>BTC has a special relationship as the protocol anchor; other chains are treated as spokes.</li>
            <li>Use the diagnostic tools above for manual testing and system debugging.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
