'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Venture, IndustryOverlay,
  Y_LABELS, X_LABELS, computeZone, ZONE_STYLE,
  GOLDEN_PATH, OVERLAY_ZONE, ZONE_NBA, CELL_LABEL,
} from './_ventureLabData';

// ── Add Venture Modal ─────────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onSave: (v: { venture_name: string; venture_slug: string; y_maturity: number; x_commercialization: number; payload: Record<string, unknown> }) => Promise<void>;
  preY?: number;
  preX?: number;
}

export function AddVentureModal({ onClose, onSave, preY, preX }: AddModalProps) {
  const [name,   setName]  = useState('');
  const [slug,   setSlug]  = useState('');
  const [y,      setY]     = useState(preY ?? 1);
  const [x,      setX]     = useState(preX ?? 1);
  const [desc,   setDesc]  = useState('');
  const [tags,   setTags]  = useState('');
  const [saving, setSaving]= useState(false);

  const handleName = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      venture_name: name.trim(),
      venture_slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      y_maturity: y,
      x_commercialization: x,
      payload: { description: desc, tags: tags.split(',').map(t => t.trim()).filter(Boolean) },
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-100">Add Venture to Matrix</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Venture name</label>
            <input value={name} onChange={e => handleName(e.target.value)} placeholder="e.g. MetaKnyt"
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Slug</label>
            <input value={slug} onChange={e => setSlug(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-400 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Maturity Y (1–7)</label>
              <select value={y} onChange={e => setY(Number(e.target.value))}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none">
                {[...Y_LABELS].reverse().map(r => <option key={r.n} value={r.n}>{r.n} — {r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Commercial X (1–7)</label>
              <select value={x} onChange={e => setX(Number(e.target.value))}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none">
                {X_LABELS.map(c => <option key={c.n} value={c.n}>{c.n} — {c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="media, web3, ip"
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving}
              className="flex-1 py-2 rounded-lg text-sm bg-amber-600/80 hover:bg-amber-500/80 text-white font-medium transition-all disabled:opacity-50">
              {saving ? 'Saving…' : 'Add to Matrix'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Matrix View ───────────────────────────────────────────────────────────────
// Cells show named prescriptions (like studio matrix).
// Color coding: emerald=golden path, amber=apex, blue=off-diagonal, slate=empty.
// Venture count badge on cells that have ventures.
// Click cell → popup with full prescription + ventures.

interface MatrixViewProps {
  ventures: Venture[];
  overlay: IndustryOverlay;
  showGoldenPath: boolean;
  isAdmin?: boolean;
  onAdd: (y: number, x: number) => void;
  onSeedSamples: () => void;
}

export function MatrixView({ ventures, overlay, showGoldenPath, isAdmin, onAdd, onSeedSamples }: MatrixViewProps) {
  const [popup, setPopup] = useState<string | null>(null); // key = `${y},${x}`

  const cellVentures = (y: number, x: number) =>
    ventures.filter(v => v.y_maturity === y && v.x_commercialization === x);

  const yNorm = (y: number) => (y - 1) / 6;
  const xNorm = (x: number) => (x - 1) / 6;
  const isOnDiagonal = (y: number, x: number) =>
    showGoldenPath ? GOLDEN_PATH.has(`${y},${x}`) : Math.abs(yNorm(y) - xNorm(x)) <= 0.28;
  const isApex = (y: number, x: number) => y >= 6 && x >= 6;

  return (
    <div className="p-4 overflow-auto">
      <div style={{ minWidth: `${88 + X_LABELS.length * 80}px` }}>

        {/* Header row: ENGAGEMENT label + X-axis headers */}
        <div className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: `88px repeat(${X_LABELS.length}, 1fr)` }}>
          <div className="text-[10px] text-slate-600 self-end pb-0.5">
            <span className="block text-slate-700">MATURITY ↑</span>
            <span className="text-[9px]">Y \ X</span>
          </div>
          {X_LABELS.map(col => (
            <div key={col.n} className="text-center pb-0.5">
              <div className={`text-[10px] font-semibold truncate px-0.5 ${col.n >= 6 ? 'text-amber-400/70' : 'text-slate-400'}`}>{col.label}</div>
              <div className="text-[9px] text-slate-600">{col.n}</div>
            </div>
          ))}
        </div>

        {/* X-axis label */}
        <div className="text-right pr-2 mb-1">
          <span className="text-[9px] text-slate-700">COMMERCIALIZATION → &nbsp; goal: top-right ★</span>
        </div>

        {/* Grid rows Y7→Y1 */}
        <div className="space-y-0.5">
          {Y_LABELS.map(row => (
            <div key={row.n} className="grid gap-0.5" style={{ gridTemplateColumns: `88px repeat(${X_LABELS.length}, 1fr)` }}>
              {/* Y-axis label */}
              <div className={`flex items-center pr-2 text-right ${row.n >= 6 ? 'text-amber-400/80' : 'text-slate-400'}`}>
                <div className="w-full">
                  <div className="text-[10px] font-semibold truncate leading-tight">{row.label}</div>
                  <div className="text-[9px] text-slate-600">Y{row.n}</div>
                </div>
              </div>

              {/* Cells */}
              {X_LABELS.map(col => {
                const key       = `${row.n},${col.n}`;
                const label     = CELL_LABEL[key] ?? '';
                const cvs       = cellVentures(row.n, col.n);
                const count     = cvs.length;
                const apex      = isApex(row.n, col.n);
                const diagonal  = isOnDiagonal(row.n, col.n);
                const hasLabel  = !!label;
                const isPopup   = popup === key;

                // Cell color: apex > diagonal (golden path) > off-diagonal > empty
                const cellClass = apex && hasLabel
                  ? 'border-amber-500/40 bg-amber-500/8 text-amber-200 cursor-pointer hover:ring-1 hover:ring-amber-400/30'
                  : hasLabel && diagonal
                    ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300 cursor-pointer hover:ring-1 hover:ring-emerald-400/30'
                    : hasLabel
                      ? 'border-blue-500/20 bg-blue-500/5 text-blue-300 cursor-pointer hover:ring-1 hover:ring-blue-400/20'
                      : 'border-slate-800/30 bg-slate-950/30 text-slate-800 cursor-default';

                return (
                  <div key={col.n} className="relative">
                    <button
                      type="button"
                      onClick={() => hasLabel && setPopup(isPopup ? null : key)}
                      className={`w-full rounded border px-0.5 py-1.5 text-center text-[11px] leading-tight font-medium transition-all ${cellClass}`}
                      title={`${row.label} × ${col.label}${label ? ` — ${label}` : ''}${count ? ` · ${count} venture${count > 1 ? 's' : ''}` : ''}`}
                    >
                      {hasLabel ? label : '·'}
                    </button>

                    {/* Venture count badge */}
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1 text-[8px] font-bold leading-[14px] rounded-full px-1 min-w-[14px] text-center bg-rose-500/80 text-white z-10">
                        {count}
                      </span>
                    )}

                    {/* Golden path marker */}
                    {showGoldenPath && GOLDEN_PATH.has(key) && (
                      <span className="absolute top-0.5 left-0.5 text-amber-400/50 text-[7px] leading-none select-none">◆</span>
                    )}

                    {/* Popup */}
                    {isPopup && (
                      <div className="absolute z-20 bottom-full mb-1 left-1/2 -translate-x-1/2 w-56 rounded-lg border border-white/10 bg-slate-900/98 px-3 py-2.5 shadow-xl backdrop-blur-sm">
                        <button onClick={() => setPopup(null)} className="absolute top-1.5 right-1.5 text-slate-600 hover:text-slate-300">
                          <X className="w-3 h-3" />
                        </button>
                        <div className={`text-[10px] font-semibold mb-1 ${
                          apex ? 'text-amber-300' : diagonal ? 'text-emerald-300' : 'text-blue-300'
                        }`}>
                          Y{row.n} {row.label} × X{col.n} {col.label}
                        </div>
                        <p className="text-xs text-slate-200 font-medium mb-1">{label}</p>
                        {/* Overlay context */}
                        {(() => {
                          const zone = computeZone(row.n, col.n);
                          const ctx  = OVERLAY_ZONE[overlay]?.[zone];
                          const nba  = ZONE_NBA[zone];
                          return (
                            <div className="space-y-1">
                              {ctx && <p className="text-[10px] text-slate-400">{ctx.milestone}</p>}
                              {nba && <p className="text-[10px] text-slate-500 italic">{nba.action.slice(0, 80)}…</p>}
                            </div>
                          );
                        })()}
                        {/* Ventures */}
                        {cvs.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {cvs.map(v => (
                              <span key={v.id} className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/20">
                                {v.venture_name}
                              </span>
                            ))}
                          </div>
                        )}
                        {isAdmin && (
                          <button onClick={() => { setPopup(null); onAdd(row.n, col.n); }}
                            className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded border border-dashed border-white/10 text-[10px] text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all">
                            <Plus className="w-2.5 h-2.5" />Add venture here
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-600">
          <span><span className="text-emerald-400">■</span> optimal path</span>
          <span><span className="text-blue-400">■</span> off-diagonal</span>
          <span><span className="text-amber-400">■</span> apex zone</span>
          <span><span className="text-slate-700">·</span> no prescription</span>
          {showGoldenPath && <span><span className="text-amber-400/50">◆</span> golden path</span>}
          <span className="ml-auto text-slate-500">click cell for prescription</span>
        </div>
      </div>

      {/* Empty state */}
      {ventures.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 mb-3">No ventures plotted yet.</p>
          <button onClick={onSeedSamples}
            className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-sm transition-all">
            Load Sample Ventures (MetaKnyt + MetaIye)
          </button>
        </div>
      )}
    </div>
  );
}
