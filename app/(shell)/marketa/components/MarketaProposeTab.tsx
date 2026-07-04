'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Loader2, CheckCircle2, Send, ChevronDown, ChevronRight,
  Twitter, Linkedin, Instagram, Mail, Youtube, Mic, Target, Trophy, FileText,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Channel { key: string; label: string; Icon: React.ComponentType<{ className?: string }> }

interface EnrichedPack {
  id: string;
  name: string;
  tagline: string;
  objectives: string[];
  milestones: Array<{ title: string; description: string; metric: string }>;
  copy_variants: Array<{ channel: string; subject?: string; body: string }>;
  reward_estimate: { knyt: number; qc: number };
  campaign_fit_score: number;
}

interface Props {
  theme?: 'light' | 'dark';
  partnerId?: string;
}

const CHANNELS: Channel[] = [
  { key: 'x',          label: 'X / Twitter',  Icon: Twitter   },
  { key: 'linkedin',   label: 'LinkedIn',      Icon: Linkedin  },
  { key: 'instagram',  label: 'Instagram',     Icon: Instagram },
  { key: 'newsletter', label: 'Newsletter',    Icon: Mail      },
  { key: 'youtube',    label: 'YouTube',       Icon: Youtube   },
  { key: 'podcast',    label: 'Podcast',       Icon: Mic       },
];

function th(d: boolean) {
  return {
    card:         d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:    d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    glowCard:     d ? 'bg-violet-950/20 border border-violet-500/20' : 'bg-violet-50 border border-violet-200',
    textPrimary:  d ? 'text-slate-100' : 'text-slate-900',
    textSecondary:d ? 'text-slate-300' : 'text-slate-700',
    textMuted:    d ? 'text-slate-400' : 'text-slate-600',
    textSubtle:   d ? 'text-slate-500' : 'text-slate-400',
    divider:      d ? 'border-white/[0.07]' : 'border-slate-200',
    inputBase:    d
      ? 'bg-slate-900/60 border border-white/10 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 rounded-lg px-3 py-2.5 text-sm w-full'
      : 'bg-white border border-slate-300 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 rounded-lg px-3 py-2.5 text-sm w-full',
    label:        d ? 'text-slate-300 text-xs font-medium mb-1.5 block' : 'text-slate-700 text-xs font-medium mb-1.5 block',
    chkActive:    d ? 'border-violet-500/40 bg-violet-500/10' : 'border-violet-300 bg-violet-50',
    chkInactive:  d ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300',
  };
}

// ── Preview section ────────────────────────────────────────────────────────────

