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

const TIER_LABELS: Record<string, string> = {
  sovereign_citizen: 'Tier 1 — Sovereignty ($29)',
  steward:           'Tier 2 — Stewardship ($99)',
  venture_lite:      'Tier 3 — Founder Office Operator ($299)',
  venture_pro:       'Tier 4 — Operator Plus ($999)',
  venture_elite:     'Tier 5 — Portfolio Operator ($2,999)',
};

export function PlanPriceConfigAdminTab() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
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

      <div className="rounded-lg border border-slate-700/30 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-1">
        <p className="font-medium text-slate-300">Notes</p>
        <p>• Tier 0 (Citizen/Free) has no price — it is always free.</p>
        <p>• Founder Office prices ($299/$999/$2,999) use venture_lite/pro/elite keys.</p>
        <p>• KNYT is excluded from plan payments. Only Q¢, USDC, and PayPal are offered at checkout.</p>
        <p>• Price changes do not affect active subscriptions until their next renewal period.</p>
      </div>
    </div>
  );
}
