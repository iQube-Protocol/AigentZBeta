"use client";
import React from "react";
import { useBalances } from "@/app/hooks/useBalances";
import { useDVNEvents } from "@/app/hooks/useDVNEvents";

type Props = {
  open: boolean;
  onClose: () => void;
  agent: { id: string; name: string; evmSepolia?: `0x${string}`; evmArb?: `0x${string}`; btcAddress?: string; fioHandle?: string };
};

export default function AgentWalletDrawer({ open, onClose, agent }: Props) {
  const bals = useBalances({ sepolia: agent.evmSepolia, arb: agent.evmArb, btc: agent.btcAddress });
  const evs = useDVNEvents(agent.id);
  const formatToken = (raw?: string, decimals?: number, fractionDigits: number = 0) => {
    try {
      const d = typeof decimals === "number" ? decimals : 0;
      const bi = BigInt(raw || "0");
      if (d <= 0) return Number(bi).toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
      const factor = 10 ** Math.min(d, 18);
      const whole = Number(bi) / factor;
      return whole.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
    } catch {
      return "0";
    }
  };
  const formatUSDC = (raw?: string, decimals?: number) => formatToken(raw, decimals, 2);
  const formatQcent = (raw?: string, decimals?: number) => formatToken(raw, decimals, 0);
  const qctTotalStr = (() => {
    try {
      const ethQ = Number(BigInt(bals.qctSep || "0")) / (10 ** (bals.qctSepDecimals ?? 0));
      const arbQ = Number(BigInt(bals.qctArb || "0")) / (10 ** (bals.qctArbDecimals ?? 0));
      const btcQ = Number(BigInt(bals.btcQcent || "0")); // assume already in Q¢ units
      const total = ethQ + arbQ + btcQ;
      return total.toLocaleString(undefined, { maximumFractionDigits: 0 });
    } catch {
      return "0";
    }
  })();

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 drawer-backdrop bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="ml-auto h-full drawer-content animate-slide-in-left w-[21.6rem] bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10 overflow-y-auto">
        <header className="flex items-center justify-between px-4 py-3 bg-white/5 ring-1 ring-white/10">
          <h3 className="text-slate-100 text-sm font-medium tracking-wide">{agent.name} — Wallet</h3>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs rounded-md bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10"
          >
            Close
          </button>
        </header>

        <div className="p-4 space-y-5">
          <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Balances</div>
            <ul className="space-y-1 text-sm text-slate-200">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-blue-400">⟠</span>
                  ETH Q¢
                </span>
                <span className="font-mono text-slate-100">{formatQcent(bals.qctSep, bals.qctSepDecimals)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-cyan-400">◆</span>
                  ARB Q¢
                </span>
                <span className="font-mono text-slate-100">{formatQcent(bals.qctArb, bals.qctArbDecimals)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-orange-400">₿</span>
                  BTC Q¢
                </span>
                <span className="font-mono text-slate-100">{formatQcent(bals.btcQcent, 0)}</span>
              </li>
              <li className="flex items-center justify-between pt-2 mt-1 border-t border-white/10">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                  Q¢ Total
                </span>
                <span className="font-mono text-slate-100">{qctTotalStr}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  USDC
                </span>
                <span className="font-mono text-slate-100">{formatUSDC(bals.usdcSep, bals.usdcSepDecimals)}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Recent DVN Events</div>
            <div className="space-y-2">
              {evs.map((e, i) => {
                const statusColor = e.event === "PaymentConfirmed" ? "text-emerald-300" : e.event === "PaymentFailed" ? "text-red-300" : "text-amber-300";
                const statusDot = e.event === "PaymentConfirmed" ? "bg-emerald-400" : e.event === "PaymentFailed" ? "bg-red-400" : "bg-amber-400";
                const chainIcon = e.chain?.toLowerCase().includes("arb") || e.chain?.toLowerCase().includes("arbitrum") ? { glyph: "◆", cls: "text-cyan-400" } : e.chain?.toLowerCase().includes("eth") || e.chain?.toLowerCase().includes("ethereum") ? { glyph: "⟠", cls: "text-blue-400" } : e.chain?.toLowerCase().includes("btc") || e.chain?.toLowerCase().includes("bitcoin") ? { glyph: "₿", cls: "text-orange-400" } : { glyph: "•", cls: "text-slate-400" };
                return (
                  <div key={i} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-200">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                        <span className={statusColor}>{e.event}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-300">{e.asset}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <span className={chainIcon.cls}>{chainIcon.glyph}</span>
                        <span>{e.chain}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono truncate">{e.txHash}</div>
                    <div className="text-[11px] text-slate-500">{e.amount}</div>
                  </div>
                );
              })}
              {evs.length === 0 && (
                <div className="text-xs text-slate-400">No events yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Identity</div>
            <div className="text-xs text-slate-300">
              FIO: {agent.fioHandle || "—"}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
