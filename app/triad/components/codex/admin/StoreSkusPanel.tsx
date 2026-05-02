'use client';

/**
 * StoreSkusPanel — operator surface for editing the store_skus catalog.
 *
 * Lists every SKU in the store catalog with one toggle per asset category
 * (GN / Still / Motion / Print / Characters / Lore) plus an Active flag.
 * Toggling does an optimistic update + PATCH /api/admin/store-skus and
 * reverts on failure.
 *
 * The grant booleans are wired to services/rewards/assetOwnership.ts —
 * flipping any flag here is what makes a SKU unlock that category for buyers
 * without redeploying code or running SQL.
 *
 * Surfaced from both:
 *   • Qriptopian Cartridge → Admin → Codex Manager (QriptopianAdminTab)
 *   • KNYT Cartridge       → Store Admin           (KnytStoreAdminTab)
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

interface StoreSkuRow {
  sku_id: string;
  name: string;
  description: string | null;
  grants_episodes_still: boolean;
  grants_episodes_motion: boolean;
  grants_episodes_print: boolean;
  grants_character_cards: boolean;
  grants_gn: boolean;
  grants_lore: boolean;
  is_active: boolean;
  extra_asset_ids: string[] | null;
  updated_at: string | null;
}

const SKU_FLAG_COLUMNS: Array<{ key: keyof StoreSkuRow; label: string; short: string }> = [
  { key: 'grants_gn',              label: 'Graphic Novel',  short: 'GN' },
  { key: 'grants_episodes_still',  label: 'Still episodes', short: 'Still' },
  { key: 'grants_episodes_motion', label: 'Motion episodes', short: 'Motion' },
  { key: 'grants_episodes_print',  label: 'Print prints',   short: 'Print' },
  { key: 'grants_character_cards', label: 'Character cards', short: 'Chars' },
  { key: 'grants_lore',            label: 'Lore docs',      short: 'Lore' },
];

export function StoreSkusPanel() {
  const [skus, setSkus]       = useState<StoreSkuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [savingSku, setSavingSku] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/store-skus');
      const json = await res.json() as { skus?: StoreSkuRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load SKUs');
      setSkus(json.skus ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SKUs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggleFlag = useCallback(async (skuId: string, key: keyof StoreSkuRow, current: boolean) => {
    setSavingSku(skuId);
    setError(null);
    setSkus((prev) => prev.map((s) => s.sku_id === skuId ? { ...s, [key]: !current } as StoreSkuRow : s));
    try {
      const res = await fetch('/api/admin/store-skus', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_id: skuId, [key]: !current }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSkus((prev) => prev.map((s) => s.sku_id === skuId ? { ...s, [key]: current } as StoreSkuRow : s));
    } finally {
      setSavingSku(null);
    }
  }, []);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Store SKUs <span className="ml-2 text-xs font-normal text-slate-400">{skus.length} sku{skus.length === 1 ? '' : 's'}</span></p>
          <p className="text-xs text-slate-500">Toggle which asset categories each bundle SKU unlocks for the buyer. Changes apply immediately to the ownership resolver.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Refresh'}
        </button>
      </div>

      {error && <div className="mb-2 rounded border border-red-800/40 bg-red-950/20 p-2 text-xs text-red-400">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
        </div>
      ) : skus.length === 0 ? (
        <div className="rounded border border-white/5 bg-slate-800/40 p-4 text-center text-xs text-slate-400">
          No SKUs in catalog. Run scripts/create-store-skus-table.sql to seed.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-white/5">
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">Name</th>
                {SKU_FLAG_COLUMNS.map(({ key, label, short }) => (
                  <th key={String(key)} className="pb-2 pr-3 text-center" title={label}>{short}</th>
                ))}
                <th className="pb-2 pr-3 text-center">Active</th>
                <th className="pb-2 pr-3 text-center">Extras</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((sku) => {
                const isSaving = savingSku === sku.sku_id;
                return (
                  <tr key={sku.sku_id} className={`border-b border-white/5 align-middle ${!sku.is_active ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-300">{sku.sku_id}</td>
                    <td className="py-2 pr-3 text-slate-200">{sku.name}</td>
                    {SKU_FLAG_COLUMNS.map(({ key }) => {
                      const value = !!(sku as unknown as Record<string, boolean>)[key as string];
                      return (
                        <td key={String(key)} className="py-2 pr-3 text-center">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void toggleFlag(sku.sku_id, key, value)}
                            className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                              value
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                : 'border-white/10 bg-slate-800 text-slate-500 hover:bg-slate-700'
                            } disabled:opacity-50`}
                          >
                            {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-2 pr-3 text-center">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void toggleFlag(sku.sku_id, 'is_active', sku.is_active)}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                          sku.is_active
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                            : 'border-white/10 bg-slate-800 text-slate-500 hover:bg-slate-700'
                        } disabled:opacity-50`}
                      >
                        {sku.is_active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-center text-slate-400">
                      {sku.extra_asset_ids?.length ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
