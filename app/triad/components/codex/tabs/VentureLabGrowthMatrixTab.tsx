'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Grid3x3, Briefcase, Layers, Scale, BookOpen, RefreshCw, Plus, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Venture {
  id: string;
  venture_name: string;
  venture_slug: string;
  y_maturity: number;
  x_commercialization: number;
  zone: string;
  status: string;
  payload: Record<string, unknown>;
}

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
}

// ── Static matrix cell content — 7×7 ─────────────────────────────────────────

const Y_LABELS = [
  { n: 7, label: 'Scale',          sub: 'Growth & expansion' },
  { n: 6, label: 'Market Fit',     sub: 'PMF confirmed' },
  { n: 5, label: 'Early Revenue',  sub: 'First customers' },
  { n: 4, label: 'Build',          sub: 'MVP in market' },
  { n: 3, label: 'Prototype',      sub: 'Proof of concept' },
  { n: 2, label: 'Validate',       sub: 'Hypothesis testing' },
  { n: 1, label: 'Ideation',       sub: 'Concept formation' },
];

const X_LABELS = [
  { n: 1, label: 'Pre-Market',     sub: 'No commercial activity' },
  { n: 2, label: 'Positioning',    sub: 'Market research' },
  { n: 3, label: 'Early Sales',    sub: 'First deals' },
  { n: 4, label: 'Growing',        sub: 'Repeatable sales' },
  { n: 5, label: 'Scaling',        sub: 'Expanding channels' },
  { n: 6, label: 'Dominant',       sub: 'Category leader' },
  { n: 7, label: 'Market Leader',  sub: 'Platform position' },
];

// Overlays: Generic | Media | Legal (vertical columns)
const OVERLAYS = [
  { id: 'generic', label: 'Generic',  xRange: [1, 3] as [number, number] },
  { id: 'media',   label: 'Media',    xRange: [3, 5] as [number, number] },
  { id: 'legal',   label: 'Legal',    xRange: [5, 7] as [number, number] },
];

function computeZone(y: number, x: number): string {
  const sum = y + x;
  if (sum <= 4)  return 'formation';
  if (sum <= 7)  return 'validation';
  if (sum <= 10) return 'activation';
  if (sum <= 12) return 'strategic';
  return 'scale';
}

// Zone styles — match studio matrix colors
const ZONE_STYLES: Record<string, { bg: string; border: string; label: string; dot: string }> = {
  formation: {
    bg:     'bg-slate-800/40',
    border: 'border-slate-600/30',
    label:  'text-slate-400',
    dot:    'bg-slate-400',
  },
  validation: {
    bg:     'bg-blue-900/30',
    border: 'border-blue-500/20',
    label:  'text-blue-300',
    dot:    'bg-blue-400',
  },
  activation: {
    bg:     'bg-emerald-900/30',
    border: 'border-emerald-500/20',
    label:  'text-emerald-300',
    dot:    'bg-emerald-400',
  },
  strategic: {
    bg:     'bg-amber-900/30',
    border: 'border-amber-500/20',
    label:  'text-amber-300',
    dot:    'bg-amber-400',
  },
  scale: {
    bg:     'bg-violet-900/30',
    border: 'border-violet-500/20',
    label:  'text-violet-300',
    dot:    'bg-violet-400',
  },
};

// ── Add Venture Modal ─────────────────────────────────────────────────────────

interface AddVentureModalProps {
  onClose: () => void;
  onSave: (v: { venture_name: string; venture_slug: string; y_maturity: number; x_commercialization: number; payload: Record<string, unknown> }) => void;
  preselect?: { y: number; x: number };
}

