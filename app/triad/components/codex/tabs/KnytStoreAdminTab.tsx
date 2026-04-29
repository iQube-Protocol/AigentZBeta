'use client';

import React, { useContext, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, BookOpen, Package, Save, Settings, Zap } from 'lucide-react';
import { SubHeaderSlotContext } from '../SubHeaderSlot';
import {
  EPISODE_PRICING,
  BUNDLE_PRICING,
  KNYT_CARDS_PRICING,
  KNYT_COYN_DISCOUNT,
  PRINT_PROVENANCE_PRICE_USD,
  PRINT_PROVENANCE_PRICE_KNYT,
  GN_PROVENANCE_PRICE_USD,
  GN_PROVENANCE_PRICE_KNYT,
  type EpisodePricing,
  type BundlePricing,
} from '@/types/knyt-store';

interface Props {
  isAdmin?: boolean;
  personaId?: string;
  theme?: 'light' | 'dark';
}

type AdminSection = 'overview' | 'episodes' | 'bundles' | 'cards' | 'provenance' | 'minting';
type MintingMode = 'immediate' | 'deferred' | 'canonical';

// ── Simple editable row ───────────────────────────────────────────────────────

function PriceRow({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed > 0) onSave(parsed);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-slate-300 truncate flex-1 mr-4">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-white focus:border-teal-500 focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={commit}
            className="rounded p-0.5 text-teal-400 hover:bg-teal-900/30"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(String(value)); setEditing(true); }}
          className="text-xs font-semibold text-white hover:text-teal-300 transition-colors tabular-nums"
        >
          ${value}
        </button>
      )}
    </div>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function EpisodesAdmin() {
  const [prices, setPrices] = useState<EpisodePricing[]>(EPISODE_PRICING);

  const update = (epNum: number, field: keyof EpisodePricing, val: number) => {
    setPrices((prev) => prev.map((ep) => ep.episodeNumber === epNum ? { ...ep, [field]: val } : ep));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-3 py-2 flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300">Changes are local to this session. Backend price sync is not yet wired — contact ops to apply changes.</p>
      </div>
      {prices.sort((a, b) => a.episodeNumber - b.episodeNumber).map((ep) => {
        const label = ep.episodeNumber === -1 ? 'Graphic Novel' : `Episode ${ep.episodeNumber}`;
        return (
          <div key={ep.episodeNumber} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
            <p className="text-xs font-semibold text-slate-200 mb-2">{label}</p>
            <PriceRow label="Digital (still/motion each)" value={ep.digitalPrice} onSave={(v) => update(ep.episodeNumber, 'digitalPrice', v)} />
            <PriceRow label="Print (Amazon RRP)" value={ep.printPrice} onSave={(v) => update(ep.episodeNumber, 'printPrice', v)} />
            <PriceRow label="Qripto" value={ep.qriptoPrice} onSave={(v) => update(ep.episodeNumber, 'qriptoPrice', v)} />
          </div>
        );
      })}
    </div>
  );
}

