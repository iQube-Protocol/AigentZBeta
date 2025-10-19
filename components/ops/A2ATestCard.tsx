"use client";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshCw, Play, ShieldCheck, CheckCircle2, Globe, Copy, Fuel } from "lucide-react";
import { x402PaidFetchFactory } from "@/app/hooks/useX402";

function Card({ title, children, actions, className }: { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6 ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">{children}</div>
    </div>
  );
}

export function A2ATestCard({ title }: { title: string }) {
  const [assetKey, setAssetKey] = useState<"ETH_QCENT"|"ARB_QCENT"|"BASE_QCENT"|"OP_QCENT"|"POLY_QCENT"|"BTC_QCENT"|"SOL_QCENT">("ARB_QCENT");
  const [btcTxId, setBtcTxId] = useState("");
  const [solSig, setSolSig] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string>("");
  const [evmSigner, setEvmSigner] = useState<string>("");

  const append = (line: string) => setLog((prev) => `${prev}${prev?"\n":""}${new Date().toISOString()}  ${line}`);

  const paidFetch = useMemo(() => x402PaidFetchFactory("svc:compute:quote", assetKey), [assetKey]);

  const runEvmEndToEnd = useCallback(async (which: "ETH_QCENT"|"ARB_QCENT"|"BASE_QCENT"|"OP_QCENT"|"POLY_QCENT") => {
    try {
      setBusy(`e2e-${which}`);
      append(`Start EVM E2E for ${which}`);

      // 1) Pay Intent
      const intentRes = await fetch("/api/a2a/facilitator/pay-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId: "svc:compute:quote", assetKey: which })
      });
      const intent = await intentRes.json();
      if (!intentRes.ok) throw new Error(`pay-intent failed: ${intentRes.status}`);
      append(`Intent ok: ${JSON.stringify(intent.payParams)}`);

      // 2) Transfer
      const tr = await fetch("/api/a2a/signer/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chainId: intent.payParams.chainId,
          tokenAddress: intent.payParams.tokenAddress,
          to: intent.payParams.payTo,
          amount: intent.payParams.amount,
        })
      });
      const trj = await tr.json();
      if (!tr.ok || !trj?.txHash) throw new Error(`transfer failed: ${tr.status}`);
      append(`Transfer ok: ${trj.txHash}`);

      // 3) Verify
      const vr = await fetch("/api/a2a/facilitator/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetKey: which,
          txHashOrId: trj.txHash,
          chainId: intent.payParams.chainId,
          tokenAddress: intent.payParams.tokenAddress,
          payTo: intent.payParams.payTo,
          amount: intent.payParams.amount,
        })
      });
      const vrj = await vr.json();
      if (!vr.ok || !vrj?.proof) throw new Error(`verify failed: ${vr.status}`);
      append(`Verify ok: ${vrj.proof.type}`);

      // 4) Access protected
      const p = await fetch("/api/a2a/protected/compute", { headers: { "X-402-Proof": JSON.stringify(vrj.proof) } });
      const pj = await p.json();
      append(`Protected access: ${p.status} ok=${p.ok} -> ${JSON.stringify(pj)}`);
      append(`Summary: Paid 0.8 Q¢ to access compute using ${which}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  }, [append]);

  const runPaidFetch = useCallback(async () => {
    try {
      setBusy("paidFetch");
      
      // Handle BTC/SOL differently - show payment instructions
      if (assetKey === "BTC_QCENT" || assetKey === "SOL_QCENT") {
        append(`Getting payment instructions for ${assetKey}...`);
        const intentRes = await fetch("/api/a2a/facilitator/pay-intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resourceId: "svc:compute:quote", assetKey })
        });
        const intent = await intentRes.json();
        const transferRes = await fetch("/api/a2a/signer/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chainId: intent.payParams.chainId,
            tokenAddress: intent.payParams.tokenAddress,
            to: intent.payParams.payTo,
            amount: intent.payParams.amount,
            asset: intent.payParams.asset,
          })
        });
        const transferJson = await transferRes.json();
        if (transferJson.instructions) {
          append(`Payment Instructions for ${assetKey}:`);
          append(`Network: ${transferJson.instructions.network}`);
          append(`Address: ${transferJson.instructions.address}`);
          append(`Amount: ${transferJson.instructions.amount}`);
          append(`Note: ${transferJson.instructions.note}`);
          append(`After sending payment, use the verification buttons below with your transaction ID/signature.`);
        }
        return;
      }
      
      // Regular EVM flow
      append(`Paid fetch for ${assetKey}`);
      const r = await paidFetch("/api/a2a/protected/compute");
      append(`Paid fetch result: status=${r.status} ok=${r.ok} ${r.text?`text=${r.text}`: r.json?`json=${JSON.stringify(r.json)}`:""}`);
      if (r.ok) append(`Summary: Paid 0.8 Q¢ to access compute using ${assetKey}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  }, [assetKey, paidFetch]);

  const fundSigner = useCallback(async () => {
    try {
      setBusy("fund");
      append("Funding signer and aigents on all EVM testnets...");
      const r = await fetch('/api/admin/fund-signer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chainIds: [11155111, 421614, 11155420, 84532, 80002], amountQct: '100' })
      });
      const j = await r.json();
      append(`Signer fund result: status=${r.status} ok=${r.ok} -> ${JSON.stringify(j)}`);
      
      // Also fund all agents with 10 Q¢ per chain
      append("Funding all aigents with 10 Q¢ per chain...");
      const agentR = await fetch('/api/admin/fund-agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chainIds: [11155111, 421614, 11155420, 84532, 80002], amountQct: '10' })
      });
      const agentJ = await agentR.json();
      append(`Aigents fund result: status=${agentR.status} ok=${agentR.ok} -> ${JSON.stringify(agentJ)}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const fundAgentsNative = useCallback(async () => {
    try {
      setBusy("fundNative");
      append("Funding agents with native tokens (ETH/MATIC) from Aigent Z...");
      const r = await fetch('/api/admin/fund-agents-native', {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });
      const j = await r.json();
      
      if (r.ok && j.ok) {
        append(`✅ Native funding completed: ${j.summary.ethSuccessful}/${j.summary.ethSuccessful + j.summary.ethFailed} ETH transfers successful`);
        
        // Log successful transfers
        const successful = j.results.filter((r: any) => r.success);
        successful.forEach((result: any) => {
          append(`  ✅ ${result.agent}: ${result.amount} ${result.currency} on ${result.chain} (${result.txHash?.slice(0, 10)}...)`);
        });
        
        // Log failed transfers
        const failed = j.results.filter((r: any) => !r.success);
        if (failed.length > 0) {
          append(`❌ Failed transfers:`);
          failed.forEach((result: any) => {
            append(`  ❌ ${result.agent}: ${result.currency} on ${result.chain} - ${result.error}`);
          });
        }
        
        append(`Summary: ${j.message}`);
      } else {
        append(`❌ Native funding failed: ${j.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      append(`ERROR: ${e?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const verifyBtc = useCallback(async () => {
    try {
      setBusy("btcVerify");
      if (!btcTxId) throw new Error("Enter a BTC testnet txid");
      append(`BTC verify for tx ${btcTxId}`);
      const r = await fetch("/api/a2a/facilitator/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetKey: "BTC_QCENT", txHashOrId: btcTxId })
      });
      const j = await r.json();
      append(`BTC verify: status=${r.status} ok=${r.ok} ${JSON.stringify(j)}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  }, [btcTxId]);

  const verifySol = useCallback(async () => {
    try {
      setBusy("solVerify");
      if (!solSig) throw new Error("Enter a Solana testnet signature");
      append(`SOL verify for sig ${solSig}`);
      const r = await fetch("/api/a2a/facilitator/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetKey: "SOL_QCENT", txHashOrId: solSig })
      });
      const j = await r.json();
      append(`SOL verify: status=${r.status} ok=${r.ok} ${JSON.stringify(j)}`);
    } catch (e: any) {
      append(`ERROR: ${e?.message || String(e)}`);
    } finally {
      setBusy(null);
    }
  }, [solSig]);

  // Load EVM signer address for funding guidance
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/a2a/signer/address', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j?.address) setEvmSigner(j.address);
        }
      } catch {}
    })();
  }, []);

  return (
    <Card title={title} actions={
      <button onClick={() => setLog("")} className="px-3 py-1 text-xs rounded border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-1">
        <RefreshCw size={12} />
        Clear Log
      </button>
    }>
      <div className="space-y-4">
        {/* Funding guidance */}
        <div className="bg-slate-800/50 rounded p-2 text-xs flex items-center justify-between">
          <div className="text-slate-400">EVM Signer:</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-300">{evmSigner ? `${evmSigner.slice(0,6)}...${evmSigner.slice(-4)}` : '—'}</span>
            {evmSigner && (
              <button className="text-slate-400 hover:text-white" onClick={() => navigator.clipboard.writeText(evmSigner)} title="Copy">
                <Copy size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Asset selector + Paid fetch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400">Asset</label>
            <select value={assetKey} onChange={(e)=>setAssetKey(e.target.value as any)} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-300 h-10">
              <option value="ARB_QCENT">ARB_QCENT (Arbitrum Sepolia)</option>
              <option value="BASE_QCENT">BASE_QCENT (Base Sepolia)</option>
              <option value="OP_QCENT">OP_QCENT (Optimism Sepolia)</option>
              <option value="POLY_QCENT">POLY_QCENT (Polygon Amoy)</option>
              <option value="BTC_QCENT">BTC_QCENT (Bitcoin Testnet)</option>
              <option value="SOL_QCENT">SOL_QCENT (Solana Testnet)</option>
              <option value="ETH_QCENT">ETH_QCENT (Ethereum Sepolia) ⚠️</option>
            </select>
          </div>
          <div className="flex items-end">
            <button disabled={busy==="paidFetch"} onClick={runPaidFetch} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded text-xs text-center h-10">
              <ShieldCheck size={14} /> 
              {assetKey === "BTC_QCENT" || assetKey === "SOL_QCENT" 
                ? "Get Payment Instructions" 
                : "Pay 0.8 Q¢ to access compute"
              }
            </button>
          </div>
        </div>

        {/* Admin tools */}
        <div className="space-y-1">
          <div className="text-xs text-slate-400">Admin</div>
          <button disabled={busy==="fund"} onClick={fundSigner} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 rounded text-xs text-center">
            Fund Signer and Aigents
          </button>
          <button disabled={busy==="fundNative"} onClick={fundAgentsNative} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded text-xs text-center">
            <Fuel size={14} />
            Fund Aigents Native Tokens
          </button>
        </div>

        {/* EVM end-to-end testers */}
        <div className="space-y-1 border-t border-slate-700 pt-3">
          <div className="text-xs font-medium text-slate-300">EVM End-to-End Flows</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <button disabled={!!busy} onClick={()=>runEvmEndToEnd("ARB_QCENT")} className="px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded text-xs flex items-center justify-center gap-2 text-center">
              <Play size={12}/> ARB Q¢
            </button>
            <button disabled={!!busy} onClick={()=>runEvmEndToEnd("BASE_QCENT")} className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded text-xs flex items-center justify-center gap-2 text-center">
              <Play size={12}/> BASE Q¢
            </button>
            <button disabled={!!busy} onClick={()=>runEvmEndToEnd("OP_QCENT")} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 rounded text-xs flex items-center justify-center gap-2 text-center">
              <Play size={12}/> OP Q¢
            </button>
            <button disabled={!!busy} onClick={()=>runEvmEndToEnd("POLY_QCENT")} className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded text-xs flex items-center justify-center gap-2 text-center">
              <Play size={12}/> POLY Q¢
            </button>
            <button disabled={!!busy} onClick={()=>runEvmEndToEnd("ETH_QCENT")} className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded text-xs flex items-center justify-center gap-2 text-center">
              <Play size={12}/> ETH Q¢
            </button>
          </div>
        </div>

        {/* BTC / Solana verify testers */}
        <div className="space-y-1 border-t border-slate-700 pt-3">
          <div className="text-xs font-medium text-slate-300">BTC & Solana A2A Integration</div>
          <div className="text-xs text-slate-400 mb-2">Fast verification via ICP Proof-of-State receipts - no blockchain confirmation needed!</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={btcTxId} onChange={(e)=>setBtcTxId(e.target.value)} placeholder="BTC testnet txid (any valid format)" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-300" />
            <button disabled={busy==="btcVerify"} onClick={verifyBtc} className="px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded text-xs flex items-center justify-center gap-2">
              <Globe size={14}/> Verify BTC A2A
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={solSig} onChange={(e)=>setSolSig(e.target.value)} placeholder="Solana testnet signature (any valid format)" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-300" />
            <button disabled={busy==="solVerify"} onClick={verifySol} className="px-3 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-300 rounded text-xs flex items-center justify-center gap-2">
              <CheckCircle2 size={14}/> Verify SOL A2A
            </button>
          </div>
        </div>

        {/* Log */}
        <div className="space-y-1 border-t border-slate-700 pt-3">
          <div className="text-xs font-medium text-slate-300">Log</div>
          <pre className="text-xs bg-slate-950/60 border border-slate-800 rounded p-2 text-slate-300 whitespace-pre-wrap max-h-64 overflow-auto">{log || "No output yet."}</pre>
        </div>
      </div>
    </Card>
  );
}