function PackPreview({ pack, theme }: { pack: EnrichedPack; theme: 'light' | 'dark' }) {
  const d = theme === 'dark';
  const s = th(d);
  const [expanded, setExpanded] = useState<string | null>('objectives');

  const Section = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
    <div className={`rounded-lg border ${d ? 'border-white/[0.07]' : 'border-slate-200'}`}>
      <button
        onClick={() => setExpanded(expanded === id ? null : id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium ${s.textSecondary}`}
      >
        <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-violet-400" />{title}</span>
        {expanded === id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {expanded === id && (
        <div className={`px-3 pb-3 border-t ${s.divider}`}>
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className={`rounded-xl ${s.glowCard} p-4 space-y-4`}>
      {/* Pack header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className={`text-base font-bold ${s.textPrimary}`}>{pack.name}</h3>
            <p className={`text-xs italic ${s.textMuted} mt-0.5`}>{pack.tagline}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={d ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200'}>
              {pack.campaign_fit_score}% fit
            </Badge>
          </div>
        </div>

        {/* Reward estimate */}
        <div className="flex items-center gap-3 mt-3">
          <div className={`flex items-center gap-1.5 text-xs ${d ? 'text-amber-300' : 'text-amber-700'}`}>
            <Trophy className="w-3.5 h-3.5" />
            <span>{pack.reward_estimate.knyt.toLocaleString()} KNYT</span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${d ? 'text-sky-300' : 'text-sky-700'}`}>
            <span>{pack.reward_estimate.qc.toLocaleString()} Qc</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Section id="objectives" title="Objectives" icon={Target}>
          <ul className="mt-2 space-y-1.5">
            {pack.objectives.map((obj, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs ${s.textSecondary}`}>
                <span className="text-violet-400 font-bold mt-0.5">{i + 1}.</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="milestones" title="metaProof Milestones" icon={CheckCircle2}>
          <div className="mt-2 space-y-2">
            {pack.milestones.map((m, i) => (
              <div key={i} className={`rounded-lg ${d ? 'bg-slate-900/80 border border-white/[0.05]' : 'bg-white border border-slate-200'} p-2.5`}>
                <p className={`text-xs font-semibold ${s.textSecondary}`}>{m.title}</p>
                <p className={`text-[11px] ${s.textMuted} mt-0.5`}>{m.description}</p>
                <p className={`text-[10px] font-medium mt-1 ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>Metric: {m.metric}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="copy" title="Copy Variants" icon={FileText}>
          <div className="mt-2 space-y-2">
            {pack.copy_variants.map((cv, i) => (
              <div key={i} className={`rounded-lg ${d ? 'bg-slate-900/80 border border-white/[0.05]' : 'bg-white border border-slate-200'} p-2.5`}>
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${d ? 'text-violet-400' : 'text-violet-600'} mb-1`}>{cv.channel}</p>
                {cv.subject && <p className={`text-xs font-medium ${s.textSecondary} mb-1`}>{cv.subject}</p>}
                <p className={`text-[11px] ${s.textMuted} whitespace-pre-wrap line-clamp-6`}>{cv.body}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MarketaProposeTab({ theme = 'dark', partnerId }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  const [intent, setIntent]       = useState('');
  const [channels, setChannels]   = useState<string[]>([]);
  const [timing, setTiming]       = useState('');
  const [angle, setAngle]         = useState('');
  const [building, setBuilding]   = useState(false);
  const [pack, setPack]           = useState<EnrichedPack | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const toggleChannel = (key: string) =>
    setChannels((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);

  const handleBuild = async () => {
    if (!partnerId || !intent.trim() || !channels.length) return;
    setBuilding(true);
    setError(null);
    setPack(null);
    try {
      const res = await fetch('/api/marketa/partner-pack/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: partnerId, intent, channels, timing, angle }),
      });
      const data = await res.json();
      if (data.ok && data.pack) {
        setPack(data.pack);
      } else {
        setError(data.error ?? 'Marketa couldn\'t build the pack right now. Try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBuilding(false);
    }
  };

  const handleSubmit = async () => {
    if (!pack?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/marketa/packs/${pack.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending_review' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error ?? 'Submit failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-3 sm:p-4 lg:p-5">
        <div className={`rounded-xl ${d ? 'bg-emerald-950/20 ring-1 ring-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'} p-8 text-center`}>
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h3 className={`text-base font-bold ${d ? 'text-emerald-300' : 'text-emerald-700'} mb-2`}>
            Pack submitted for approval!
          </h3>
          <p className={`text-sm ${d ? 'text-emerald-400/70' : 'text-emerald-600'}`}>
            The Marketa team will review your campaign proposal and get back to you via QubeTalk.
          </p>
          <button
            onClick={() => { setPack(null); setSubmitted(false); setIntent(''); setChannels([]); setTiming(''); setAngle(''); }}
            className={`mt-4 text-xs ${d ? 'text-emerald-400/60 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
          >
            Propose another campaign
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {/* Header */}
      <div className={`rounded-xl ${d ? 'bg-violet-950/20 ring-1 ring-violet-500/20' : 'bg-violet-50 border border-violet-200'} p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${s.textPrimary}`}>Partner Pack Builder</h2>
            <p className={`text-sm mt-1 ${s.textMuted}`}>
              Tell Marketa what you want to achieve. She&apos;ll build a full campaign pack — objectives, milestones, copy and reward estimate — in seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Brief form */}
      {!pack && (
        <div className={`rounded-xl ${s.card} p-4 sm:p-5 space-y-4`}>
          <h3 className={`text-sm font-semibold ${s.textPrimary}`}>Your Campaign Brief</h3>

          <div>
            <label className={s.label}>What do you want to achieve? *</label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
              placeholder="e.g. Drive 50 people to the KNYT Kickstarter from my LinkedIn audience this week"
              className={s.inputBase}
            />
          </div>

          <div>
            <label className={s.label}>Which channels will you use? *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CHANNELS.map(({ key, label, Icon }) => {
                const checked = channels.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleChannel(key)}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${checked ? s.chkActive : s.chkInactive}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${checked ? 'text-violet-400' : s.textSubtle}`} />
                    <span className={`text-xs ${checked ? (d ? 'text-violet-300' : 'text-violet-700') : s.textSecondary}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={s.label}>When do you want to run it?</label>
              <input
                type="text"
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                placeholder="e.g. Next 7 days, starting Monday"
                className={s.inputBase}
              />
            </div>
            <div>
              <label className={s.label}>Anything specific about your audience or angle?</label>
              <input
                type="text"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="e.g. My audience is mostly Web3 developers"
                className={s.inputBase}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            variant="outline"
            onClick={handleBuild}
            disabled={building || !intent.trim() || channels.length === 0 || !partnerId}
            className={`w-full sm:w-auto font-semibold bg-transparent ${d ? 'border-violet-500/30 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/40' : 'border-violet-500/40 text-violet-700 hover:bg-violet-50'}`}
          >
            {building ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Marketa is building your pack…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Let Marketa Build It</>
            )}
          </Button>
          {!partnerId && (
            <p className={`text-xs ${s.textSubtle}`}>Partner identity not resolved — contact the Marketa team.</p>
          )}
        </div>
      )}

      {/* AI-enriched pack preview */}
      {pack && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-semibold ${s.textPrimary}`}>Marketa built your campaign pack</p>
            <button
              onClick={() => { setPack(null); setError(null); }}
              className={`text-xs ${s.textSubtle} hover:${s.textMuted} underline`}
            >
              Start over
            </button>
          </div>

          <PackPreview pack={pack} theme={theme} />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSubmit}
              disabled={submitting}
              className={`font-semibold bg-transparent ${d ? 'border-pink-400/30 text-pink-300 hover:bg-pink-400/10 hover:border-pink-400/40' : 'border-pink-400/40 text-pink-600 hover:bg-pink-50'}`}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Submit for Approval</>
              )}
            </Button>
            <p className={`text-xs ${s.textSubtle}`}>The Marketa team reviews and approves within 24h.</p>
          </div>
        </div>
      )}
    </div>
  );
}
