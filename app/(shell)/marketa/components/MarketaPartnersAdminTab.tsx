'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Mail, Eye, Send, ChevronDown, Users, CheckCircle2, XCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AvlPartner {
  id: string;
  name: string;
  org: string;
  wave: number;
  contact_email: string | null;
  contact_name: string | null;
  outreach_status: string;
  bd_stage: string;
  response_signal: string | null;
  strategic_value_tier: number | null;
  next_action: string | null;
  assigned_agent: string;
}

interface CommsPack {
  slug: string;
  title: string;
  subject_lines: string[];
}

interface SendState {
  loading: boolean;
  preview: { subject: string; body: string } | null;
  result: { sent: number; failed: number } | null;
  error: string | null;
}

interface Props {
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
}

const OUTREACH_STATUSES = [
  'uncontacted', 'contacted', 'responded', 'committed', 'declined', 'deferred',
] as const;

// ── Theme helpers ──────────────────────────────────────────────────────────────

function useTheme(theme: 'light' | 'dark') {
  const d = theme === 'dark';
  return {
    isDark: d,
    // Containers
    card:      d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard: d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    previewPanel: d ? 'bg-slate-900/80 border border-white/10' : 'bg-blue-50 border border-blue-200',
    // Text
    textPrimary:   d ? 'text-slate-100'  : 'text-slate-900',
    textSecondary: d ? 'text-slate-300'  : 'text-slate-700',
    textMuted:     d ? 'text-slate-400'  : 'text-slate-600',
    textSubtle:    d ? 'text-slate-500'  : 'text-slate-400',
    // Inputs / selects
    inputCls: d
      ? 'bg-slate-900/60 border border-white/10 text-slate-300 focus:outline-none focus:border-rose-500/50'
      : 'bg-white border border-slate-300 text-slate-700 focus:outline-none focus:border-rose-500',
    selectCls: d
      ? 'appearance-none bg-slate-900/60 border border-white/10 text-slate-300 focus:outline-none focus:border-rose-500/50'
      : 'appearance-none bg-white border border-slate-300 text-slate-700 focus:outline-none focus:border-rose-500',
    // Wave filter buttons
    waveActive:   d ? 'bg-rose-500/10 text-rose-300 font-medium' : 'bg-rose-50 text-rose-700 font-medium',
    waveInactive: d ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-600 hover:text-slate-800',
    waveBorder:   d ? 'border border-white/10' : 'border border-slate-200',
    // Status colors (outreach)
    statusColor: (s: string): string => {
      const map: Record<string, string> = d ? {
        uncontacted: 'bg-slate-700/50 text-slate-400 border-slate-600',
        contacted:   'bg-sky-500/20 text-sky-300 border-sky-500/30',
        responded:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
        committed:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        declined:    'bg-red-500/20 text-red-400 border-red-500/30',
        deferred:    'bg-slate-500/20 text-slate-400 border-slate-600',
      } : {
        uncontacted: 'bg-slate-100 text-slate-500 border-slate-300',
        contacted:   'bg-sky-50 text-sky-700 border-sky-200',
        responded:   'bg-amber-50 text-amber-700 border-amber-200',
        committed:   'bg-emerald-50 text-emerald-700 border-emerald-200',
        declined:    'bg-red-50 text-red-600 border-red-200',
        deferred:    'bg-slate-100 text-slate-500 border-slate-300',
      };
      return map[s] ?? (d ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-300');
    },
    divider: d ? 'border-white/[0.07]' : 'border-slate-200',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketaPartnersAdminTab({ theme = 'dark' }: Props) {
  const t = useTheme(theme);

  const [partners, setPartners]         = useState<AvlPartner[]>([]);
  const [packs, setPacks]               = useState<CommsPack[]>([]);
  const [wave, setWave]                 = useState<1 | 2 | 'all'>('all');
  const [loading, setLoading]           = useState(false);
  const [selectedPack, setSelectedPack] = useState('');
  const [subjectIndex, setSubjectIndex] = useState(0);
  const [sendStates, setSendStates]     = useState<Record<string, SendState>>({});
  const [bulkSending, setBulkSending]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/avl/partners'),
        fetch('/api/avl/comms-packs'),
      ]);
      if (pRes.ok) {
        const d = await pRes.json();
        if (d.ok) setPartners(d.data?.partners ?? []);
      }
      if (cRes.ok) {
        const d = await cRes.json();
        if (d.ok) setPacks(d.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredPartners = wave === 'all'
    ? partners
    : partners.filter((p) => p.wave === wave);

  const updateSendState = (id: string, update: Partial<SendState>) =>
    setSendStates((prev) => ({
      ...prev,
      [id]: { loading: false, preview: null, result: null, error: null, ...prev[id], ...update },
    }));

  const handlePreview = async (partnerId: string) => {
    if (!selectedPack) return;
    updateSendState(partnerId, { loading: true, preview: null, result: null, error: null });
    try {
      const res = await fetch('/api/avl/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_slug: selectedPack, partner_ids: [partnerId], dry_run: true, subject_index: subjectIndex }),
      });
      const d = await res.json();
      if (d.ok && d.preview?.[0]) {
        updateSendState(partnerId, { loading: false, preview: { subject: d.preview[0].subject, body: d.preview[0].body } });
      } else {
        updateSendState(partnerId, { loading: false, error: d.error ?? 'Preview failed' });
      }
    } catch {
      updateSendState(partnerId, { loading: false, error: 'Network error' });
    }
  };

  const handleSend = async (partnerId: string) => {
    if (!selectedPack) return;
    updateSendState(partnerId, { loading: true, preview: null, result: null, error: null });
    try {
      const res = await fetch('/api/avl/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_slug: selectedPack, partner_ids: [partnerId], dry_run: false, subject_index: subjectIndex }),
      });
      const d = await res.json();
      if (d.ok) {
        updateSendState(partnerId, { loading: false, result: { sent: d.sent ?? 1, failed: d.failed ?? 0 } });
        load();
      } else {
        updateSendState(partnerId, { loading: false, error: d.error ?? 'Send failed' });
      }
    } catch {
      updateSendState(partnerId, { loading: false, error: 'Network error' });
    }
  };

  const handleStatusChange = async (partnerId: string, status: string) => {
    try {
      await fetch('/api/avl/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: partnerId, outreach_status: status }),
      });
      setPartners((prev) => prev.map((p) => p.id === partnerId ? { ...p, outreach_status: status } : p));
    } catch { /* silent */ }
  };

  const handleBulkSend = async () => {
    if (!selectedPack) return;
    const targets = filteredPartners
      .filter((p) => p.contact_email && p.outreach_status === 'uncontacted')
      .map((p) => p.id);
    if (!targets.length) return;
    setBulkSending(true);
    try {
      const res = await fetch('/api/avl/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_slug: selectedPack, partner_ids: targets, dry_run: true, subject_index: subjectIndex }),
      });
      const d = await res.json();
      if (d.ok) {
        alert(`Dry-run: ${d.preview?.length ?? targets.length} emails ready. Remove dry_run to send live.`);
      }
    } finally {
      setBulkSending(false);
    }
  };

  const currentPack = packs.find((p) => p.slug === selectedPack);

  // Summary counts
  const summary = {
    total:       partners.length,
    uncontacted: partners.filter((p) => p.outreach_status === 'uncontacted').length,
    contacted:   partners.filter((p) => p.outreach_status === 'contacted').length,
    responded:   partners.filter((p) => p.outreach_status === 'responded').length,
    committed:   partners.filter((p) => p.outreach_status === 'committed').length,
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {/* Summary strip */}
      <div className={`rounded-xl ${t.card} p-3 sm:p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-rose-400" />
          <span className={`text-sm font-semibold ${t.textPrimary}`}>AVL Partner Pipeline</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Total', value: summary.total, color: t.textPrimary },
            { label: 'Uncontacted', value: summary.uncontacted, color: 'text-slate-400' },
            { label: 'Contacted', value: summary.contacted, color: 'text-sky-400' },
            { label: 'Responded', value: summary.responded, color: 'text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-lg ${t.innerCard} p-2.5 text-center`}>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className={`text-[10px] ${t.textSubtle} mt-0.5`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Controls bar */}
      <div className={`rounded-xl ${t.card} p-3 sm:p-4`}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">

          {/* Wave filter */}
          <div className={`flex rounded-lg overflow-hidden text-xs ${t.waveBorder}`}>
            {(['all', 1, 2] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWave(w)}
                className={`px-3 py-1.5 transition-colors font-medium ${wave === w ? t.waveActive : t.waveInactive}`}
              >
                {w === 'all' ? 'All' : `Wave ${w}`}
              </button>
            ))}
          </div>

          {/* Pack selector */}
          <div className="relative">
            <select
              value={selectedPack}
              onChange={(e) => setSelectedPack(e.target.value)}
              className={`text-xs rounded-lg px-3 py-1.5 pr-7 ${t.selectCls}`}
            >
              <option value="">Select comms pack…</option>
              {packs.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
            </select>
            <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 ${t.textSubtle} pointer-events-none`} />
          </div>

          {/* Subject variant */}
          {(currentPack?.subject_lines?.length ?? 0) > 1 && (
            <div className={`flex items-center gap-1.5 text-xs ${t.textMuted}`}>
              <span>Subject:</span>
              {currentPack!.subject_lines.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSubjectIndex(i)}
                  className={`w-5 h-5 rounded border transition-colors text-[10px] font-semibold ${
                    subjectIndex === i
                      ? 'border-rose-500/50 text-rose-400 bg-rose-500/10'
                      : t.isDark ? 'border-white/10 text-slate-500 hover:text-slate-300' : 'border-slate-300 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs bg-transparent ${t.isDark ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-600 hover:text-slate-800'}`}
              onClick={load}
              disabled={loading}
            >
              <RefreshCcw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {selectedPack && (
              <Button
                size="sm"
                variant="outline"
                className={`h-7 text-xs bg-transparent ${t.isDark ? 'border-violet-500/30 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/40' : 'border-violet-500/40 text-violet-700 hover:bg-violet-50'}`}
                onClick={handleBulkSend}
                disabled={bulkSending}
              >
                <Send className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Dry-run</span> Wave {wave === 'all' ? '1+2' : wave} uncontacted
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Partner grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredPartners.map((partner) => {
          const state = sendStates[partner.id];
          return (
            <div key={partner.id} className={`rounded-xl ${t.card} p-4 space-y-3`}>

              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-semibold text-sm truncate ${t.textPrimary}`}>{partner.name}</p>
                  <p className={`text-[11px] truncate ${t.textMuted}`}>{partner.org}</p>
                  {partner.contact_email && (
                    <p className={`text-[10px] truncate mt-0.5 ${t.textSubtle}`}>
                      {partner.contact_name ? `${partner.contact_name} · ` : ''}{partner.contact_email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge className={`text-[9px] ${t.isDark ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                    W{partner.wave}
                  </Badge>
                  {partner.strategic_value_tier && (
                    <Badge className={`text-[9px] ${t.isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      T{partner.strategic_value_tier}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className={`border-t ${t.divider}`} />

              {/* Status row */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${t.textSubtle}`}>Status:</span>
                <select
                  value={partner.outreach_status}
                  onChange={(e) => handleStatusChange(partner.id, e.target.value)}
                  className={`text-[10px] rounded px-2 py-0.5 border focus:outline-none cursor-pointer ${t.statusColor(partner.outreach_status)}`}
                >
                  {OUTREACH_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {partner.next_action && (
                  <span className={`text-[10px] italic truncate flex-1 ${t.textSubtle}`}>{partner.next_action}</span>
                )}
              </div>

              {/* Actions */}
              {partner.contact_email && selectedPack && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-6 text-[10px] bg-transparent ${t.isDark ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-600 hover:text-slate-800'}`}
                    onClick={() => handlePreview(partner.id)}
                    disabled={state?.loading}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-6 text-[10px] bg-transparent ${
                      state?.result
                        ? (t.isDark ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-50')
                        : (t.isDark ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10' : 'border-rose-500/40 text-rose-700 hover:bg-rose-50')
                    }`}
                    onClick={() => handleSend(partner.id)}
                    disabled={state?.loading || !!state?.result}
                  >
                    {state?.result ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" />Sent</>
                    ) : (
                      <><Mail className="w-3 h-3 mr-1" />Send</>
                    )}
                  </Button>
                  {state?.error && (
                    <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                      <XCircle className="w-3 h-3" />{state.error}
                    </span>
                  )}
                  {state?.result && state.result.failed > 0 && (
                    <span className="text-[10px] text-amber-400">{state.result.failed} failed</span>
                  )}
                </div>
              )}

              {!partner.contact_email && (
                <p className={`text-[10px] italic ${t.textSubtle}`}>No email — manual outreach required</p>
              )}

              {/* Email preview panel */}
              {state?.preview && (
                <div className={`rounded-lg ${t.previewPanel} p-3 space-y-1.5`}>
                  <p className={`text-[10px] font-semibold ${t.textSecondary}`}>{state.preview.subject}</p>
                  <p className={`text-[10px] ${t.textMuted} line-clamp-5 whitespace-pre-wrap`}>{state.preview.body}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPartners.length === 0 && !loading && (
        <div className={`rounded-xl ${t.card} p-10 text-center`}>
          <Users className={`w-8 h-8 mx-auto mb-3 ${t.textSubtle}`} />
          <p className={`text-sm ${t.textMuted}`}>No partners found for this wave.</p>
        </div>
      )}
    </div>
  );
}
