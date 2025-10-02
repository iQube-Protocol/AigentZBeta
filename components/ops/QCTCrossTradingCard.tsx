'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Repeat, AlertCircle } from 'lucide-react';

const CHAINS = [
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'ethereum', label: 'Ethereum Sepolia' },
  { id: 'polygon', label: 'Polygon Amoy' },
  { id: 'arbitrum', label: 'Arbitrum Sepolia' },
  { id: 'optimism', label: 'Optimism Sepolia' },
  { id: 'base', label: 'Base Sepolia' },
];

interface Props {
  className?: string;
  title?: React.ReactNode;
  address?: string; // optional EVM address for balances
}

export default function QCTCrossTradingCard({ className, title = 'QCT Cross-Chain Trading', address }: Props) {
  const [fromChain, setFromChain] = useState<string>('ethereum');
  const [toChain, setToChain] = useState<string>('polygon');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [amount, setAmount] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const [slippage, setSlippage] = useState<string>('0.5');
  const [deadline, setDeadline] = useState<string>('20');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [rates, setRates] = useState<Record<string, any> | null>(null);
  const [balances, setBalances] = useState<Array<{ chain: string; balance: string; decimals: number }>>([]);
  const [lastTx, setLastTx] = useState<{ id: string; chain: string } | null>(null);

  const rateKey = useMemo(() => `${fromChain}-to-${toChain}`, [fromChain, toChain]);
  const rate = useMemo(() => {
    if (!rates) return null;
    const r = rates[rateKey];
    const num = typeof r === 'string' ? parseFloat(r) : r;
    return Number.isFinite(num) ? num : null;
  }, [rates, rateKey]);

  const fromBal = useMemo(() => balances.find(b => b.chain === fromChain)?.balance, [balances, fromChain]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/qct/trading?action=rates');
        const json = await res.json();
        if (mounted && json) setRates(json.rates || json);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!address) return;
    (async () => {
      try {
        const res = await fetch(`/api/qct/trading?action=balances&address=${encodeURIComponent(address)}`);
        const json = await res.json();
        if (mounted && json?.balances) setBalances(json.balances);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [address]);

  function reverseChains() {
    setFromChain(toChain);
    setToChain(fromChain);
  }

  function isSameChain() { return fromChain === toChain; }

  function explorerFor(chain: string, id: string) {
    if (chain === 'bitcoin') return `https://mempool.space/testnet/tx/${id}`;
    if (chain === 'polygon') return `https://www.oklink.com/amoy/tx/${id}`;
    if (chain === 'ethereum') return `https://sepolia.etherscan.io/tx/${id}`;
    if (chain === 'base') return `https://sepolia.basescan.org/tx/${id}`;
    if (chain === 'arbitrum') return `https://sepolia.arbiscan.io/tx/${id}`;
    if (chain === 'optimism') return `https://sepolia-optimism.etherscan.io/tx/${id}`;
    return '#';
  }

  const estOutput = useMemo(() => {
    if (!rate || !amount) return null;
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return (n * rate).toFixed(6);
  }, [rate, amount]);

  function valid(): boolean {
    if (!amount || parseFloat(amount) <= 0) return false;
    if (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0)) return false;
    if (orderType === 'stop' && (!stopPrice || parseFloat(stopPrice) <= 0)) return false;
    return true;
  }

  async function submit(action: 'buy' | 'sell' | 'swap' | 'bridge') {
    if (!valid()) return;
    setSubmitting(true);
    try {
      const body: any = {
        action,
        orderType,
        fromChain,
        toChain,
        amount,
        slippage: parseFloat(slippage),
        deadline: parseInt(deadline, 10),
      };
      if (orderType === 'limit') body.limitPrice = limitPrice;
      if (orderType === 'stop') body.stopPrice = stopPrice;

      const res = await fetch('/api/qct/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        alert(json?.error || 'Trade failed');
        return;
      }
      const txId = json.transactionId || json.messageId || json.id || '—';
      setLastTx({ id: String(txId), chain: action === 'bridge' ? toChain : fromChain });
    } catch (e: any) {
      alert(e?.message || 'Failed to submit trade');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur p-6 ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 border border-green-200">Live</span>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <div className="text-xs text-slate-400 mb-3">Swap, bridge, buy or sell QCT across chains</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-slate-400 mb-1">From Chain</div>
            <select
              value={fromChain}
              onChange={(e) => setFromChain(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              {CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">To Chain</div>
            <select
              value={toChain}
              onChange={(e) => setToChain(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              {CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-center">
          <button
            onClick={reverseChains}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Repeat className="h-3 w-3" /> Reverse
          </button>
        </div>

        <div className="border-t border-slate-700 my-2"></div>

        <div className="flex gap-1 mb-2">
          {(['market', 'limit', 'stop'] as const).map(type => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`flex-1 px-2 py-1 text-xs rounded ${
                orderType === type
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-300'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
        {orderType === 'limit' && (
          <div>
            <div className="text-xs text-slate-400 mb-1">Limit Price</div>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-2 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        )}
        {orderType === 'stop' && (
          <div>
            <div className="text-xs text-slate-400 mb-1">Stop Price</div>
            <input
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-2 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-slate-400">Amount (QCT)</div>
            <div className="text-xs text-slate-500">Balance: {fromBal ?? '—'} QCT</div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0000"
              className="flex-1 px-2 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <button
              onClick={() => setAmount(fromBal || '')}
              className="px-3 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Max
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-slate-400 mb-1">Slippage</div>
            <select
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="0.1">0.1%</option>
              <option value="0.5">0.5%</option>
              <option value="1.0">1.0%</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Deadline</div>
            <select
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            >
              <option value="5">5 minutes</option>
              <option value="20">20 minutes</option>
              <option value="60">1 hour</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-700 my-2"></div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Est. Output</span>
          <span className="text-sm text-slate-300">{estOutput ?? '—'} QCT</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <AlertCircle className="h-3 w-3" />
          <span>Bridge fees and on-chain gas apply when crossing chains.</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3">
          <button
            onClick={() => submit('buy')}
            disabled={submitting || !valid()}
            className="px-2 py-1.5 text-xs bg-green-600/80 hover:bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Buy
          </button>
          <button
            onClick={() => submit('sell')}
            disabled={submitting || !valid()}
            className="px-2 py-1.5 text-xs bg-red-600/80 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sell
          </button>
          <button
            onClick={() => submit('swap')}
            disabled={submitting || !valid() || !isSameChain()}
            className="px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Swap
          </button>
          <button
            onClick={() => submit('bridge')}
            disabled={submitting || !valid() || isSameChain()}
            className="px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bridge
          </button>
        </div>

        {lastTx && (
          <div className="flex items-center justify-between bg-slate-800/30 rounded px-2 py-1 mt-2">
            <span className="text-xs text-slate-400">Last Result</span>
            <a
              href={explorerFor(lastTx.chain, lastTx.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white"
              title={lastTx.id}
            >
              <span>{lastTx.id.slice(0, 10)}...</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
