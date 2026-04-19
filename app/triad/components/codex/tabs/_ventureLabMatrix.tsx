'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Venture, IndustryOverlay,
  Y_LABELS, X_LABELS, computeZone, ZONE_STYLE,
  GOLDEN_PATH, OVERLAY_ZONE, ZONE_NBA,
} from './_ventureLabData';

// ── Add Venture Modal ─────────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onSave: (v: { venture_name: string; venture_slug: string; y_maturity: number; x_commercialization: number; payload: Record<string, unknown> }) => Promise<void>;
  preY?: number;
  preX?: number;
}

export function AddVentureModal({ onClose, onSave, preY, preX }: AddModalProps) {
  const [name,  setName]  = useState('');
  const [slug,  setSlug]  = useState('');
  const [y,     setY]     = useState(preY ?? 1);
  const [x,     setX]     = useState(preX ?? 1);
  const [desc,  setDesc]  = useState('');
  const [tags,  setTags]  = useState('');
  const [saving,setSaving]= useState(false);

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
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none" />
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

interface MatrixViewProps {
  ventures: Venture[];
  overlay: IndustryOverlay;
  showGoldenPath: boolean;
  isAdmin?: boolean;
  onAdd: (y: number, x: number) => void;
  onSeedSamples: () => void;
}

export function MatrixView({ ventures, overlay, showGoldenPath, isAdmin, onAdd, onSeedSamples }: MatrixViewProps) {
  const [selCell, setSelCell]       = useState<{ y: number; x: number } | null>(null);
  const [selVenture, setSelVenture] = useState<Venture | null>(null);

  const cellVentures = (y: number, x: number) => ventures.filter(v => v.y_maturity === y && v.x_commercialization === x);

  const handleCell = (y: number, x: number) => {
    if (selCell?.y === y && selCell?.x === x) { setSelCell(null); setSelVenture(null); }
    else { setSelCell({ y, x }); setSelVenture(null); }
  };

  return (
    <div className="flex gap-4 p-4 overflow-auto">

      {/* Grid */}
      <div className="flex-1 min-w-0">
        {/* X-axis header */}
        <div className="flex mb-1 ml-[88px]">
          {X_LABELS.map(col => (
            <div key={col.n} className="flex-1 text-center">
              <div className="text-[10px] font-semibold text-slate-400 truncate px-0.5">{col.label}</div>
              <div className="text-[9px] text-slate-600">X{col.n}</div>
            </div>
          ))}
        </div>

        {/* Rows Y7→Y1 */}
        {Y_LABELS.map(row => (
          <div key={row.n} className="flex items-stretch gap-0 mb-1">
            {/* Y label */}
            <div className="w-[88px] flex-shrink-0 flex flex-col justify-center pr-2 text-right">
              <div className="text-[10px] font-semibold text-slate-400 leading-tight">{row.label}</div>
              <div className="text-[9px] text-slate-600">Y{row.n}</div>
            </div>

            {/* Cells */}
            {X_LABELS.map(col => {
              const zone  = computeZone(row.n, col.n);
              const zs    = ZONE_STYLE[zone];
              const cvs   = cellVentures(row.n, col.n);
              const isSel = selCell?.y === row.n && selCell?.x === col.n;
              const isGP  = showGoldenPath && GOLDEN_PATH.has(`${row.n},${col.n}`);

              return (
                <div
                  key={col.n}
                  onClick={() => handleCell(row.n, col.n)}
                  className={`flex-1 min-h-[52px] border rounded-sm cursor-pointer transition-all relative group
                    ${zs.bg} ${zs.border}
                    ${isSel ? `ring-1 ${zs.ring} ring-inset` : 'hover:ring-1 hover:ring-white/20 hover:ring-inset'}`}
                >
                  {/* Venture dots */}
                  <div className="absolute inset-0 flex flex-wrap gap-[3px] p-1.5 content-start">
                    {cvs.map(v => (
                      <button key={v.id} onClick={e => { e.stopPropagation(); setSelVenture(v); setSelCell({ y: row.n, x: col.n }); }}
                        title={v.venture_name}
                        className={`w-2 h-2 rounded-full ${zs.dot} hover:scale-150 transition-transform z-10`} />
                    ))}
                  </div>

                  {/* Golden path marker */}
                  {isGP && (
                    <div className="absolute top-0.5 right-0.5 text-amber-400/60 text-[8px] leading-none select-none">◆</div>
                  )}

                  {/* Add on hover (admin, empty cell) */}
                  {isAdmin && cvs.length === 0 && (
                    <button onClick={e => { e.stopPropagation(); onAdd(row.n, col.n); }}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3 h-3 text-slate-500" />
                    </button>
                  )}

                  {/* Coord */}
                  <div className="absolute bottom-0.5 right-1 text-[7px] text-slate-700">{col.n},{row.n}</div>
                </div>
              );
            })}
          </div>
        ))}

        {/* X axis label */}
        <div className="mt-1 ml-[88px] text-center text-[10px] text-slate-600 tracking-wide">← Commercialization Strength →</div>
      </div>

      {/* Detail panel */}
      {(selCell || selVenture) && (
        <div className="w-60 flex-shrink-0 bg-slate-900/60 border border-white/[0.07] rounded-xl p-4 flex flex-col gap-3 self-start">
          {selVenture ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100 leading-tight">{selVenture.venture_name}</p>
                  <p className={`text-[10px] mt-0.5 capitalize ${ZONE_STYLE[selVenture.zone]?.label}`}>
                    Y{selVenture.y_maturity} · X{selVenture.x_commercialization} · {selVenture.zone}
                  </p>
                </div>
                <button onClick={() => setSelVenture(null)} className="text-slate-600 hover:text-slate-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              {selVenture.payload?.description && <p className="text-xs text-slate-400 leading-relaxed">{selVenture.payload.description}</p>}
              {/* Overlay context for this venture's zone */}
              {(() => { const ctx = OVERLAY_ZONE[overlay]?.[selVenture.zone]; return ctx ? (
                <div className="bg-black/20 rounded-lg p-2.5 space-y-1">
                  <p className={`text-[10px] font-medium ${ZONE_STYLE[selVenture.zone]?.label}`}>{ctx.title}</p>
                  <p className="text-[10px] text-slate-400">{ctx.milestone}</p>
                </div>
              ) : null; })()}
              {/* NBA */}
              {(() => { const nba = ZONE_NBA[selVenture.zone]; return nba ? (
                <p className="text-[10px] text-slate-400 leading-relaxed"><span className="text-slate-500">NBA: </span>{nba.action}</p>
              ) : null; })()}
              {Array.isArray(selVenture.payload?.tags) && (selVenture.payload.tags as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(selVenture.payload.tags as string[]).map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">{t}</span>
                  ))}
                </div>
              )}
            </>
          ) : selCell ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    {Y_LABELS.find(r => r.n === selCell.y)?.label} × {X_LABELS.find(c => c.n === selCell.x)?.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 capitalize ${ZONE_STYLE[computeZone(selCell.y, selCell.x)]?.label}`}>
                    {computeZone(selCell.y, selCell.x)} zone
                  </p>
                </div>
                <button onClick={() => setSelCell(null)} className="text-slate-600 hover:text-slate-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              {/* Overlay context for cell */}
              {(() => { const z = computeZone(selCell.y, selCell.x); const ctx = OVERLAY_ZONE[overlay]?.[z]; return ctx ? (
                <div className="bg-black/20 rounded-lg p-2.5 space-y-1">
                  <p className={`text-[10px] font-medium ${ZONE_STYLE[z]?.label}`}>{ctx.title}</p>
                  <p className="text-[10px] text-slate-400">{ctx.milestone}</p>
                  <p className="text-[10px] text-slate-500">KPI: {ctx.kpi}</p>
                </div>
              ) : null; })()}
              {/* Ventures in cell */}
              {cellVentures(selCell.y, selCell.x).length === 0
                ? <p className="text-xs text-slate-600 italic">No ventures plotted here.</p>
                : cellVentures(selCell.y, selCell.x).map(v => (
                    <button key={v.id} onClick={() => setSelVenture(v)}
                      className="text-left px-2.5 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-all">
                      <p className="text-xs font-medium text-slate-200">{v.venture_name}</p>
                      {v.payload?.description && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{String(v.payload.description)}</p>}
                    </button>
                  ))}
              {isAdmin && (
                <button onClick={() => onAdd(selCell.y, selCell.x)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-white/10 text-xs text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all">
                  <Plus className="w-3 h-3" />Add venture here
                </button>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Empty state */}
      {ventures.length === 0 && !selCell && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto">
            <p className="text-sm text-slate-500 mb-3">No ventures plotted yet.</p>
            <button onClick={onSeedSamples}
              className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-sm transition-all">
              Load Sample Ventures (MetaKnyt + MetaIye)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
