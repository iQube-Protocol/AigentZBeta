'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Tv2, BookOpen, Users, Mic, Mail, Twitter, Linkedin, Instagram, Youtube, RefreshCcw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PartnerRecord {
  id: string;
  name: string;
  org: string;
  wave: number;
  contact_email: string | null;
  outreach_status: string;
  bd_stage: string;
  notes: string | null;
}

interface Props {
  theme?: 'light' | 'dark';
  partnerId?: string;
}

const CHANNELS = [
  { key: 'x',         label: 'X / Twitter',  Icon: Twitter   },
  { key: 'linkedin',  label: 'LinkedIn',      Icon: Linkedin  },
  { key: 'instagram', label: 'Instagram',     Icon: Instagram },
  { key: 'newsletter',label: 'Newsletter',    Icon: Mail      },
  { key: 'youtube',   label: 'YouTube',       Icon: Youtube   },
  { key: 'podcast',   label: 'Podcast',       Icon: Mic       },
] as const;

function th(isDark: boolean) {
  return {
    card:         isDark ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:    isDark ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    highlightCard:isDark ? 'bg-rose-950/20 border border-rose-500/20' : 'bg-rose-50 border border-rose-200',
    textPrimary:  isDark ? 'text-slate-100' : 'text-slate-900',
    textSecondary:isDark ? 'text-slate-300' : 'text-slate-700',
    textMuted:    isDark ? 'text-slate-400' : 'text-slate-600',
    textSubtle:   isDark ? 'text-slate-500' : 'text-slate-400',
    divider:      isDark ? 'border-white/[0.07]' : 'border-slate-200',
    inputCls:     isDark
      ? 'bg-slate-900/60 border border-white/10 text-slate-300 focus:outline-none focus:border-rose-500/50 rounded-lg px-3 py-2 text-sm w-full'
      : 'bg-white border border-slate-300 text-slate-700 focus:outline-none focus:border-rose-500 rounded-lg px-3 py-2 text-sm w-full',
    checkBox:     (checked: boolean) => checked
      ? 'border-rose-500 bg-rose-500/10 text-rose-400'
      : isDark ? 'border-white/20 text-slate-500' : 'border-slate-300 text-slate-400',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketaMyCampaignTab({ theme = 'dark', partnerId }: Props) {
  const isDark = theme === 'dark';
  const s = th(isDark);

  const [partner, setPartner]       = useState<PartnerRecord | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [channels, setChannels]     = useState<string[]>([]);
  const [startDate, setStartDate]   = useState('');
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partnerId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/avl/partners/${partnerId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.ok && d.data) {
          setPartner(d.data);
          // Restore saved channels from notes
          try {
            const notes = JSON.parse(d.data.notes ?? '{}');
            if (Array.isArray(notes.preferred_channels)) setChannels(notes.preferred_channels);
            if (notes.campaign_start_date) setStartDate(notes.campaign_start_date);
          } catch { /* notes not JSON */ }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { load(); }, [load]);

  const toggleChannel = (key: string) =>
    setChannels((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);

  const handleConfirm = async () => {
    if (!partnerId || !channels.length) return;
    setSaving(true);
    setError(null);
    try {
      const notes = JSON.stringify({ preferred_channels: channels, campaign_start_date: startDate });
      const res = await fetch('/api/avl/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: partnerId,
          outreach_status: 'committed',
          response_signal: 'interested',
          notes,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setSaved(true);
        setPartner((p) => p ? { ...p, outreach_status: 'committed' } : p);
      } else {
        setError(d.error ?? 'Failed to confirm');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
      </div>
    );
  }

  if (!partnerId) {
    return (
      <div className={`m-4 rounded-xl ${s.card} p-10 text-center`}>
        <Users className={`w-8 h-8 mx-auto mb-3 ${s.textSubtle}`} />
        <p className={`text-sm ${s.textMuted}`}>Partner identity not resolved. Contact the Marketa team.</p>
      </div>
    );
  }

  const isCommitted = partner?.outreach_status === 'committed';

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {/* Welcome card */}
      <div className={`rounded-xl ${s.highlightCard} p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
            <Tv2 className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${s.textPrimary}`}>
              Welcome to the KNYT Campaign, {partner?.name ?? 'Partner'}
            </h2>
            <p className={`text-sm mt-1 ${s.textMuted}`}>
              You&apos;re part of the KNYT Activation — 21 Awakenings. Co-create, amplify, and earn rewards as we bring KNYT to life.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign overview */}
      <div className={`rounded-xl ${s.card} p-4 sm:p-5 space-y-4`}>
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-rose-400" />
          <h3 className={`text-sm font-semibold ${s.textPrimary}`}>Campaign Overview</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Campaign', value: 'KNYT — 21 Awakenings', accent: 'text-rose-400' },
            { label: 'Your Wave', value: partner ? `Wave ${partner.wave}` : '—', accent: 'text-violet-400' },
            { label: 'Status', value: partner?.outreach_status ?? '—', accent: isCommitted ? 'text-emerald-400' : 'text-amber-400' },
          ].map(({ label, value, accent }) => (
            <div key={label} className={`rounded-lg ${s.innerCard} p-3`}>
              <p className={`text-[10px] uppercase tracking-wide ${s.textSubtle} mb-1`}>{label}</p>
              <p className={`text-sm font-semibold ${accent}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Participation form */}
      {!saved && !isCommitted && (
        <div className={`rounded-xl ${s.card} p-4 sm:p-5 space-y-4`}>
          <h3 className={`text-sm font-semibold ${s.textPrimary}`}>Confirm Your Participation</h3>

          {/* Channel selector */}
          <div>
            <p className={`text-xs font-medium ${s.textMuted} mb-2`}>Which channels will you activate on?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CHANNELS.map(({ key, label, Icon }) => {
                const checked = channels.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleChannel(key)}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                      checked
                        ? isDark ? 'border-rose-500/40 bg-rose-500/10' : 'border-rose-300 bg-rose-50'
                        : isDark ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${s.checkBox(checked)}`}>
                      {checked && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <Icon className={`w-3.5 h-3.5 ${checked ? 'text-rose-400' : s.textSubtle}`} />
                    <span className={`text-xs ${checked ? (isDark ? 'text-rose-300' : 'text-rose-700') : s.textSecondary}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start date */}
          <div>
            <p className={`text-xs font-medium ${s.textMuted} mb-2`}>Preferred start date (optional)</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={s.inputCls}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            variant="outline"
            className={`w-full sm:w-auto bg-transparent ${isDark ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40' : 'border-rose-500/40 text-rose-700 hover:bg-rose-50'}`}
            onClick={handleConfirm}
            disabled={saving || channels.length === 0}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirm Participation
          </Button>
          {channels.length === 0 && (
            <p className={`text-xs ${s.textSubtle}`}>Select at least one channel to confirm.</p>
          )}
        </div>
      )}

      {/* Confirmed state */}
      {(saved || isCommitted) && (
        <div className={`rounded-xl ${isDark ? 'bg-emerald-950/20 ring-1 ring-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'} p-5`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                You&apos;re in! Participation confirmed.
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600'}`}>
                {channels.length > 0
                  ? `Channels: ${channels.join(', ')}${startDate ? ` · Start: ${startDate}` : ''}`
                  : 'The Marketa team will be in touch with your campaign pack shortly.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setSaved(false); }}
            className={`mt-3 text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400/60 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
          >
            <RefreshCcw className="w-3 h-3" />
            Update channels
          </button>
        </div>
      )}
    </div>
  );
}