function BundlesAdmin() {
  const [bundles, setBundles] = useState<BundlePricing[]>(BUNDLE_PRICING);

  const updateDigital = (id: string, val: number) => {
    setBundles((prev) => prev.map((b) => b.id === id ? { ...b, digitalPrice: val } : b));
  };
  const updateRetail = (id: string, val: number) => {
    setBundles((prev) => prev.map((b) => b.id === id ? { ...b, retailPrice: val } : b));
  };

  const retailBundles   = bundles.filter((b) => !b.isInvestorOnly);
  const investorBundles = bundles.filter((b) => b.isInvestorOnly);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-3 py-2 flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300">Changes are local to this session. Backend price sync is not yet wired.</p>
      </div>

      {/* Retail / Public bundles */}
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Retail Bundles</p>
        <div className="space-y-2">
          {retailBundles.map((b) => (
            <div key={b.id} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-slate-200 flex-1">{b.label}</p>
                <span className="text-[9px] text-slate-500">{b.episodes.length} eps</span>
              </div>
              <PriceRow label="Retail price (USD)" value={b.digitalPrice} onSave={(v) => updateDigital(b.id, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* Investor bundles */}
      {investorBundles.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Investor Bundles</p>
          <div className="space-y-2">
            {investorBundles.map((b) => (
              <div key={b.id} className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-slate-200 flex-1">{b.label}</p>
                  <span className="text-[9px] font-medium text-yellow-500 border border-yellow-700/30 rounded px-1.5">Investor</span>
                  {b.isLimited && b.limitedSupply && (
                    <span className="text-[9px] font-medium text-red-400 border border-red-700/30 rounded px-1.5">Lim. {b.limitedSupply}</span>
                  )}
                </div>
                <PriceRow label="Investor price (USD)" value={b.digitalPrice} onSave={(v) => updateDigital(b.id, v)} />
                {b.retailPrice !== undefined && (
                  <PriceRow label="Retail price (slashed, USD)" value={b.retailPrice} onSave={(v) => updateRetail(b.id, v)} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProvenanceAdmin() {
  return (
    <div className="space-y-4">
      {/* Episode provenance */}
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-200">Episode Print Provenance</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs text-slate-300">USD price (per episode)</span>
            <span className="text-xs font-semibold text-white">${PRINT_PROVENANCE_PRICE_USD}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-300">KNYT COYN price</span>
            <span className="text-xs font-semibold text-white">{PRINT_PROVENANCE_PRICE_KNYT} KNYT</span>
          </div>
        </div>
      </div>
      {/* GN provenance */}
      <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-200">Graphic Novel Print Provenance</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-xs text-slate-300">USD price (GN)</span>
            <span className="text-xs font-semibold text-amber-300">${GN_PROVENANCE_PRICE_USD}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-300">KNYT COYN price</span>
            <span className="text-xs font-semibold text-amber-300">{GN_PROVENANCE_PRICE_KNYT} KNYT</span>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-500">Edit provenance prices in <code className="bg-slate-800 px-1 rounded">types/knyt-store.ts</code> constants.</p>
    </div>
  );
}

// ── Minting mode admin ────────────────────────────────────────────────────────

const MINTING_SKUS: Array<{ skuId: string; label: string; group: string }> = [
  // Episodes
  { skuId: 'episode_-1', label: 'Graphic Novel (Episode −1)', group: 'Episodes' },
  ...EPISODE_PRICING.filter((ep) => ep.episodeNumber >= 0).map((ep) => ({
    skuId: `episode_${ep.episodeNumber}`,
    label: `Episode ${ep.episodeNumber}`,
    group: 'Episodes',
  })),
  // Bundles
  ...BUNDLE_PRICING.map((b) => ({ skuId: `bundle_${b.id}`, label: b.label, group: 'Bundles' })),
  // Asset classes
  { skuId: 'cards_all', label: 'KNYT Character Cards', group: 'Assets' },
  { skuId: 'qripto_all', label: 'Qripto Collectibles', group: 'Assets' },
];

const MODE_LABELS: Record<MintingMode, string> = {
  immediate: 'Immediate',
  deferred: 'Deferred claim',
  canonical: 'EVM on-chain',
};

const MODE_DESCRIPTIONS: Record<MintingMode, string> = {
  immediate: 'Credit DVN KNYT ledger instantly',
  deferred: 'Issue open claim — persona redeems explicitly',
  canonical: 'Mint EVM KNYT on Ethereum mainnet',
};

function MintingAdmin({ personaId }: { personaId?: string }) {
  const [configs, setConfigs] = useState<Record<string, MintingMode>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/knyt/sku-config');
      const json = await res.json();
      if (json.ok) {
        const map: Record<string, MintingMode> = {};
        for (const row of json.configs ?? []) {
          map[row.sku_id] = row.minting_mode as MintingMode;
        }
        setConfigs(map);
      } else {
        setLoadError(json.error ?? 'Failed to load');
      }
    } catch {
      setLoadError('Network error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setMode = useCallback(async (skuId: string, mode: MintingMode) => {
    setConfigs((prev) => ({ ...prev, [skuId]: mode }));
    setSaving(skuId);
    try {
      await fetch('/api/admin/knyt/sku-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_id: skuId, minting_mode: mode, updated_by: personaId }),
      });
    } finally {
      setSaving(null);
    }
  }, [personaId]);

  const groups = [...new Set(MINTING_SKUS.map((s) => s.group))];

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-3 py-2 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-[10px] text-red-300">{loadError}</p>
            {loadError.toLowerCase().includes('relation') || loadError.toLowerCase().includes('exist') || loadError.toLowerCase().includes('knyt_sku') ? (
              <div className="mt-2">
                <p className="text-[9px] text-slate-400 mb-1">Run this SQL in Supabase to create the missing table:</p>
                <pre className="text-[8px] text-slate-300 bg-slate-900 rounded p-1.5 overflow-x-auto whitespace-pre-wrap select-all">{`CREATE TABLE IF NOT EXISTS public.knyt_sku_config (
  sku_id      text        PRIMARY KEY,
  minting_mode text       NOT NULL DEFAULT 'immediate',
  updated_at  timestamptz,
  updated_by  text
);`}</pre>
              </div>
            ) : null}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-blue-800/30 bg-blue-900/10 px-3 py-2 flex items-start gap-2">
        <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-300">
          <strong>Immediate</strong> — default, DVN ledger credit. <strong>Deferred</strong> — persona must redeem claim.{' '}
          <strong>EVM on-chain</strong> — mints real KNYT on Ethereum mainnet (requires KNYT_MINTER_PRIVATE_KEY).
        </p>
      </div>
      {groups.map((group) => (
        <div key={group} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
          <p className="text-xs font-semibold text-slate-200 mb-3">{group}</p>
          <div className="space-y-2">
            {MINTING_SKUS.filter((s) => s.group === group).map(({ skuId, label }) => {
              const current = configs[skuId] ?? 'immediate';
              return (
                <div key={skuId} className="rounded-lg border border-white/5 bg-slate-800/40 p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium text-slate-300">{label}</p>
                    {saving === skuId && (
                      <span className="text-[9px] text-slate-500 animate-pulse">saving…</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(['immediate', 'deferred', 'canonical'] as MintingMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setMode(skuId, mode)}
                        title={MODE_DESCRIPTIONS[mode]}
                        className={`flex-1 rounded px-1.5 py-1 text-[9px] font-semibold transition-colors ${
                          current === mode
                            ? mode === 'canonical'
                              ? 'bg-amber-600 text-white'
                              : mode === 'deferred'
                              ? 'bg-blue-700 text-white'
                              : 'bg-teal-700 text-white'
                            : 'bg-slate-700/50 text-slate-400 hover:text-white'
                        }`}
                      >
                        {MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function KnytStoreAdminTab({ isAdmin, personaId, theme: _theme }: Props) {
  const [section, setSection] = useState<AdminSection>('overview');
  const subHeaderSlotEl = useContext(SubHeaderSlotContext);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
        <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
        <p className="text-sm text-slate-400">Admin access required.</p>
      </div>
    );
  }

  const sections: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview',   label: 'Overview',   icon: Settings  },
    { id: 'episodes',   label: 'Episodes',   icon: BookOpen  },
    { id: 'bundles',    label: 'Bundles',    icon: Package   },
    { id: 'provenance', label: 'Provenance', icon: BookOpen  },
    { id: 'minting',    label: 'Minting',    icon: Zap       },
  ];

  const sectionPills = (
    <div className="flex gap-1 flex-wrap items-center">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setSection(id)}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
            section === id
              ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200'
              : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {subHeaderSlotEl ? createPortal(sectionPills, subHeaderSlotEl) : (
        <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2">
          {sectionPills}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {section === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-200 mb-3">Pricing Summary</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Episodes in catalog', value: String(EPISODE_PRICING.length) },
                  { label: 'Bundle SKUs', value: String(BUNDLE_PRICING.length) },
                  { label: 'Investor bundles', value: String(BUNDLE_PRICING.filter((b) => b.isInvestorOnly).length) },
                  { label: 'KNYT COYN discount', value: `${Math.round(KNYT_COYN_DISCOUNT * 100)}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-white/5 bg-slate-800/50 p-2.5">
                    <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
                    <p className="text-lg font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 text-center">Select a section above to edit prices.</p>
          </div>
        )}
        {section === 'episodes'   && <EpisodesAdmin />}
        {section === 'bundles'    && <BundlesAdmin />}
        {section === 'provenance' && <ProvenanceAdmin />}
        {section === 'minting'    && <MintingAdmin personaId={personaId} />}
      </div>
    </div>
  );
}
