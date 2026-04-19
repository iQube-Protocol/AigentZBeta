'use client';

import React, { useState } from 'react';
import { ChevronRight, Save, X } from 'lucide-react';
import {
  Venture, IndustryOverlay,
  Y_LABELS, X_LABELS, computeZone, ZONE_STYLE,
  OVERLAY_ZONE, Y_INSIGHT, X_INSIGHT, ZONE_NBA,
} from './_ventureLabData';

// ── Ladder View ───────────────────────────────────────────────────────────────

interface LadderViewProps {
  ventures: Venture[];
  overlay: IndustryOverlay;
}

export function LadderView({ ventures, overlay }: LadderViewProps) {
  const [selY, setSelY] = useState(4);
  const [selX, setSelX] = useState(3);

  const zone     = computeZone(selY, selX);
  const zs       = ZONE_STYLE[zone] ?? ZONE_STYLE.formation;
  const ovCtx    = OVERLAY_ZONE[overlay][zone];
  const nba      = ZONE_NBA[zone];
  const yLabel   = Y_LABELS.find(r => r.n === selY)!;
  const xLabel   = X_LABELS.find(c => c.n === selX)!;
  const atPos    = ventures.filter(v => v.y_maturity === selY && v.x_commercialization === selX);

  return (
    <div className="p-5 flex flex-col gap-6 max-w-2xl">

      {/* Y selector */}
      <div>
        <p className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wide">Venture Development Maturity (Y)</p>
        <div className="flex gap-1">
          {[...Y_LABELS].reverse().map(row => {
            const z  = computeZone(row.n, selX);
            const zz = ZONE_STYLE[z];
            const isActive = row.n === selY;
            const isPast   = row.n < selY;
            return (
              <button
                key={row.n}
                onClick={() => setSelY(row.n)}
                className={`flex-1 py-2 px-1 rounded text-center transition-all text-[10px] font-medium
                  ${isActive ? `${zz.bg} ${zz.border} border ${zz.label} ring-1 ${zz.ring}` :
                    isPast   ? `${zz.bg} border ${zz.border} text-slate-600` :
                               'bg-slate-900/40 border border-white/[0.04] text-slate-700 hover:text-slate-500'}`}
              >
                <div className="font-semibold">{row.n}</div>
                <div className="leading-tight mt-0.5 hidden md:block">{row.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* X selector */}
      <div>
        <p className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wide">Commercialization Strength (X)</p>
        <div className="flex gap-1">
          {X_LABELS.map(col => {
            const z  = computeZone(selY, col.n);
            const zz = ZONE_STYLE[z];
            const isActive = col.n === selX;
            const isPast   = col.n < selX;
            return (
              <button
                key={col.n}
                onClick={() => setSelX(col.n)}
                className={`flex-1 py-2 px-1 rounded text-center transition-all text-[10px] font-medium
                  ${isActive ? `${zz.bg} ${zz.border} border ${zz.label} ring-1 ${zz.ring}` :
                    isPast   ? `${zz.bg} border ${zz.border} text-slate-600` :
                               'bg-slate-900/40 border border-white/[0.04] text-slate-700 hover:text-slate-500'}`}
              >
                <div className="font-semibold">{col.n}</div>
                <div className="leading-tight mt-0.5 hidden md:block">{col.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Intersection panel */}
      <div className={`rounded-xl border p-5 space-y-4 ${zs.bg} ${zs.border}`}>
        {/* Zone badge + position */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${zs.label} bg-black/20 ring-1 ${zs.ring}`}>
            {zone}
          </span>
          <span className="text-xs text-slate-400">
            Y{selY} {yLabel.label} × X{selX} {xLabel.label}
          </span>
        </div>

        {/* Overlay context */}
        {ovCtx && (
          <div className="space-y-1">
            <p className={`text-sm font-semibold ${zs.label}`}>{ovCtx.title}</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              <span className="text-slate-500">Milestone: </span>{ovCtx.milestone}
            </p>
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">KPI: </span>{ovCtx.kpi}
            </p>
          </div>
        )}

        <hr className="border-white/[0.07]" />

        {/* Y + X insights */}
        <div className="space-y-2">
          <p className="text-xs text-slate-300 leading-relaxed">
            <span className={`font-medium ${zs.label}`}>Y{selY} · </span>{Y_INSIGHT[selY]}
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            <span className={`font-medium ${zs.label}`}>X{selX} · </span>{X_INSIGHT[selX]}
          </p>
        </div>

        {/* NBA */}
        {nba && (
          <div className="bg-black/20 rounded-lg p-3 space-y-1">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Next Best Action</p>
            <p className="text-xs text-slate-200 leading-relaxed">{nba.action}</p>
            <div className="flex items-center gap-1 mt-1">
              <ChevronRight className={`w-3 h-3 ${zs.label}`} />
              <p className={`text-[10px] font-medium ${zs.label}`}>Target: {nba.target}</p>
            </div>
          </div>
        )}

        {/* Ventures at this position */}
        {atPos.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wide">Ventures here</p>
            <div className="flex flex-wrap gap-1.5">
              {atPos.map(v => (
                <span key={v.id} className={`px-2.5 py-1 rounded-full text-xs ${zs.bg} border ${zs.border} ${zs.label}`}>
                  {v.venture_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
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
  const [selId, setSelId]   = useState(ventures[0]?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);

  const venture = ventures.find(v => v.id === selId) ?? ventures[0];
  const p = venture?.payload ?? {};

  // editable fields mirror
  const [vp,  setVp]  = useState(p.value_proposition ?? '');
  const [cs,  setCs]  = useState((p.customer_segments ?? []).join(', '));
  const [rs,  setRs]  = useState((p.revenue_streams ?? []).join(', '));
  const [kc,  setKc]  = useState((p.key_channels ?? []).join(', '));
  const [kp,  setKp]  = useState((p.key_partners ?? []).join(', '));

  const splitComma = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);

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
    await onSave(venture.id, {
      ...venture.payload,
      value_proposition: vp,
      customer_segments: splitComma(cs),
      revenue_streams: splitComma(rs),
      key_channels: splitComma(kc),
      key_partners: splitComma(kp),
    });
    setSaving(false);
    setEditing(false);
  };

  if (!venture) {
    return <div className="p-8 text-center text-sm text-slate-500">No ventures yet. Add one via the Matrix tab.</div>;
  }

  const CANVAS_FIELDS = [
    { label: 'Value Proposition', value: p.value_proposition,     editVal: vp,  setEdit: setVp,  isText: true },
    { label: 'Customer Segments', value: (p.customer_segments ?? []).join(' · '), editVal: cs, setEdit: setCs, isText: false },
    { label: 'Revenue Streams',   value: (p.revenue_streams ?? []).join(' · '),   editVal: rs, setEdit: setRs, isText: false },
    { label: 'Key Channels',      value: (p.key_channels ?? []).join(' · '),      editVal: kc, setEdit: setKc, isText: false },
    { label: 'Key Partners',      value: (p.key_partners ?? []).join(' · '),      editVal: kp, setEdit: setKp, isText: false },
  ];

  const zs = ZONE_STYLE[venture.zone] ?? ZONE_STYLE.formation;

  return (
    <div className="p-5 space-y-4 max-w-2xl">
      {/* Venture selector */}
      <div className="flex items-center gap-3">
        <select
          value={selId}
          onChange={e => { setSelId(e.target.value); setEditing(false); }}
          className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none flex-1"
        >
          {ventures.map(v => <option key={v.id} value={v.id}>{v.venture_name}</option>)}
        </select>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${zs.label}`}>
          Y{venture.y_maturity} · X{venture.x_commercialization} · {venture.zone}
        </span>
        {isAdmin && !editing && (
          <button onClick={startEdit} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
            Edit
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 transition-all disabled:opacity-50">
              <Save className="w-3 h-3" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Business model canvas */}
      <div className="grid grid-cols-1 gap-3">
        {CANVAS_FIELDS.map(f => (
          <div key={f.label} className={`rounded-xl border p-4 ${zs.bg} ${zs.border}`}>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-2">{f.label}</p>
            {editing ? (
              f.isText ? (
                <textarea
                  value={f.editVal}
                  onChange={e => f.setEdit(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none resize-none"
                />
              ) : (
                <input
                  value={f.editVal}
                  onChange={e => f.setEdit(e.target.value)}
                  placeholder="Comma-separated"
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                />
              )
            ) : (
              <p className="text-sm text-slate-200 leading-relaxed">
                {f.value || <span className="text-slate-600 italic">Not set</span>}
              </p>
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
  const zones = ['formation','validation','activation','strategic','scale'];

  const byZone = zones.reduce<Record<string, Venture[]>>((acc, z) => {
    acc[z] = ventures.filter(v => v.zone === z);
    return acc;
  }, {});

  const maxCount = Math.max(1, ...Object.values(byZone).map(a => a.length));

  return (
    <div className="p-5 space-y-6 max-w-2xl">
      {/* Portfolio distribution bar */}
      <div>
        <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">Portfolio Zone Distribution</p>
        <div className="space-y-2">
          {zones.map(zone => {
            const list = byZone[zone] ?? [];
            const zs   = ZONE_STYLE[zone];
            const pct  = Math.round((list.length / maxCount) * 100);
            return (
              <div key={zone} className="flex items-center gap-3">
                <div className="w-20 text-right">
                  <span className={`text-[10px] font-medium capitalize ${zs.label}`}>{zone}</span>
                </div>
                <div className="flex-1 bg-slate-800/60 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${zs.dot} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 w-6 text-right">{list.length}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zone cards — only for zones with ventures */}
      <div className="space-y-3">
        {zones.filter(z => (byZone[z] ?? []).length > 0).map(zone => {
          const list  = byZone[zone]!;
          const zs    = ZONE_STYLE[zone];
          const ovCtx = OVERLAY_ZONE[overlay][zone];
          const nba   = ZONE_NBA[zone];
          return (
            <div key={zone} className={`rounded-xl border p-4 ${zs.bg} ${zs.border}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className={`text-sm font-semibold ${zs.label} capitalize`}>{ovCtx?.title ?? zone}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{list.length} venture{list.length !== 1 ? 's' : ''} · {ovCtx?.kpi}</p>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${zs.dot}`} />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {list.map(v => (
                  <span key={v.id} className={`px-2 py-0.5 rounded-full text-[10px] bg-black/20 border ${zs.border} ${zs.label}`}>
                    {v.venture_name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-slate-500">Milestone: </span>{ovCtx?.milestone}
              </p>
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

      {/* Gap analysis */}
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
