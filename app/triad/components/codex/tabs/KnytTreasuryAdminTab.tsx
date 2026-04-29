'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Vault,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const TREASURY = process.env.NEXT_PUBLIC_KNYT_TREASURY_ADDRESS ?? '';
const KNYT_CONTRACT = '0xe53dad36cd0A8EdC656448CE7912bba72beBECb4';
const USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ETH_RPC = 'https://eth.llamarpc.com';

// ── RPC helpers ────────────────────────────────────────────────────────────────

async function fetchErc20Balance(contract: string, address: string, decimals: number): Promise<string> {
  try {
    const data = '0x70a08231' + address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const res = await fetch(ETH_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_call',
        params: [{ to: contract, data }, 'latest'],
      }),
    });
    const json = await res.json() as { result?: string };
    const hex = (json.result ?? '0x0').replace(/^0x/, '') || '0';
    const n = BigInt('0x' + hex);
    if (n === 0n) return '0';
    const divisor = 10n ** BigInt(decimals);
    const whole = n / divisor;
    const frac = n % divisor;
    if (frac === 0n) return whole.toString();
    return `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4)}`;
  } catch {
    return '—';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Deposit {
  id: string;
  persona_id: string;
  amount: string;
  created_at: string;
  metadata?: { tx_hash?: string };
}

interface AdminData {
  deposits?: Deposit[];
  totalDeposited?: string;
  usdcDeposits?: Deposit[];
  totalUsdcDeposited?: string;
  qcDeposits?: Deposit[];
  totalQcDeposited?: string;
}

interface Props {
  isAdmin?: boolean;
  personaId?: string;
}

// ── Deposit table ──────────────────────────────────────────────────────────────

function DepositTable({ deposits, loading, unit, explorerBase }: {
  deposits: Deposit[];
  loading: boolean;
  unit: string;
  explorerBase: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }
  if (deposits.length === 0) {
    return <p className="py-5 text-center text-xs text-white/30">No deposits yet.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-white/10 text-[10px] text-white/40 uppercase">
          <th className="px-3 py-2 text-left">Persona</th>
          <th className="px-3 py-2 text-right">Amount</th>
          <th className="px-3 py-2 text-right">Date</th>
          <th className="px-3 py-2 text-right">Tx</th>
        </tr>
      </thead>
      <tbody>
        {deposits.map((d) => (
          <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
            <td className="px-3 py-2 font-mono text-indigo-300 truncate max-w-[120px]">
              {d.persona_id.slice(0, 8)}…
            </td>
            <td className="px-3 py-2 text-right font-semibold text-amber-300">
              {parseFloat(d.amount).toFixed(2)} {unit}
            </td>
            <td className="px-3 py-2 text-right text-white/40">
              {new Date(d.created_at).toLocaleDateString()}
            </td>
            <td className="px-3 py-2 text-right">
              {d.metadata?.tx_hash ? (
                <a
                  href={`${explorerBase}${d.metadata.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400/60 hover:text-blue-300 transition"
                >
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              ) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function KnytTreasuryAdminTab({ isAdmin }: Props) {
  const [knytBalance, setKnytBalance] = useState<string>('—');
  const [usdcBalance, setUsdcBalance] = useState<string>('—');
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [totalDeposited, setTotalDeposited] = useState<string>('0');
  const [usdcDeposits, setUsdcDeposits] = useState<Deposit[]>([]);
  const [totalUsdcDeposited, setTotalUsdcDeposited] = useState<string>('0');
  const [qcDeposits, setQcDeposits] = useState<Deposit[]>([]);
  const [totalQcDeposited, setTotalQcDeposited] = useState<string>('0');
  const [historyLoading, setHistoryLoading] = useState(false);

  const [airdropAddress, setAirdropAddress] = useState('');
  const [airdropAmount, setAirdropAmount] = useState('');
  const [airdropPersonaId, setAirdropPersonaId] = useState('');
  const [airdropState, setAirdropState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [airdropResult, setAirdropResult] = useState<{ txHash?: string; error?: string }>({});

  const loadBalances = useCallback(async () => {
    if (!TREASURY) return;
    setBalanceLoading(true);
    const [knyt, usdc] = await Promise.all([
      fetchErc20Balance(KNYT_CONTRACT, TREASURY, 18),
      fetchErc20Balance(USDC_CONTRACT, TREASURY, 6),
    ]);
    setKnytBalance(knyt);
    setUsdcBalance(usdc);
    setBalanceLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/wallet/knyt/treasury-admin');
      const json = await res.json() as AdminData;
      setDeposits(json.deposits ?? []);
      setTotalDeposited(json.totalDeposited ?? '0');
      setUsdcDeposits(json.usdcDeposits ?? []);
      setTotalUsdcDeposited(json.totalUsdcDeposited ?? '0');
      setQcDeposits(json.qcDeposits ?? []);
      setTotalQcDeposited(json.totalQcDeposited ?? '0');
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalances();
    loadHistory();
  }, [loadBalances, loadHistory]);

  async function sendAirdrop() {
    if (!airdropAddress || !airdropAmount) return;
    setAirdropState('sending');
    try {
      const res = await fetch('/api/wallet/knyt/treasury-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddress: airdropAddress,
          amountKnyt: parseFloat(airdropAmount),
          personaId: airdropPersonaId || undefined,
        }),
      });
      const json = await res.json() as { success?: boolean; txHash?: string; error?: string };
      if (!res.ok || !json.success) {
        setAirdropResult({ error: json.error ?? 'Airdrop failed' });
        setAirdropState('error');
      } else {
        setAirdropResult({ txHash: json.txHash });
        setAirdropState('done');
        loadBalances();
      }
    } catch (err) {
      setAirdropResult({ error: (err as Error).message });
      setAirdropState('error');
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Treasury Balances ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
            <Vault className="h-3.5 w-3.5 text-amber-400" />
            Treasury Wallet (Ethereum Mainnet)
          </div>
          <button
            type="button"
            onClick={loadBalances}
            disabled={balanceLoading}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${balanceLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {!TREASURY ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 inline mr-1.5" />
            Set NEXT_PUBLIC_KNYT_TREASURY_ADDRESS to enable treasury monitoring.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '$KNYT Balance', value: knytBalance, unit: '$KNYT', color: 'text-amber-300' },
              { label: 'USDC Balance', value: usdcBalance, unit: 'USDC', color: 'text-emerald-300' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[10px] text-white/40 mb-1">{label}</p>
                {balanceLoading
                  ? <Loader2 className="h-4 w-4 animate-spin text-white/30" />
                  : <p className={`text-lg font-semibold ${color}`}>{value} <span className="text-xs font-normal text-white/40">{unit}</span></p>}
              </div>
            ))}
          </div>
        )}

        {TREASURY && (
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 text-[10px] font-mono text-white/30 truncate">{TREASURY}</code>
            <a
              href={`https://etherscan.io/address/${TREASURY}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-white/30 hover:text-white/50 transition"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </section>

      {/* ── EVM ($KNYT) Deposit History ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
            <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400" />
            $KNYT EVM Deposits  <span className="text-emerald-400 font-semibold">{totalDeposited} $KNYT total</span>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <DepositTable
            deposits={deposits}
            loading={historyLoading}
            unit="$KNYT"
            explorerBase="https://etherscan.io/tx/"
          />
        </div>
      </section>

      {/* ── USDC Deposit History ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
            <ArrowDownToLine className="h-3.5 w-3.5 text-blue-400" />
            USDC Deposits  <span className="text-blue-400 font-semibold">{totalUsdcDeposited} USDC total</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <DepositTable
            deposits={usdcDeposits}
            loading={historyLoading}
            unit="USDC"
            explorerBase="https://etherscan.io/tx/"
          />
        </div>
      </section>

      {/* ── Base Q¢ Deposit History ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50">
            <ArrowDownToLine className="h-3.5 w-3.5 text-violet-400" />
            Base Q¢ Deposits  <span className="text-violet-400 font-semibold">{totalQcDeposited} Q¢ total</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <DepositTable
            deposits={qcDeposits}
            loading={historyLoading}
            unit="Q¢"
            explorerBase="https://basescan.org/tx/"
          />
        </div>
      </section>

      {/* ── Airdrop ── */}
      <section>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/50 mb-3">
          <Coins className="h-3.5 w-3.5 text-violet-400" />
          Airdrop $KNYT
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-[10px] text-white/40 leading-relaxed">
            Mint $KNYT on-chain and optionally credit the persona's DVN ledger simultaneously.
            Requires <code className="text-amber-300">KNYT_MINTER_PRIVATE_KEY</code> to be set.
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={airdropAddress}
              onChange={(e) => setAirdropAddress(e.target.value)}
              placeholder="Recipient EVM address (0x…)"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-violet-500/50 focus:outline-none font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={airdropAmount}
                onChange={(e) => setAirdropAmount(e.target.value)}
                placeholder="Amount $KNYT"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-violet-500/50 focus:outline-none"
              />
              <input
                type="text"
                value={airdropPersonaId}
                onChange={(e) => setAirdropPersonaId(e.target.value)}
                placeholder="Persona ID (optional)"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-violet-500/50 focus:outline-none font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={sendAirdrop}
            disabled={airdropState === 'sending' || !airdropAddress || !airdropAmount}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50 transition"
          >
            {airdropState === 'sending'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Send className="h-3.5 w-3.5" />}
            {airdropState === 'sending' ? 'Minting…' : 'Send Airdrop'}
          </button>

          {airdropState === 'done' && airdropResult.txHash && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-emerald-300 font-medium">Airdrop sent</p>
                <a
                  href={`https://etherscan.io/tx/${airdropResult.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400/70 hover:text-emerald-300 font-mono truncate block"
                >
                  {airdropResult.txHash.slice(0, 18)}…{airdropResult.txHash.slice(-6)}
                </a>
              </div>
            </div>
          )}

          {airdropState === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {airdropResult.error}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default KnytTreasuryAdminTab;