function AddVentureModal({ onClose, onSave, preselect }: AddVentureModalProps) {
  const [name, setName]     = useState('');
  const [slug, setSlug]     = useState('');
  const [y, setY]           = useState(preselect?.y ?? 1);
  const [x, setX]           = useState(preselect?.x ?? 1);
  const [desc, setDesc]     = useState('');
  const [tags, setTags]     = useState('');
  const [saving, setSaving] = useState(false);

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
      payload: {
        description: desc,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      },
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-100">Add Venture to Matrix</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Venture name</label>
            <input
              value={name}
              onChange={e => handleName(e.target.value)}
              placeholder="e.g. KNYT Collector OS"
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Slug</label>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-400 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Maturity (Y: 1–7)</label>
              <select
                value={y}
                onChange={e => setY(Number(e.target.value))}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
              >
                {Y_LABELS.slice().reverse().map(r => (
                  <option key={r.n} value={r.n}>{r.n} — {r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Commercial (X: 1–7)</label>
              <select
                value={x}
                onChange={e => setX(Number(e.target.value))}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
              >
                {X_LABELS.map(c => (
                  <option key={c.n} value={c.n}>{c.n} — {c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="media, web3, ai"
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 py-2 rounded-lg text-sm bg-amber-600/80 hover:bg-amber-500/80 text-white font-medium transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add to Matrix'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function VentureLabGrowthMatrixTab({ theme: _theme, isAdmin }: Props) {
  const [ventures, setVentures]         = useState<Venture[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ y: number; x: number } | null>(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [addPreselect, setAddPreselect] = useState<{ y: number; x: number } | undefined>();
  const [selectedVenture, setSelectedVenture] = useState<Venture | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/venture-lab/portfolio?status=active');
      const data = await res.json();
      if (data.ok) setVentures(data.ventures ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddVenture = async (v: Parameters<AddVentureModalProps['onSave']>[0]) => {
    const res = await fetch('/api/venture-lab/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    });
    const data = await res.json();
    if (data.ok) {
      setVentures(prev => [...prev, data.venture]);
      setShowAdd(false);
    }
  };

  const cellVentures = (y: number, x: number) =>
    ventures.filter(v => v.y_maturity === y && v.x_commercialization === x);

  const handleCellClick = (y: number, x: number) => {
    if (selectedCell?.y === y && selectedCell?.x === x) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ y, x });
      setSelectedVenture(null);
    }
  };

  const openAddFor = (y: number, x: number) => {
    setAddPreselect({ y, x });
    setShowAdd(true);
  };

  // Overlay x-range check
  const inOverlay = (x: number) => {
    if (!activeOverlay) return true;
    const ov = OVERLAYS.find(o => o.id === activeOverlay);
    if (!ov) return true;
    return x >= ov.xRange[0] && x <= ov.xRange[1];
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
        <Grid3x3 className="w-4 h-4 text-amber-400/80 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-100 leading-tight">Venture Growth Matrix</h2>
          <p className="text-xs text-slate-500 mt-0.5">7×7 · Y = Development Maturity · X = Commercialization Strength</p>
        </div>

        {/* Overlay filters */}
        <div className="flex items-center gap-1">
          {OVERLAYS.map(ov => (
            <button
              key={ov.id}
              onClick={() => setActiveOverlay(prev => prev === ov.id ? null : ov.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeOverlay === ov.id
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              {ov.label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {isAdmin && (
          <button
            onClick={() => { setAddPreselect(undefined); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Venture
          </button>
        )}
      </div>

      {/* Zone legend */}
      <div className="flex-shrink-0 px-5 py-2 border-b border-white/[0.04] flex items-center gap-4">
        {Object.entries(ZONE_STYLES).map(([zone, s]) => (
          <div key={zone} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className={`text-xs capitalize ${s.label}`}>{zone}</span>
          </div>
        ))}
      </div>

      {/* Matrix grid + detail panel */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="flex gap-4">

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {/* X-axis header */}
            <div className="flex mb-1 ml-[80px]">
              {X_LABELS.map(col => (
                <div
                  key={col.n}
                  className={`flex-1 text-center transition-opacity ${!inOverlay(col.n) ? 'opacity-20' : ''}`}
                >
                  <div className="text-[10px] font-semibold text-slate-400">{col.label}</div>
                  <div className="text-[9px] text-slate-600">{col.n}</div>
                </div>
              ))}
            </div>

            {/* Rows (Y7 → Y1) */}
            {Y_LABELS.map(row => (
              <div key={row.n} className="flex items-stretch gap-0 mb-1">
                {/* Y-axis label */}
                <div className="w-[80px] flex-shrink-0 flex flex-col justify-center pr-2 text-right">
                  <div className="text-[10px] font-semibold text-slate-400 leading-tight">{row.label}</div>
                  <div className="text-[9px] text-slate-600">Y{row.n}</div>
                </div>

                {/* Cells */}
                {X_LABELS.map(col => {
                  const zone  = computeZone(row.n, col.n);
                  const zs    = ZONE_STYLES[zone];
                  const cvs   = cellVentures(row.n, col.n);
                  const isSel = selectedCell?.y === row.n && selectedCell?.x === col.n;
                  const dimmed = !inOverlay(col.n);

                  return (
                    <div
                      key={col.n}
                      onClick={() => handleCellClick(row.n, col.n)}
                      className={`
                        flex-1 min-h-[52px] border rounded-sm cursor-pointer
                        transition-all duration-150 relative group
                        ${zs.bg} ${zs.border}
                        ${dimmed ? 'opacity-20 pointer-events-none' : ''}
                        ${isSel ? 'ring-1 ring-amber-400/60 ring-inset' : 'hover:ring-1 hover:ring-white/20 hover:ring-inset'}
                      `}
                    >
                      {/* Venture dots */}
                      <div className="absolute inset-0 flex flex-wrap gap-[3px] p-1.5 content-start">
                        {cvs.map(v => (
                          <button
                            key={v.id}
                            onClick={e => { e.stopPropagation(); setSelectedVenture(v); setSelectedCell({ y: row.n, x: col.n }); }}
                            title={v.venture_name}
                            className={`w-2 h-2 rounded-full ${zs.dot} hover:scale-150 transition-transform z-10`}
                          />
                        ))}
                      </div>

                      {/* Add on hover (admin only) */}
                      {isAdmin && cvs.length === 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); openAddFor(row.n, col.n); }}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="w-3 h-3 text-slate-400" />
                        </button>
                      )}

                      {/* Coord */}
                      <div className="absolute bottom-0.5 right-1 text-[8px] text-slate-700">
                        {col.n},{row.n}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* X-axis label */}
            <div className="mt-2 ml-[80px] text-center text-[10px] text-slate-600 tracking-wide">
              ← Commercialization Strength →
            </div>
          </div>

          {/* Detail panel */}
          {(selectedCell || selectedVenture) && (
            <div className="w-64 flex-shrink-0 bg-slate-900/60 border border-white/[0.07] rounded-xl p-4 flex flex-col gap-3 self-start">
              {selectedVenture ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100 leading-tight">{selectedVenture.venture_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Y{selectedVenture.y_maturity} · X{selectedVenture.x_commercialization} · <span className={`capitalize ${ZONE_STYLES[selectedVenture.zone]?.label}`}>{selectedVenture.zone}</span>
                      </p>
                    </div>
                    <button onClick={() => setSelectedVenture(null)} className="text-slate-600 hover:text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedVenture.payload?.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">{String(selectedVenture.payload.description)}</p>
                  )}
                  {Array.isArray(selectedVenture.payload?.tags) && (selectedVenture.payload.tags as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(selectedVenture.payload.tags as string[]).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">{tag}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : selectedCell ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-300">
                        {Y_LABELS.find(r => r.n === selectedCell.y)?.label} × {X_LABELS.find(c => c.n === selectedCell.x)?.label}
                      </p>
                      <p className={`text-xs mt-0.5 capitalize ${ZONE_STYLES[computeZone(selectedCell.y, selectedCell.x)]?.label}`}>
                        {computeZone(selectedCell.y, selectedCell.x)} zone
                      </p>
                    </div>
                    <button onClick={() => setSelectedCell(null)} className="text-slate-600 hover:text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {cellVentures(selectedCell.y, selectedCell.x).length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No ventures plotted here yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {cellVentures(selectedCell.y, selectedCell.x).map(v => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVenture(v)}
                          className="text-left px-2.5 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition-all"
                        >
                          <p className="text-xs font-medium text-slate-200">{v.venture_name}</p>
                          {v.payload?.description && (
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{String(v.payload.description)}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => openAddFor(selectedCell.y, selectedCell.x)}
                      className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-white/10 text-xs text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Add venture here
                    </button>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Ventures list — only when no cell selected */}
        {!selectedCell && ventures.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-slate-500 mb-3 font-medium">All ventures ({ventures.length})</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {ventures.map(v => {
                const zs = ZONE_STYLES[v.zone] ?? ZONE_STYLES.formation;
                return (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedCell({ y: v.y_maturity, x: v.x_commercialization }); setSelectedVenture(v); }}
                    className={`text-left px-3 py-2.5 rounded-lg border ${zs.border} ${zs.bg} hover:ring-1 hover:ring-white/10 transition-all`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${zs.dot}`} />
                      <p className="text-xs font-medium text-slate-200 leading-tight truncate">{v.venture_name}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 pl-4">
                      Y{v.y_maturity} · X{v.x_commercialization} · <span className={`capitalize ${zs.label}`}>{v.zone}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!loading && ventures.length === 0 && (
          <div className="mt-10 text-center">
            <Grid3x3 className="w-8 h-8 mx-auto mb-3 text-slate-700" />
            <p className="text-sm text-slate-500">No ventures plotted yet.</p>
            {isAdmin && (
              <button
                onClick={() => { setAddPreselect(undefined); setShowAdd(true); }}
                className="mt-3 px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-sm transition-all"
              >
                Add the first venture
              </button>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <AddVentureModal
          onClose={() => setShowAdd(false)}
          onSave={handleAddVenture}
          preselect={addPreselect}
        />
      )}
    </div>
  );
}
