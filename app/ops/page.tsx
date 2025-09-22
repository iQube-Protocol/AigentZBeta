"use client";

import React, { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Copy, ExternalLink } from "lucide-react";
import { useCanisterHealth } from "@/hooks/ops/useCanisterHealth";
import { useBTC_Testnet } from "@/hooks/ops/useBTC_Testnet";
import { useEthereumSepolia } from "@/hooks/ops/useEthereumSepolia";
import { usePolygonAmoy } from "@/hooks/ops/usePolygonAmoy";
import { useDVNStatus } from "@/hooks/ops/useDVNStatus";
import { useDVNMonitor } from "@/hooks/ops/useDVNMonitor";
import { useSolanaDevnet } from "@/hooks/ops/useSolanaDevnet";
import { useCrossChain } from "@/hooks/ops/useCrossChain";

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
  const sol = useSolanaDevnet(30000);
  const dvnMon = useDVNMonitor();
  const [dvnTxHash, setDvnTxHash] = useState("");
  const [dvnChainId, setDvnChainId] = useState<number>(11155111); // default Sepolia

  useEffect(() => {
    setMounted(true);
  }, []);

  // Persist DVN/Amoy tx hash across refreshes without modifying createTestTx
  useEffect(() => {
    try {
      const saved = localStorage.getItem('amoy_last_tx');
      if (saved && typeof saved === 'string' && saved.startsWith('0x')) {
        setDvnTxHash(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (dvnTxHash && dvnTxHash.startsWith('0x')) {
        localStorage.setItem('amoy_last_tx', dvnTxHash);
      }
    } catch {}
  }, [dvnTxHash]);

  const cards = useMemo(() => [
    { key: "icp_health", title: "ICP Canister Health" },
    { key: "btc_anchor", title: "BTC Anchor Status" },
    { key: "cross_chain", title: "Cross-Chain Status" },
    { key: "icp_dvn", title: "ICP DVN" },
    { key: "btc_testnet", title: "BTC Testnet" },
    { key: "eth_sepolia", title: "Ethereum Sepolia" },
    { key: "polygon_amoy", title: "Polygon Amoy" },
    ...(FEATURE_SOLANA_OPS ? [{ key: "solana_devnet", title: "Solana Devnet" } as const] : []),
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
            const rpcApi = process.env.NEXT_PUBLIC_RPC_BTC_TESTNET || '';
            const rpcHost = rpcApi ? rpcApi.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '') : '—';
            const blockHeight = typeof btc.anchor?.blockHeight === 'number' ? btc.anchor?.blockHeight : '—';
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
            // Prefer the locally persisted tx hash created via the button, fallback to API placeholder
            const latestTx = (dvnTxHash && dvnTxHash.startsWith('0x')) ? dvnTxHash : (amoy.data?.latestTx ?? "—");
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
            const displayTx = txid || (lastAnchorId !== '—' ? String(lastAnchorId) : undefined);
            const txUrl = displayTx ? `${explorer.replace('/api','')}/tx/${displayTx}` : undefined;
            async function doAnchor() {
              try {
                await fetch('/api/ops/btc/anchor', { method: 'POST' });
                await btc.refresh();
              } catch {}
            }
            return (
              <Card key={key} title={title} actions={
                <div className="flex items-center gap-2">
                  <IconRefresh onClick={btc.refresh} disabled={btc.loading} />
                  <button
                    onClick={doAnchor}
                    className="px-2 h-8 rounded-md bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 text-xs hover:bg-amber-500/20"
                    title="Create Anchor"
                  >
                    Anchor
                  </button>
                </div>
              }>
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
            const evmTx = (dvn as any)?.data?.evmTx ?? "—";
            const icpReceipt = (dvn as any)?.data?.icpReceipt ?? "—";
            const lockStatus = (dvn as any)?.data?.lockStatus ?? "Unknown";
            const unlockHeight = (dvn as any)?.data?.unlockHeight ?? "—";
            const evmExplorer = dvnChainId === 80002 ? 'https://www.oklink.com/amoy/tx/' : 'https://sepolia.etherscan.io/tx/';

            async function onMonitor() {
              if (!dvnTxHash) return;
              await dvnMon.monitor(dvnTxHash, dvnChainId);
            }

            async function onSubmitAttestation() {
              if (!dvnMon.messageId) return;
              const validator = (document.getElementById('dvn-validator') as HTMLInputElement)?.value?.trim();
              const signatureHex = (document.getElementById('dvn-sighex') as HTMLInputElement)?.value?.trim();
              if (!validator || !signatureHex) return;
              await fetch('/api/ops/dvn/attest', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messageId: dvnMon.messageId, validator, signatureHex }),
              });
              await dvnMon.query(dvnMon.messageId);
            }

            async function onVerify() {
              if (!dvnMon.messageId) return;
              await fetch('/api/ops/dvn/verify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messageId: dvnMon.messageId, chainId: dvnChainId }),
              });
              await dvnMon.query(dvnMon.messageId);
            }

            async function createTestTx() {
              try {
                const eth: any = (window as any).ethereum;
                if (!eth) throw new Error('No injected wallet found');
                // Ensure correct chain
                const hexChain = dvnChainId === 80002 ? '0x13882' : '0xaa36a7'; // Amoy or Sepolia
                try {
                  await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain }] });
                } catch (e: any) {
                  // Try to add then switch
                  try {
                    if (dvnChainId === 80002) {
                      await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x13882', chainName: 'Polygon Amoy', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://rpc.ankr.com/polygon_amoy'], blockExplorerUrls: ['https://www.oklink.com/amoy'] }] });
                    } else {
                      await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0xaa36a7', chainName: 'Ethereum Sepolia', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.sepolia.org'], blockExplorerUrls: ['https://sepolia.etherscan.io'] }] });
                    }
                    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain }] });
                  } catch (e2) {
                    throw e2;
                  }
                }
                const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
                const from = accounts[0];
                // Send a 0-value self-transfer to produce a tx hash
                const txHash: string = await eth.request({ method: 'eth_sendTransaction', params: [{ from, to: from, value: '0x0' }] });
                setDvnTxHash(txHash);
                await onMonitor();
              } catch (e: any) {
                alert(e?.message || 'Failed to create test transaction. Ensure MetaMask is installed and unlocked.');
              }
            }

            return (
              <Card key={key} title={title} actions={<IconRefresh onClick={dvn.refresh} disabled={dvn.loading} />} className="relative z-10 overflow-visible">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">EVM TX:</span>
                  <span className="text-xs text-slate-300">{evmTx}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ICP Receipt:</span>
                  <span className="text-xs text-slate-300">{icpReceipt}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Lock Status:</span>
                  <span className="text-xs text-emerald-300">{lockStatus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Unlock Height:</span>
                  <span className="text-xs text-slate-300">{unlockHeight}</span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/60">
                  <div className="mb-2 text-xs text-slate-400">Monitor EVM TX via DVN</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      className="h-8 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2"
                      value={dvnChainId}
                      onChange={(e) => setDvnChainId(Number(e.target.value))}
                      title="Chain ID"
                    >
                      <option value={11155111}>Sepolia (11155111)</option>
                      <option value={80002}>Amoy (80002)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="0x... EVM tx hash"
                      className="flex-1 h-8 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2 font-mono"
                      value={dvnTxHash}
                      onChange={(e) => setDvnTxHash(e.target.value.trim())}
                    />
                    <button
                      onClick={onMonitor}
                      disabled={!dvnTxHash || dvnMon.loading}
                      className="px-2 h-8 rounded-md bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/30 text-xs hover:bg-indigo-500/20 disabled:opacity-50"
                    >
                      Monitor
                    </button>
                    <button
                      onClick={createTestTx}
                      className="px-2 h-8 rounded-md bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/30 text-xs hover:bg-fuchsia-500/20"
                      title="Use MetaMask to create a 0-value test transaction and auto-monitor it"
                    >
                      Create Test TX (MetaMask)
                    </button>
                  </div>
                  {dvnMon.error && (
                    <div className="mt-2 text-xs text-amber-300">{dvnMon.error}</div>
                  )}
                  {(dvnMon.messageId || dvnMon.message) && (
                    <div className="mt-3 space-y-1">
                      {dvnMon.messageId && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Message ID:</span>
                          <span className="text-xs text-slate-300 font-mono">{dvnMon.messageId}</span>
                        </div>
                      )}
                      {dvnMon.message?.id && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Tracked ID:</span>
                          <span className="text-xs text-slate-300 font-mono">{dvnMon.message.id}</span>
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
                  )}

                  {dvnMon.messageId && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs text-slate-400">Submit Attestation</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="validator id"
                          className="h-8 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2"
                          id="dvn-validator"
                        />
                        <input
                          type="text"
                          placeholder="0x signature hex"
                          className="flex-1 h-8 rounded-md bg-slate-800/70 border border-slate-700 text-slate-200 text-xs px-2 font-mono"
                          id="dvn-sighex"
                        />
                        <button
                          onClick={onSubmitAttestation}
                          className="px-2 h-8 rounded-md bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 text-xs hover:bg-emerald-500/20"
                        >
                          Submit
                        </button>
                      </div>

                      <div className="text-xs text-slate-400 mt-3">Verify LayerZero Message</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={onVerify}
                          className="px-2 h-8 rounded-md bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30 text-xs hover:bg-sky-500/20"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Check:</span>
                  <span className="text-xs text-slate-500">{timeSince(at)}</span>
                </div>
              </Card>
            );
          }

          if (key === "solana_devnet") {
            const ok = sol.data?.ok ?? false;
            const at = sol.data?.at ?? "—";
            const endpoint = sol.data?.endpoint ?? "https://api.devnet.solana.com";
            const slot = sol.data?.slot ?? "—";
            const blockHeight = sol.data?.blockHeight ?? "—";
            const address = sol.data?.address ?? null;
            const balanceLamports = sol.data?.balanceLamports ?? null;
            const latestSig = sol.data?.latestSig ?? null;
            const balanceSol = typeof balanceLamports === 'number' ? (balanceLamports / 1_000_000_000).toFixed(4) : null;
            async function doAirdrop() {
              try {
                await fetch('/api/ops/solana/airdrop', { method: 'POST' });
                await sol.refresh();
              } catch {}
            }
            return (
              <Card key={key} title={
                <span className="inline-flex items-center gap-2">
                  {title}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${badgeClassFor(key)}`}>Devnet</span>
                </span>
              } actions={
                <div className="flex items-center gap-2">
                  <IconRefresh onClick={sol.refresh} disabled={sol.loading} />
                  <button
                    onClick={doAirdrop}
                    className="px-2 h-8 rounded-md bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 text-xs hover:bg-emerald-500/20"
                    title="Request 1 SOL airdrop"
                  >
                    Airdrop
                  </button>
                </div>
              }>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={ok ? "text-emerald-400" : "text-red-400"}>●</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Endpoint:</span>
                  <span className="text-xs text-slate-300">{endpoint.replace('https://', '')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Slot:</span>
                  <span className="text-xs text-slate-300">{slot}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Block Height:</span>
                  <span className="text-xs text-slate-300">{blockHeight}</span>
                </div>
                {address && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Address:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={`https://explorer.solana.com/address/${address}?cluster=devnet`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={address}>
                        <span className="truncate font-mono">{address}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
                      <button
                        aria-label="Copy Address"
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        onClick={() => address && navigator.clipboard.writeText(address)}
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    </span>
                  </div>
                )}
                {typeof balanceSol === 'string' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Balance:</span>
                    <span className="text-xs text-slate-300">{balanceSol} SOL</span>
                  </div>
                )}
                {latestSig && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest TX:</span>
                    <span className="flex items-center gap-1 max-w-[60%] justify-end">
                      <a href={`https://explorer.solana.com/tx/${latestSig}?cluster=devnet`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white truncate" title={latestSig}>
                        <span className="truncate font-mono">{latestSig}</span>
                        <ExternalLink size={12} className="flex-shrink-0" />
                      </a>
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
