'use client';

import React, { useState } from 'react';
import { ChevronRight, Save, X } from 'lucide-react';
import {
  Venture, IndustryOverlay,
  Y_LABELS, X_LABELS, computeZone, ZONE_STYLE,
  OVERLAY_ZONE, Y_INSIGHT, X_INSIGHT, ZONE_NBA, CELL_LABEL,
} from './_ventureLabData';

// ── Ladder View ───────────────────────────────────────────────────────────────
// Matches the studio ladder pattern: click row (Y) → emerald highlight,
// click column (X) → amber highlight, intersection = amber box + detail below.

interface LadderViewProps {
  ventures: Venture[];
  overlay: IndustryOverlay;
}

export function LadderView({ ventures, overlay }: LadderViewProps) {
  const [selY, setSelY] = useState<number | null>(null);
  const [selX, setSelX] = useState<number | null>(null);

  // Plot ventures on the grid (parity with the Matrix tab): map each cell to
  // the ventures sitting at that maturity × commercialization position.
  const venturesByCell = React.useMemo(() => {
    const m = new Map<string, Venture[]>();
    for (const v of ventures) {
      const k = `${v.y_maturity},${v.x_commercialization}`;
      const arr = m.get(k) ?? [];
      arr.push(v);
      m.set(k, arr);
    }
    return m;
  }, [ventures]);

  // Y rendered top-to-bottom as Y7 → Y1
  const yRows = [...Y_LABELS]; // already Y7..Y1

  const selectedXLabel = selX !== null ? X_LABELS.find(c => c.n === selX) : null;
  const selectedYLabel = selY !== null ? Y_LABELS.find(r => r.n === selY) : null;
  const intersectionZone = selY !== null && selX !== null ? computeZone(selY, selX) : null;
  const intersectionKey  = selY !== null && selX !== null ? `${selY},${selX}` : null;
  const intersectionLabel = intersectionKey ? (CELL_LABEL[intersectionKey] ?? '—') : null;
  const atIntersection = selY !== null && selX !== null
    ? ventures.filter(v => v.y_maturity === selY && v.x_commercialization === selX)
    : [];

  return (
    <div className="p-4 space-y-3">
      <div className="text-[10px] text-slate-600">
        Click a row (Y) to select maturity level · Click a column (X) to select commercialization stage · their intersection shows the prescription
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${88 + X_LABELS.length * 80}px` }}>

          {/* X-axis column headers */}
          <div className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: `88px repeat(${X_LABELS.length}, 1fr)` }}>
            <div className="text-[10px] text-slate-600 self-end pb-0.5 pl-1">Y \ X</div>
            {X_LABELS.map(col => {
              const isApex   = col.n >= 6;
              const isSel    = selX === col.n;
              return (
                <button
                  key={col.n}
                  type="button"
                  onClick={() => setSelX(isSel ? null : col.n)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                    isSel
                      ? isApex
                        ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                        : 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                      : isApex
                        ? 'border-amber-500/20 bg-amber-500/5 text-amber-400/60 hover:border-amber-500/40'
                        : 'border-slate-800 bg-slate-900/20 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                  }`}
                >
                  <span className={`text-[8px] font-bold ${isApex ? 'text-amber-400' : 'text-slate-600'}`}>{col.n}</span>
                  <span className="text-xs leading-tight truncate w-full">{col.label}</span>
                </button>
              );
            })}
          </div>

          {/* Grid rows */}
          <div className="space-y-0.5">
            {yRows.map((row, yi) => {
              const isSelY  = selY === row.n;
              const isApexY = row.n >= 6;
              return (
                <div key={row.n} className="grid gap-0.5" style={{ gridTemplateColumns: `88px repeat(${X_LABELS.length}, 1fr)` }}>
                  {/* Row header — click to select Y */}
                  <button
                    type="button"
                    onClick={() => setSelY(isSelY ? null : row.n)}
                    className={`text-xs font-medium px-2 py-2 text-left rounded-lg border transition-all truncate ${
                      isSelY
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : isApexY
                          ? 'border-amber-500/20 bg-amber-500/5 text-amber-400/80 hover:border-amber-500/35'
                          : 'border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                    title={row.sub}
                  >
                    <span className="text-[8px] font-bold text-slate-600 mr-1">{row.n}</span>
                    {row.label}
                  </button>

                  {/* Cells */}
                  {X_LABELS.map((col, xi) => {
                    const key             = `${row.n},${col.n}`;
                    const label           = CELL_LABEL[key] ?? '';
                    const isIntersection  = isSelY && selX === col.n;
                    const isRowHighlight  = isSelY && selX !== col.n;
                    const isColHighlight  = !isSelY && selX === col.n;
                    const isApexCell      = row.n >= 6 && col.n >= 6;
                    const hasLabel        = !!label;
                    const cellVentures    = venturesByCell.get(key) ?? [];
                    const ventureBadge = cellVentures.length > 0 ? (
                      <span
                        title={`Your venture${cellVentures.length === 1 ? '' : 's'} here: ${cellVentures.map(v => v.venture_name).join(', ')}`}
                        className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center ring-1 ring-slate-950 z-10"
                      >
                        {cellVentures.length}
                      </span>
                    ) : null;

                    if (isIntersection) {
                      const zs = ZONE_STYLE[computeZone(row.n, col.n)] ?? ZONE_STYLE.formation;
                      return (
                        <div key={xi} className={`relative rounded-lg border-2 ${isApexCell ? 'border-amber-500/70 bg-amber-950/30' : 'border-amber-500/60 bg-amber-950/20'} px-1.5 py-2 flex flex-col gap-0.5 text-center shadow-sm`}>
                          {ventureBadge}
                          <div className="text-[9px] font-semibold text-amber-300 leading-tight">{row.label}</div>
                          <div className="text-[9px] font-semibold text-amber-300 leading-tight">{col.label}</div>
                          <div className={`text-[10px] font-mono leading-tight mt-0.5 ${zs.label}`}>{label || '—'}</div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={xi}
                        className={`relative rounded border px-0.5 py-1.5 text-center text-[11px] leading-tight font-medium transition-colors ${
                          cellVentures.length > 0
                            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                            : isRowHighlight
                            ? hasLabel
                              ? 'border-emerald-500/20 bg-emerald-950/15 text-emerald-400/70'
                              : 'border-emerald-500/10 bg-emerald-950/8 text-slate-700'
                            : isColHighlight
                              ? hasLabel
                                ? 'border-amber-500/20 bg-amber-950/15 text-amber-400/60'
                                : 'border-amber-500/10 bg-amber-950/8 text-slate-700'
                              : isApexCell && hasLabel
                                ? 'border-amber-500/25 bg-amber-500/5 text-amber-300/70'
                                : hasLabel
                                  ? 'border-slate-700/40 bg-slate-900/20 text-slate-500'
                                  : 'border-slate-800/20 bg-slate-950/20 text-slate-800'
                        }`}
                        title={`${row.label} × ${col.label}${label ? ` — ${label}` : ''}${cellVentures.length ? ` · your venture${cellVentures.length === 1 ? '' : 's'}: ${cellVentures.map(v => v.venture_name).join(', ')}` : ''}`}
                      >
                        {ventureBadge}
                        {label || '·'}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600">
            <span><span className="text-emerald-400">■</span> selected row</span>
            <span><span className="text-amber-400">■</span> selected column</span>
            <span className="border border-amber-500/50 px-1 rounded text-amber-300">box</span>
            <span>= intersection</span>
            <span className="ml-auto text-slate-700">MATURITY ↑ · COMMERCIALIZATION →</span>
          </div>
        </div>
      </div>

      {/* Detail panel — shown when X is selected */}
      {selectedXLabel && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/15 px-3 py-2">
          <span className="text-[11px] font-semibold text-amber-300">
            X{selectedXLabel.n} — {selectedXLabel.label}
          </span>
          <p className="text-[11px] text-slate-400 mt-0.5">{X_INSIGHT[selectedXLabel.n]}</p>
        </div>
      )}

      {/* Intersection detail — shown when both Y and X are selected */}
      {selY !== null && selX !== null && intersectionZone && (
        <div className={`rounded-xl border p-4 space-y-3 ${ZONE_STYLE[intersectionZone]?.bg} ${ZONE_STYLE[intersectionZone]?.border}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ZONE_STYLE[intersectionZone]?.label} bg-black/20 ring-1 ${ZONE_STYLE[intersectionZone]?.ring}`}>
              {intersectionZone}
            </span>
            <span className="text-sm font-semibold text-slate-100">{intersectionLabel}</span>
          </div>

          {/* Overlay context */}
          {(() => {
            const ctx = OVERLAY_ZONE[overlay]?.[intersectionZone];
            return ctx ? (
              <div className="space-y-1">
                <p className={`text-xs font-medium ${ZONE_STYLE[intersectionZone]?.label}`}>{ctx.title}</p>
                <p className="text-xs text-slate-300"><span className="text-slate-500">Milestone: </span>{ctx.milestone}</p>
                <p className="text-xs text-slate-400"><span className="text-slate-500">KPI: </span>{ctx.kpi}</p>
              </div>
            ) : null;
          })()}

          <div className="space-y-1.5">
            <p className="text-xs text-slate-300"><span className={`font-medium ${ZONE_STYLE[intersectionZone]?.label}`}>Y{selY} · </span>{Y_INSIGHT[selY]}</p>
            <p className="text-xs text-slate-300"><span className={`font-medium ${ZONE_STYLE[intersectionZone]?.label}`}>X{selX} · </span>{X_INSIGHT[selX]}</p>
          </div>

          {(() => {
            const nba = ZONE_NBA[intersectionZone];
            return nba ? (
              <div className="bg-black/20 rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Next Best Action</p>
                <p className="text-xs text-slate-200 leading-relaxed">{nba.action}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ChevronRight className={`w-3 h-3 ${ZONE_STYLE[intersectionZone]?.label}`} />
                  <p className={`text-[10px] font-medium ${ZONE_STYLE[intersectionZone]?.label}`}>Target: {nba.target}</p>
                </div>
              </div>
            ) : null;
          })()}

          {atIntersection.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Ventures here</p>
              <div className="flex flex-wrap gap-1.5">
                {atIntersection.map(v => (
                  <span key={v.id} className={`px-2 py-0.5 rounded-full text-xs bg-black/20 border ${ZONE_STYLE[intersectionZone]?.border} ${ZONE_STYLE[intersectionZone]?.label}`}>
                    {v.venture_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Model View ────────────────────────────────────────────────────────────────

interface ModelViewProps {
  ventures: Venture[];
  isAdmin?: boolean;
  onSave: (id: string, payload: Venture['payload']) => Promise<void>;
}

export function ModelView({ ventures, isAdmin, onSave }: ModelViewProps) {
  const [selId,   setSelId]   = useState(ventures[0]?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const venture = ventures.find(v => v.id === selId) ?? ventures[0];
  const p = venture?.payload ?? {};

  const [vp, setVp] = useState(p.value_proposition ?? '');
  const [cs, setCs] = useState((p.customer_segments ?? []).join(', '));
  const [rs, setRs] = useState((p.revenue_streams ?? []).join(', '));
  const [kc, setKc] = useState((p.key_channels ?? []).join(', '));
  const [kp, setKp] = useState((p.key_partners ?? []).join(', '));

  const split = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);

  const startEdit = () => {
    const pp = venture?.payload ?? {};
    setVp(pp.value_proposition ?? '');
    setCs((pp.customer_segments ?? []).join(', '));
    setRs((pp.revenue_streams ?? []).join(', '));
    setKc((pp.key_channels ?? []).join(', '));
    setKp((pp.key_partners ?? []).join(', '));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!venture) return;
    setSaving(true);
    await onSave(venture.id, { ...venture.payload, value_proposition: vp, customer_segments: split(cs), revenue_streams: split(rs), key_channels: split(kc), key_partners: split(kp) });
    setSaving(false);
    setEditing(false);
  };

  if (!venture) return (
    <div className="p-8 text-center text-sm text-slate-500">No ventures yet. Add one via the Matrix tab.</div>
  );

  const zs = ZONE_STYLE[venture.zone] ?? ZONE_STYLE.formation;

  const CANVAS = [
    { label: 'Value Proposition', display: p.value_proposition,                       editVal: vp,  setEdit: setVp,  isText: true  },
    { label: 'Customer Segments', display: (p.customer_segments ?? []).join(' · '),   editVal: cs,  setEdit: setCs,  isText: false },
    { label: 'Revenue Streams',   display: (p.revenue_streams ?? []).join(' · '),     editVal: rs,  setEdit: setRs,  isText: false },
    { label: 'Key Channels',      display: (p.key_channels ?? []).join(' · '),        editVal: kc,  setEdit: setKc,  isText: false },
    { label: 'Key Partners',      display: (p.key_partners ?? []).join(' · '),        editVal: kp,  setEdit: setKp,  isText: false },
  ];

  return (
    <div className="p-5 space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <select value={selId} onChange={e => { setSelId(e.target.value); setEditing(false); }}
          className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none flex-1">
          {ventures.map(v => <option key={v.id} value={v.id}>{v.venture_name}</option>)}
        </select>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${zs.label}`}>Y{venture.y_maturity} · X{venture.x_commercialization} · {venture.zone}</span>
        {isAdmin && !editing && !venture.id.startsWith('cal-') && (
          <button onClick={startEdit} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">Edit</button>
        )}
        {venture.id.startsWith('cal-') && (
          <span className="text-[10px] text-slate-500" title="Plotted from your experience model / VentureQube. Edit it in Founder Office / the Venture wizards.">yours · view-only here</span>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 transition-all disabled:opacity-50">
              <Save className="w-3 h-3" />{saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {CANVAS.map(f => (
          <div key={f.label} className={`rounded-xl border p-4 ${zs.bg} ${zs.border}`}>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-2">{f.label}</p>
            {editing ? (
              f.isText
                ? <textarea value={f.editVal} onChange={e => f.setEdit(e.target.value)} rows={2}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none" />
                : <input value={f.editVal} onChange={e => f.setEdit(e.target.value)} placeholder="Comma-separated"
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none" />
            ) : (
              <p className="text-sm text-slate-200 leading-relaxed">{f.display || <span className="text-slate-600 italic">Not set</span>}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Strategy View ─────────────────────────────────────────────────────────────

interface StrategyViewProps {
  ventures: Venture[];
  overlay: IndustryOverlay;
}

export function StrategyView({ ventures, overlay }: StrategyViewProps) {
  const zones    = ['formation','validation','activation','strategic','scale'] as const;
  const byZone   = zones.reduce<Record<string, Venture[]>>((acc, z) => { acc[z] = ventures.filter(v => v.zone === z); return acc; }, {});
  const maxCount = Math.max(1, ...Object.values(byZone).map(a => a.length));

  return (
    <div className="p-5 space-y-6 max-w-2xl">
      <div>
        <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">Portfolio Zone Distribution</p>
        <div className="space-y-2">
          {zones.map(zone => {
            const list = byZone[zone] ?? [];
            const zs   = ZONE_STYLE[zone];
            const pct  = Math.round((list.length / maxCount) * 100);
            return (
              <div key={zone} className="flex items-center gap-3">
                <div className="w-20 text-right"><span className={`text-[10px] font-medium capitalize ${zs.label}`}>{zone}</span></div>
                <div className="flex-1 bg-slate-800/60 rounded-full h-2">
                  <div className={`h-2 rounded-full ${zs.dot} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-500 w-6 text-right">{list.length}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {zones.filter(z => (byZone[z] ?? []).length > 0).map(zone => {
          const list  = byZone[zone]!;
          const zs    = ZONE_STYLE[zone];
          const ctx   = OVERLAY_ZONE[overlay][zone];
          const nba   = ZONE_NBA[zone];
          return (
            <div key={zone} className={`rounded-xl border p-4 ${zs.bg} ${zs.border}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className={`text-sm font-semibold ${zs.label} capitalize`}>{ctx?.title ?? zone}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{list.length} venture{list.length !== 1 ? 's' : ''} · {ctx?.kpi}</p>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${zs.dot}`} />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {list.map(v => (
                  <span key={v.id} className={`px-2 py-0.5 rounded-full text-[10px] bg-black/20 border ${zs.border} ${zs.label}`}>{v.venture_name}</span>
                ))}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed"><span className="text-slate-500">Milestone: </span>{ctx?.milestone}</p>
              {nba && (
                <div className="mt-2 flex items-start gap-1.5">
                  <ChevronRight className={`w-3 h-3 mt-0.5 flex-shrink-0 ${zs.label}`} />
                  <p className="text-[10px] text-slate-400">{nba.action}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {zones.some(z => (byZone[z] ?? []).length === 0) && (
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Portfolio Gaps</p>
          <div className="flex flex-wrap gap-2">
            {zones.filter(z => (byZone[z] ?? []).length === 0).map(zone => {
              const zs = ZONE_STYLE[zone];
              return (
                <span key={zone} className={`px-3 py-1 rounded-lg border text-xs capitalize ${zs.border} ${zs.label} bg-black/10`}>
                  {zone} — no ventures
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
