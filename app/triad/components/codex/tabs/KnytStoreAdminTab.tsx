'use client';

import React, { useState } from 'react';
import { AlertCircle, BookOpen, Package, Save, Settings } from 'lucide-react';
import {
  EPISODE_PRICING,
  BUNDLE_PRICING,
  KNYT_CARDS_PRICING,
  KNYT_COYN_DISCOUNT,
  PRINT_PROVENANCE_PRICE_USD,
  PRINT_PROVENANCE_PRICE_KNYT,
  type EpisodePricing,
  type BundlePricing,
} from '@/types/knyt-store';

interface Props {
  isAdmin?: boolean;
  theme?: 'light' | 'dark';
}

type AdminSection = 'overview' | 'episodes' | 'bundles' | 'cards' | 'provenance';

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

  const update = (id: string, val: number) => {
    setBundles((prev) => prev.map((b) => b.id === id ? { ...b, digitalPrice: val } : b));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-3 py-2 flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300">Changes are local to this session. Backend price sync is not yet wired.</p>
      </div>
      {bundles.map((b) => (
        <div key={b.id} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-200 flex-1">{b.label}</p>
            {b.isInvestorOnly && (
              <span className="text-[9px] font-medium text-yellow-500 border border-yellow-700/30 rounded px-1.5">Investor</span>
            )}
            {b.isLimited && b.limitedSupply && (
              <span className="text-[9px] font-medium text-red-400 border border-red-700/30 rounded px-1.5">Lim. {b.limitedSupply}</span>
            )}
          </div>
          <PriceRow label="Digital price" value={b.digitalPrice} onSave={(v) => update(b.id, v)} />
        </div>
      ))}
    </div>
  );
}

function ProvenanceAdmin() {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-200">Print Provenance Pricing</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <span className="text-xs text-slate-300">USD price</span>
          <span className="text-xs font-semibold text-white">${PRINT_PROVENANCE_PRICE_USD}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-slate-300">KNYT COYN price</span>
          <span className="text-xs font-semibold text-white">{PRINT_PROVENANCE_PRICE_KNYT} KNYT</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-500">Edit provenance prices in <code className="bg-slate-800 px-1 rounded">types/knyt-store.ts</code> constants.</p>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function KnytStoreAdminTab({ isAdmin, theme: _theme }: Props) {
  const [section, setSection] = useState<AdminSection>('overview');

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
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        <Settings className="h-4 w-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">Store Admin</span>
      </div>

      {/* Section tabs */}
      <div className="flex-shrink-0 flex border-b border-slate-800/60 overflow-x-auto">
        {sections.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              section === id
                ? 'border-b-2 border-indigo-400 text-indigo-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
      </div>
    </div>
  );
}
