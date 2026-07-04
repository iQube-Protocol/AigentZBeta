'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DollarSign, Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';

interface PriceRow {
  tier_key: string;
  price_usd_cents: number;
  active: boolean;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface PremiumRow {
  premium_key: string;
  value_bps: number;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

const TIER_LABELS: Record<string, string> = {
  sovereign_citizen: 'Tier 1 — Sovereignty ($29)',
  steward:           'Tier 2 — Stewardship ($99)',
  venture_lite:      'Tier 3 — Founder Office Operator ($299)',
  venture_pro:       'Tier 4 — Operator Plus ($999)',
  venture_elite:     'Tier 5 — Portfolio Operator ($2,999)',
};

const PREMIUM_LABELS: Record<string, string> = {
  usdc_fee:     'USDC fee',
  paypal_fee:   'PayPal fee',
  fiat_premium: 'Fiat premium (USDC + PayPal)',
  qct_premium:  'Q¢ premium (house rate)',
};

export function PlanPriceConfigAdminTab() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [premiumRows, setPremiumRows] = useState<PremiumRow[]>([]);
  const [premiumEdits, setPremiumEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch('/api/admin/billing/price-config');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Failed to load prices');
      setRows(data.prices as PriceRow[]);
      const init: Record<string, string> = {};
      for (const r of data.prices as PriceRow[]) {
        init[r.tier_key] = (r.price_usd_cents / 100).toFixed(2);
      }
      setEdits(init);
      const premiums = (data.premiums ?? []) as PremiumRow[];
      setPremiumRows(premiums);
      const pInit: Record<string, string> = {};
      for (const p of premiums) {
        // Display as a percentage (bps / 100). 100 bps → "1.00".
        pInit[p.premium_key] = (p.value_bps / 100).toFixed(2);
      }
      setPremiumEdits(pInit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (tierKey: string) => {
    const raw = edits[tierKey] ?? '';
    const usd = parseFloat(raw);
    if (isNaN(usd) || usd < 0) {
      setError(`Invalid price for ${tierKey}: "${raw}"`);
      return;
    }
    const cents = Math.round(usd * 100);
    setSaving(tierKey);
    setError(null);
    setSaved(null);
    try {
      const res = await personaFetch('/api/admin/billing/price-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_key: tierKey, price_usd_cents: cents }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Save failed');
      setSaved(tierKey);
      setTimeout(() => setSaved(null), 2000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  const savePremium = async (premiumKey: string) => {
    const raw = premiumEdits[premiumKey] ?? '';
    const pct = parseFloat(raw);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError(`Invalid premium for ${premiumKey}: "${raw}" (must be 0–100%)`);
      return;
    }
    const bps = Math.round(pct * 100); // "1.00"% → 100 bps
    setSaving(premiumKey);
    setError(null);
    setSaved(null);
    try {
      const res = await personaFetch('/api/admin/billing/price-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premium_key: premiumKey, value_bps: bps }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Save failed');
      setSaved(premiumKey);
      setTimeout(() => setSaved(null), 2000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Plan Price Config</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Prices are stored in USD cents. Enter the USD amount (e.g. <code className="text-amber-300">29.00</code>) and save.
        Changes take effect immediately for new checkouts. Accepted payment rails: Q¢ · USDC · PayPal.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.tier_key}
              className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {TIER_LABELS[row.tier_key] ?? row.tier_key}
                  </p>
                  {row.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{row.description}</p>
                  )}
                  {row.updated_by && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Last updated by {row.updated_by} · {new Date(row.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={edits[row.tier_key] ?? ''}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [row.tier_key]: e.target.value }))}
                    className="w-24 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button
                    onClick={() => save(row.tier_key)}
                    disabled={saving === row.tier_key}
                    className="flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-2.5 py-1 text-xs font-medium text-white transition-colors"
                  >
                    {saving === row.tier_key ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : saved === row.tier_key ? (
                      <CheckCircle2 className="h-3 w-3 text-green-300" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    {saved === row.tier_key ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment premiums */}
      {!loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pt-2">
            <DollarSign className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Payment Premiums</h3>
          </div>
          <p className="text-xs text-slate-400">
            Per-rail premiums applied on top of the base price. Q¢ is the house rate (no premium). USDC charges{' '}
            <code className="text-sky-300">USDC fee + Fiat premium</code>; PayPal charges{' '}
            <code className="text-sky-300">PayPal fee + Fiat premium</code>. Enter a percentage (e.g.{' '}
            <code className="text-sky-300">1.00</code> = 1%).
          </p>
          {premiumRows.length === 0 ? (
            <p className="text-xs text-slate-500">
              No premium config found — run migration <code>20260625000005_plan_premium_config.sql</code>. Defaults apply until then (USDC 1% + 7%, PayPal 3% + 7%).
            </p>
          ) : (
            premiumRows.map((p) => (
              <div key={p.premium_key} className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{PREMIUM_LABELS[p.premium_key] ?? p.premium_key}</p>
                    {p.description && <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>}
                    {p.updated_by && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Last updated by {p.updated_by} · {new Date(p.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={premiumEdits[p.premium_key] ?? ''}
                      onChange={(e) => setPremiumEdits((prev) => ({ ...prev, [p.premium_key]: e.target.value }))}
                      className="w-20 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-sky-500 transition-colors"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                    <button
                      onClick={() => savePremium(p.premium_key)}
                      disabled={saving === p.premium_key}
                      className="flex items-center gap-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-2.5 py-1 text-xs font-medium text-white transition-colors"
                    >
                      {saving === p.premium_key ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : saved === p.premium_key ? (
                        <CheckCircle2 className="h-3 w-3 text-green-300" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {saved === p.premium_key ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-700/30 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300">Notes</p>
        <p>• Tier 0 (Citizen/Free) has no price — it is always free.</p>
        <p>• Founder Office prices ($299/$999/$2,999) use venture_lite/pro/elite keys.</p>
        <p>• KNYT is excluded from plan payments. Only Q¢, USDC, and PayPal are offered at checkout.</p>
        <p>• Q¢ charges the base price; USDC and PayPal add the premiums above.</p>
        <p>• Price and premium changes take effect immediately for new checkouts; active subscriptions are unaffected until renewal.</p>
      </div>
    </div>
  );
}
